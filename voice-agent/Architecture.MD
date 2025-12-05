# Echo Architecture

## Overview

Echo is a fully local, privacy-focused voice assistant that processes speech-to-text, generates LLM responses, and synthesizes speech-to-text - all running locally on the user's machine without any cloud dependencies.

## Locally Running LLMs and Models

### 1. Speech-to-Text (STT)
- **Model**: Whisper (via faster-whisper library)
- **Supported Sizes**: `tiny`, `base`, `small`, `medium`, `large`
- **Default Model**: `base` (configurable in `config.yaml`)
- **Device Support**: CPU/CUDA
- **Compute Types**: `int8`, `float16`, `float32`
- **Audio Processing**: 16kHz mono WAV conversion using ffmpeg
- **Language Detection**: Auto-detection with manual override support

### 2. Large Language Model (LLM)
- **Platform**: Ollama
- **Supported Models**:
  - `mistral` (default)
  - `llama3.2`
  - `llama2`
  - Any other Ollama-compatible model
- **Temperature**: 0.7 (configurable)
- **Max Tokens**: 512 (configurable)
- **Context Window**: 4096 tokens (configurable)
- **Features**: Conversation history, streaming responses

### 3. Text-to-Speech (TTS)
- **Model**: Piper TTS
- **Voice Models**: `en_US-amy-medium` (default)
- **Supported Voices**: Any Piper-compatible voice model
- **Audio Format**: 44.1kHz WAV (converted from Piper's native format)
- **Parameters**:
  - Speed: 1.0
  - Noise Scale: 0.667
  - Noise W: 0.8
  - Length Scale: 1.0
- **Fallback**: Sine wave generation (440Hz) when Piper models unavailable

## System Prompts

### Default System Prompt
```
You are a helpful, intelligent voice assistant. Keep your responses clear and concise since they will be spoken aloud.
```

### Streaming System Prompt
```
You are a helpful voice assistant. Keep responses clear and concise.
```

### Custom System Prompts
The system supports custom system prompts that can be passed programmatically:

```python
# Example of custom system prompt usage
response = await llm_service.generate_response(
    prompt=user_input,
    system_prompt="You are a technical expert. Provide detailed explanations with code examples."
)
```

## Architecture Components

### Backend (FastAPI)
- **Framework**: Python FastAPI
- **Endpoints**:
  - `POST /api/voice/process` - Main voice processing
  - `GET /api/conversations` - Conversation history
  - `WebSocket /ws/voice` - Real-time streaming (available but not used by frontend)
- **Services**: Modular architecture with STT, LLM, TTS services
- **Database**: SQLite with SQLAlchemy ORM
- **CORS**: Configured for localhost:3000

### Frontend (React)
- **Framework**: React with Material-UI
- **Features**:
  - Real-time audio recording and visualization
  - Conversation display with summaries
  - Audio playback (recording and AI response)
  - Dark theme with particle animations
- **Audio Processing**: Web Audio API with MediaRecorder

## Data Flow

```
User Speech → Web Audio API → Backend → STT (Whisper) → LLM (Ollama) → TTS (Piper) → Audio Response
     ↓              ↓            ↓          ↓               ↓          ↓             ↓
   Browser      MediaRecorder  FastAPI   faster-whisper  Mistral   Piper TTS   Web Audio
```

## Configuration

### config.yaml Structure
```yaml
models:
  stt:
    model_size: "base"  # tiny, base, small, medium, large
    device: "cpu"       # cpu, cuda
    compute_type: "int8" # int8, float16, float32

  llm:
    model: "mistral"    # mistral, llama3.2, llama2
    temperature: 0.7
    max_tokens: 512
    context_window: 4096

  tts:
    voice_model: "en_US-amy-medium"
    speed: 1.0
    noise_scale: 0.667
    noise_w: 0.8
    length_scale: 1.0
```

## Performance Characteristics

- **STT Latency**: ~300ms (base model)
- **LLM Response**: ~1.5s (Mistral)
- **TTS Generation**: ~200ms (Piper)
- **End-to-End**: ~2s total processing time
- **Memory Usage**: ~2-4GB RAM (depending on model sizes)

## Privacy & Security

- **Fully Local**: All processing happens on user's machine
- **No Cloud Dependencies**: Zero data sent to external servers
- **SQLite Storage**: Local conversation history
- **No Telemetry**: No usage tracking or data collection

## Dependencies

### Python (Backend)
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `faster-whisper` - STT processing
- `ollama` - LLM client
- `piper-tts` - Text-to-speech
- `sqlalchemy` - Database ORM
- `pydub` - Audio processing
- `scipy` - Scientific computing
- `numpy` - Numerical computing

### Node.js (Frontend)
- `react` - UI framework
- `@mui/material` - Component library
- `@tsparticles/react` - Particle animations
- `axios` - HTTP client
- `wavesurfer.js` - Audio visualization

## Model Storage

```
voice-agent/
├── models/
│   ├── whisper/     # STT models (auto-downloaded)
│   └── piper/       # TTS models (manual download)
├── data/
│   └── conversations.db  # SQLite database
└── backend/
    └── logs/        # Application logs
```

## Setup Requirements

### Prerequisites
- Python 3.10+
- Node.js 18+
- Ollama installed and running
- ffmpeg for audio processing
- ~8GB free disk space for models

### Model Downloads
```bash
# LLM Models
ollama pull mistral
ollama pull llama3.2

# TTS Voice Models (optional)
# Models auto-download on first use, or manual download:
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-en-us-amy-medium.tar.gz
```

## Error Handling

- **STT Fallback**: Returns "No speech detected" for failed transcriptions
- **LLM Fallback**: Returns generic error message for failed generations
- **TTS Fallback**: Generates sine wave tone when Piper unavailable
- **Database Errors**: Logged but don't break main functionality

## Future Enhancements

- **GPU Acceleration**: CUDA support for faster processing
- **Multi-Language Support**: Additional Whisper languages
- **Voice Activity Detection**: Automatic silence filtering
- **Real-time Streaming**: WebSocket-based continuous conversation
- **Custom Voice Models**: User-trained Piper voices
