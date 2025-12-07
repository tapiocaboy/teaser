"""
Echo Backend - Main FastAPI Application
Supports both local (Whisper/Ollama/Piper) and AWS (Transcribe/Bedrock/Polly) services.
Set IS_AWS=true environment variable to use AWS services.
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

# Import service factory for conditional service loading
from .services.factory import get_all_services, is_aws_enabled
from .websocket.manager import WebSocketManager
import yaml

# Load configuration
config_path = os.getenv("CONFIG_PATH", "config.yaml")
if os.path.exists(config_path):
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
else:
    config = {}
    logging.warning(f"Config file not found at {config_path}, using defaults")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Echo API",
    description="Privacy-focused voice assistant - supports local or AWS processing",
    version="1.1.0"
)

# Add CORS middleware
allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services using the factory pattern
# This will use AWS services if IS_AWS=true, otherwise local services
logger.info(f"Initializing Echo services (IS_AWS={is_aws_enabled()})")
stt_service, llm_service, tts_service, storage_service = get_all_services()

ws_manager = WebSocketManager()

@app.on_event("startup")
async def startup_event():
    """Initialize services"""
    try:
        # For local mode, initialize SQLite database
        if not is_aws_enabled():
            from .database.models import init_database
            init_database()
            logger.info("Local database initialized successfully")
        else:
            logger.info("Using AWS DynamoDB for storage")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

    mode = "AWS" if is_aws_enabled() else "Local"
    logger.info(f"Echo backend started in {mode} mode")
    logger.info("All services initialized successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup services on shutdown"""
    logger.info("Shutting down Echo backend...")

    try:
        # Clean up all services
        if hasattr(stt_service, 'cleanup'):
            logger.info("Cleaning up STT service...")
            stt_service.cleanup()

        if hasattr(llm_service, 'cleanup'):
            logger.info("Cleaning up LLM service...")
            llm_service.cleanup()

        if hasattr(tts_service, 'cleanup'):
            logger.info("Cleaning up TTS service...")
            tts_service.cleanup()

        if hasattr(storage_service, 'cleanup'):
            logger.info("Cleaning up storage service...")
            storage_service.cleanup()

        logger.info("Service cleanup completed")

    except Exception as e:
        logger.error(f"Error during shutdown cleanup: {e}")

    logger.info("Echo backend shutdown complete")

@app.get("/")
async def root():
    return {
        "message": "Echo API",
        "status": "running",
        "mode": "aws" if is_aws_enabled() else "local"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    mode = "aws" if is_aws_enabled() else "local"
    
    # Get service info
    stt_info = stt_service.get_model_info() if hasattr(stt_service, 'get_model_info') else {}
    tts_info = tts_service.get_voice_info() if hasattr(tts_service, 'get_voice_info') else {}
    
    return {
        "status": "healthy",
        "mode": mode,
        "services": {
            "stt": stt_info.get("service", "ready"),
            "llm": "AWS Bedrock" if is_aws_enabled() else "Ollama",
            "tts": tts_info.get("service", "ready"),
            "storage": "AWS DynamoDB/S3" if is_aws_enabled() else "SQLite/Local"
        }
    }

@app.get("/api/info")
async def get_service_info():
    """Get detailed service information"""
    stt_info = stt_service.get_model_info() if hasattr(stt_service, 'get_model_info') else {}
    tts_info = tts_service.get_voice_info() if hasattr(tts_service, 'get_voice_info') else {}
    
    llm_info = {}
    if hasattr(llm_service, 'get_available_models'):
        llm_info["available_models"] = llm_service.get_available_models()
    if hasattr(llm_service, 'model_id'):
        llm_info["current_model"] = llm_service.model_id
    
    return {
        "mode": "aws" if is_aws_enabled() else "local",
        "stt": stt_info,
        "llm": llm_info,
        "tts": tts_info,
        "environment": {
            "IS_AWS": is_aws_enabled(),
            "AWS_REGION": os.getenv("AWS_REGION", "not set") if is_aws_enabled() else "N/A"
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
        stt_info = stt_service.get_model_info() if hasattr(stt_service, 'get_model_info') else {}

        # Step 2: LLM Processing
        logger.info("Generating LLM response...")
        llm_result = await llm_service.generate_response(transcript_text)
        response_text = llm_result.get("answer", "")

        # Step 3: Text to Speech
        logger.info(f"Synthesizing speech for text: '{response_text[:100]}...'")
        audio_response = await tts_service.synthesize_speech(response_text)
        tts_info = tts_service.get_voice_info() if hasattr(tts_service, 'get_voice_info') else {}
        logger.info(f"TTS result: {len(audio_response) if audio_response else 0} bytes for text length {len(response_text)}")

        pipeline_metadata = {
            "stt": {**stt_info, "transcript": transcript_text},
            "llm": llm_result,
            "tts": {
                **tts_info,
                "audio_bytes": len(audio_response) if audio_response else 0,
                "character_count": len(response_text)
            },
            "mode": "aws" if is_aws_enabled() else "local"
        }

        # Step 4: Save conversation to storage
        try:
            if is_aws_enabled():
                # Use AWS storage service
                conversation_id = await storage_service.save_conversation(
                    user_input=transcript_text,
                    assistant_response=response_text,
                    metadata=pipeline_metadata
                )
                logger.info(f"Conversation saved to DynamoDB: {conversation_id}")
            else:
                # Use local database
                from .database.models import save_conversation
                conversation = save_conversation(
                    user_input=transcript_text,
                    assistant_response=response_text,
                    audio_path=None,
                    conversation_metadata=pipeline_metadata
                )
                logger.info(f"Conversation saved to local database: {conversation.id}")
        except Exception as e:
            logger.error(f"Failed to save conversation: {e}")
            # Don't fail the whole request if storage fails
            logger.warning("Continuing without saving conversation")

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
        if is_aws_enabled():
            # Use AWS storage service
            conversations = await storage_service.get_recent_conversations(limit=limit, offset=offset)
            return {"conversations": conversations}
        else:
            # Use local database
            from .database.models import get_recent_conversations
            conversations = get_recent_conversations(limit=limit, offset=offset)
            return {"conversations": [conv.to_dict() for conv in conversations]}
    except Exception as e:
        logger.error(f"Error retrieving conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve conversation history")

@app.post("/api/summarize")
async def summarize_conversation(request: dict):
    """
    Summarize text using the LLM service (AWS Bedrock or Ollama)
    """
    try:
        text = request.get("text", "")
        max_length = request.get("max_length", 100)
        
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        if hasattr(llm_service, 'summarize_text'):
            summary = await llm_service.summarize_text(text, max_length)
            return {"summary": summary}
        else:
            # Fallback to generate_response
            prompt = f"Please summarize the following in {max_length} words or less: {text}"
            result = await llm_service.generate_response(prompt)
            return {"summary": result.get("answer", "")}
            
    except Exception as e:
        logger.error(f"Error summarizing text: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
