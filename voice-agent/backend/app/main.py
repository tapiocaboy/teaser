"""
Voice Agent Backend - Main FastAPI Application
"""
from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import asyncio
import logging
from typing import Optional
import json

# Import required services - no fallbacks
from .stt.whisper_service import WhisperSTT
from .llm.ollama_service import OllamaLLM
from .tts.piper_service import PiperTTS
from .database.models import init_database, Conversation, save_conversation
from .websocket.manager import WebSocketManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Voice Agent API",
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

    logger.info("Voice Agent backend started")
    logger.info("All services initialized successfully")

@app.get("/")
async def root():
    return {"message": "Voice Agent API", "status": "running"}

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
        text = await stt_service.transcribe_audio(audio_data)

        # Step 2: LLM Processing
        logger.info("Generating LLM response...")
        response = await llm_service.generate_response(text)

        # Step 3: Text to Speech
        logger.info(f"Synthesizing speech for text: '{response[:100]}...'")
        audio_response = await tts_service.synthesize_speech(response)
        logger.info(f"TTS result: {len(audio_response) if audio_response else 0} bytes for text length {len(response)}")

        # Step 4: Save conversation to database
        try:
            conversation = save_conversation(
                user_input=text,
                assistant_response=response,
                audio_path=None  # Could save audio file path here
            )
            logger.info(f"Conversation saved to database: {conversation.id}")
        except Exception as e:
            logger.error(f"Failed to save conversation: {e}")
            raise HTTPException(status_code=500, detail="Failed to save conversation")

        import base64

        return {
            "transcript": text,
            "response": response,
            "audio_length": len(audio_response) if audio_response else 0,
            "audio_data": base64.b64encode(audio_response).decode('utf-8') if audio_response else None
        }

    except Exception as e:
        logger.error(f"Error processing voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/conversations")
async def get_conversations(limit: int = 10, offset: int = 0):
    """Get conversation history"""
    try:
        conversations = Conversation.get_recent(limit=limit, offset=offset)
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
            response = await llm_service.generate_response(text)
            audio_response = await tts_service.synthesize_speech(response)

            # Send response back
            await websocket.send_json({
                "transcript": text,
                "response": response,
                "audio_data": audio_response.hex() if audio_response else None
            })

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
