"""
Echo Backend - Main FastAPI Application
"""
from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import asyncio
import logging
import signal
import sys
from typing import Optional
import json
import os

# Import required services - no fallbacks
from .stt.whisper_service import WhisperSTT
from .llm.ollama_service import OllamaLLM
from .tts.piper_service import PiperTTS
from .database.models import init_database, Conversation, save_conversation, get_recent_conversations
from .websocket.manager import WebSocketManager
import yaml

# Load configuration
with open("config.yaml", "r") as f:
    config = yaml.safe_load(f)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Echo API",
    description="Privacy-focused voice assistant with local LLM processing",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services - no fallbacks, real services only
stt_service = WhisperSTT()
logger.info("Whisper STT service initialized")

llm_service = OllamaLLM()
logger.info("Ollama LLM service initialized")

tts_service = PiperTTS()
logger.info("Piper TTS service initialized")

ws_manager = WebSocketManager()

@app.on_event("startup")
async def startup_event():
    """Initialize services"""
    try:
        init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

    logger.info("Echo backend started")
    logger.info("All services initialized successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup services on shutdown"""
    logger.info("Shutting down Echo backend...")

    try:
        # Clean up Whisper model resources
        if hasattr(stt_service, 'cleanup'):
            logger.info("Cleaning up Whisper service...")
            stt_service.cleanup()
        elif hasattr(stt_service, 'model') and stt_service.model is not None:
            logger.info("Cleaning up Whisper model...")
            # Try to properly close the model
            try:
                del stt_service.model
                stt_service.model = None
            except Exception as e:
                logger.warning(f"Error cleaning up Whisper model: {e}")

        # Clean up LLM service
        if hasattr(llm_service, 'cleanup'):
            logger.info("Cleaning up LLM service...")
            llm_service.cleanup()
        # Ollama client doesn't need explicit cleanup

        # Clean up TTS service
        if hasattr(tts_service, 'cleanup'):
            logger.info("Cleaning up TTS service...")
            tts_service.cleanup()
        # Piper service cleanup if needed

        logger.info("Service cleanup completed")

    except Exception as e:
        logger.error(f"Error during shutdown cleanup: {e}")

    logger.info("Echo backend shutdown complete")

@app.get("/")
async def root():
    return {"message": "Echo API", "status": "running"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "services": {
            "stt": "ready",
            "llm": "ready",
            "tts": "ready"
        }
    }

@app.post("/api/voice/process")
async def process_voice_audio(file: UploadFile = File(...)):
    """
    Process uploaded voice audio file
    Returns transcribed text and LLM response
    """
    try:
        # Read audio file
        audio_data = await file.read()
        logger.info(f"Received audio file: {file.filename}, size: {len(audio_data)} bytes")

        # Check if audio data is valid
        if len(audio_data) < 100:
            logger.warning(f"Audio data too small: {len(audio_data)} bytes")
            return {
                "transcript": "Audio data too small - no speech detected",
                "response": "Please speak for longer or check your microphone.",
                "audio_length": len(audio_data)
            }

        # Step 1: Speech to Text
        logger.info("Transcribing audio...")
        transcript_text = await stt_service.transcribe_audio(audio_data)
        stt_info = stt_service.get_model_info()

        # Step 2: LLM Processing
        logger.info("Generating LLM response...")
        llm_result = await llm_service.generate_response(transcript_text)
        response_text = llm_result.get("answer", "")

        # Step 3: Text to Speech
        logger.info(f"Synthesizing speech for text: '{response_text[:100]}...'")
        audio_response = await tts_service.synthesize_speech(response_text)
        tts_info = tts_service.get_voice_info()
        logger.info(f"TTS result: {len(audio_response) if audio_response else 0} bytes for text length {len(response_text)}")

        pipeline_metadata = {
            "stt": {**stt_info, "transcript": transcript_text},
            "llm": llm_result,
            "tts": {
                **tts_info,
                "audio_bytes": len(audio_response) if audio_response else 0,
                "character_count": len(response_text)
            }
        }

        # Step 4: Save conversation to database
        try:
            conversation = save_conversation(
                user_input=transcript_text,
                assistant_response=response_text,
                audio_path=None,  # Could save audio file path here
                conversation_metadata=pipeline_metadata
            )
            logger.info(f"Conversation saved to database: {conversation.id}")
        except Exception as e:
            logger.error(f"Failed to save conversation: {e}")
            raise HTTPException(status_code=500, detail="Failed to save conversation")

        import base64

        return {
            "transcript": transcript_text,
            "response": response_text,
            "audio_length": len(audio_response) if audio_response else 0,
            "audio_data": base64.b64encode(audio_response).decode('utf-8') if audio_response else None,
            "llm_metadata": llm_result,
            "pipeline": pipeline_metadata
        }

    except Exception as e:
        logger.error(f"Error processing voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/conversations")
async def get_conversations(limit: int = 10, offset: int = 0):
    """Get conversation history"""
    try:
        conversations = get_recent_conversations(limit=limit, offset=offset)
        return {"conversations": [conv.to_dict() for conv in conversations]}
    except Exception as e:
        logger.error(f"Error retrieving conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve conversation history")

@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time voice processing"""
    await ws_manager.connect(websocket)

    try:
        while True:
            # Receive audio data
            data = await websocket.receive_bytes()

            # Process audio in real-time
            text = await stt_service.transcribe_audio(data)
            llm_result = await llm_service.generate_response(text)
            response = llm_result.get("answer", "")
            audio_response = await tts_service.synthesize_speech(response)

            # Send response back
            await websocket.send_json({
                "transcript": text,
                "response": response,
                "audio_data": audio_response.hex() if audio_response else None,
                "llm_metadata": llm_result
            })

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket)

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    sys.exit(0)

# Register signal handlers for graceful shutdown
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == "__main__":
    # Configure multiprocessing to avoid resource leaks
    import multiprocessing
    import warnings

    # Set multiprocessing start method from config
    start_method = config.get('multiprocessing', {}).get('start_method', 'fork')
    try:
        multiprocessing.set_start_method(start_method, force=True)
        logger.info(f"Set multiprocessing start method to: {start_method}")
    except RuntimeError:
        # Method already set, ignore
        logger.info("Multiprocessing start method already set")

    # Suppress multiprocessing resource warnings if configured
    if config.get('multiprocessing', {}).get('disable_warnings', True):
        warnings.filterwarnings("ignore", category=UserWarning, module="multiprocessing.resource_tracker")
        logger.info("Multiprocessing resource warnings suppressed")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
