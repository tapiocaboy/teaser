"""
Visualization Router
WebSocket and REST endpoints for real-time audio visualization
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
import numpy as np
import logging
import asyncio
import json
from typing import Optional
import base64

from ..visualization import VisualizationService, get_visualization_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/visualization",
    tags=["visualization"]
)

# WebSocket connection manager for visualization
class VisualizationConnectionManager:
    """Manages WebSocket connections for visualization streaming."""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.session_services: dict[str, VisualizationService] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        
        # Create dedicated service instance for this session
        self.session_services[session_id] = VisualizationService()
        
        logger.info(f"Visualization WebSocket connected: {session_id}")
    
    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in self.session_services:
            self.session_services[session_id].reset()
            del self.session_services[session_id]
        logger.info(f"Visualization WebSocket disconnected: {session_id}")
    
    def get_service(self, session_id: str) -> Optional[VisualizationService]:
        return self.session_services.get(session_id)
    
    async def send_frame(self, session_id: str, frame_data: dict):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_json(frame_data)
            except Exception as e:
                logger.error(f"Error sending frame: {e}")
                self.disconnect(session_id)


ws_manager = VisualizationConnectionManager()


@router.get("/status")
async def get_visualization_status():
    """Get visualization service status."""
    service = get_visualization_service()
    return service.get_status()


@router.post("/reset")
async def reset_visualization(reset_umap: bool = True):
    """Reset the visualization service."""
    service = get_visualization_service()
    service.reset(reset_umap=reset_umap)
    return {"status": "reset", "reset_umap": reset_umap}


@router.post("/process")
async def process_audio_for_visualization(file: UploadFile = File(...)):
    """
    Process an audio file and return visualization data.
    
    Returns 3D coordinates and audio features for the entire file.
    """
    try:
        audio_data = await file.read()
        service = get_visualization_service()
        
        # Process the audio
        frame = await service.process_audio_bytes(audio_data)
        
        return {
            "success": True,
            "frame": frame.to_dict(),
            "filename": file.filename
        }
        
    except Exception as e:
        logger.error(f"Error processing audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process-chunk")
async def process_audio_chunk(
    audio_base64: str = None,
    session_id: str = "default"
):
    """
    Process a base64-encoded audio chunk for visualization.
    
    Used for REST-based real-time visualization (polling mode).
    """
    try:
        if not audio_base64:
            raise HTTPException(status_code=400, detail="No audio data provided")
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_base64)
        
        service = get_visualization_service()
        frame = await service.process_stream_chunk(audio_bytes, session_id)
        
        return frame.to_dict()
        
    except Exception as e:
        logger.error(f"Error processing chunk: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train")
async def force_train_umap():
    """Force UMAP training with current collected samples."""
    service = get_visualization_service()
    success = service.force_train_umap()
    
    if success:
        return {"status": "training_started", "message": "UMAP training initiated"}
    else:
        status = service.get_status()
        return {
            "status": "cannot_train",
            "message": "Not enough samples or already training",
            "samples": status['umap']['training_samples'],
            "needed": 10
        }


@router.websocket("/ws/{session_id}")
async def visualization_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time audio visualization.
    
    Client sends: Raw audio bytes (16-bit PCM, 16kHz)
    Server sends: JSON with 3D coordinates and audio features
    
    Message format (from server):
    {
        "timestamp": float,
        "coords": {"x": float, "y": float, "z": float},
        "rms": float,
        "centroid": float,
        "is_trained": bool,
        "training_progress": float
    }
    """
    await ws_manager.connect(websocket, session_id)
    is_connected = True
    
    async def safe_send_json(data: dict) -> bool:
        """Safely send JSON, returns False if connection is closed."""
        nonlocal is_connected
        if not is_connected:
            return False
        try:
            await websocket.send_json(data)
            return True
        except Exception:
            is_connected = False
            return False
    
    try:
        service = ws_manager.get_service(session_id)
        if not service:
            try:
                await websocket.close(code=1011, reason="Service initialization failed")
            except Exception:
                pass
            return
        
        # Send initial status
        await safe_send_json({
            "type": "connected",
            "session_id": session_id,
            "status": service.get_status()
        })
        
        while is_connected:
            try:
                # Receive audio data
                data = await websocket.receive()
                
                # Check for disconnect message
                if data.get("type") == "websocket.disconnect":
                    break
                
                if "bytes" in data:
                    # Process binary audio data
                    audio_bytes = data["bytes"]
                    frame = await service.process_stream_chunk(audio_bytes, session_id)
                    
                    if not await safe_send_json({
                        "type": "frame",
                        **frame.to_dict()
                    }):
                        break
                    
                elif "text" in data:
                    # Handle text commands
                    try:
                        message = json.loads(data["text"])
                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid JSON received: {e}")
                        continue
                    
                    if message.get("type") == "audio":
                        # Base64 encoded audio
                        audio_bytes = base64.b64decode(message["data"])
                        frame = await service.process_stream_chunk(audio_bytes, session_id)
                        
                        if not await safe_send_json({
                            "type": "frame",
                            **frame.to_dict()
                        }):
                            break
                        
                    elif message.get("type") == "reset":
                        service.reset(reset_umap=message.get("reset_umap", True))
                        if not await safe_send_json({
                            "type": "reset",
                            "status": service.get_status()
                        }):
                            break
                        
                    elif message.get("type") == "train":
                        success = service.force_train_umap()
                        if not await safe_send_json({
                            "type": "train",
                            "success": success,
                            "status": service.get_status()
                        }):
                            break
                        
                    elif message.get("type") == "status":
                        if not await safe_send_json({
                            "type": "status",
                            "status": service.get_status()
                        }):
                            break
                        
            except WebSocketDisconnect:
                logger.debug(f"WebSocket disconnect received: {session_id}")
                break
            except Exception as e:
                if "disconnect" in str(e).lower():
                    break
                logger.warning(f"WebSocket processing warning: {e}")
                # Don't try to send error if connection might be closed
                if is_connected:
                    if not await safe_send_json({
                        "type": "error",
                        "message": str(e)
                    }):
                        break
                
    except WebSocketDisconnect:
        logger.debug(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        if "disconnect" not in str(e).lower():
            logger.error(f"WebSocket error: {e}")
    finally:
        is_connected = False
        ws_manager.disconnect(session_id)


@router.get("/training-progress/{session_id}")
async def get_training_progress(session_id: str):
    """Get UMAP training progress for a session."""
    service = ws_manager.get_service(session_id)
    if not service:
        service = get_visualization_service()
    
    status = service.get_status()
    return {
        "session_id": session_id,
        "umap": status['umap']
    }

