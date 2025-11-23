# Teaser 🎭

**Local, privacy-first voice assistant with real-time STT, LLM inference, and TTS synthesis.**

## 🏗️ Technical Stack

| Component | Technology | Details |
|-----------|------------|---------|
| **Frontend** | React + Material-UI | Real-time audio visualization, theme system |
| **Backend** | Python 3.10+ FastAPI | Async processing, WebSocket support |
| **STT** | faster-whisper | Base model, CPU/GPU support, ~300ms latency |
| **LLM** | Ollama | Mistral/Llama 3.2, local inference |
| **TTS** | Piper | ONNX-based neural TTS, 22kHz output |
| **Database** | SQLite + SQLAlchemy | Conversation persistence |
| **Audio** | Web Audio API | PCM processing, real-time analysis |

## 🚀 Installation

### System Requirements

```
Python 3.10+ (3.13 recommended)
Node.js 18+
Poetry (pip install poetry)
Ollama (local LLM server)
ffmpeg (audio processing)
```

### Automated Setup

```bash
cd voice-agent && chmod +x setup.sh && ./setup.sh
```

Installs: Ollama + models, Python deps, Node deps, AI models, starts services.

### Manual Setup

```bash
# 1. Ollama + LLM models
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull mistral

# 2. Backend dependencies
cd voice-agent/backend && poetry install

# 3. Frontend dependencies
cd ../frontend && npm install

# 4. Start services (3 terminals)
ollama serve                    # Terminal 1
poetry run start               # Terminal 2 (backend/)
npm start                      # Terminal 3 (frontend/)

# Access: http://localhost:3000
```

**Note**: Whisper and Piper models download automatically on first use (~100MB each).

## 📁 Structure

```
voice-agent/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, HTTP endpoints
│   │   ├── stt/whisper_service.py
│   │   ├── llm/ollama_service.py
│   │   ├── tts/piper_service.py
│   │   ├── database/models.py
│   │   └── websocket/manager.py
│   ├── config.yaml              # Service configuration
│   ├── pyproject.toml           # Poetry dependencies
│   └── models/                  # Auto-downloaded models
├── frontend/
│   ├── src/
│   │   ├── components/          # React UI components
│   │   ├── services/            # API client, audio handling
│   │   └── App.js               # Theme configs, routing
│   └── package.json
└── docker-compose.yml           # Multi-container deployment
```

## 🎯 Execution

### Development

```bash
# Terminal 1: LLM server
ollama serve

# Terminal 2: Backend (auto-reload)
cd backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3: Frontend (hot-reload)
cd frontend && npm start
```

### Production (Docker)

```bash
docker-compose up --build -d
```

Services: Backend (8000), Frontend (3000), Ollama (11434)

## 📡 API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Health check |
| `/health` | GET | Service status (STT/LLM/TTS availability) |
| `/api/voice/process` | POST | Process audio (multipart/form-data) |
| `/api/conversations` | GET | Conversation history (paginated) |
| `/ws/voice` | WebSocket | Real-time streaming (future) |

## 🎤 Pipeline

```
User Audio (WebM/WAV)
    ↓ [Blob → FormData]
POST /api/voice/process
    ↓ [faster-whisper]
Text Transcript
    ↓ [Ollama API]
LLM Response
    ↓ [Piper ONNX]
Audio WAV (base64)
    ↓ [Web Audio API]
Playback + Storage
```

**Processing Time**: ~2s end-to-end (STT: 300ms, LLM: 1.5s, TTS: 200ms)

## 🎨 Features

- **Three Theme System**: Neon Pulse, DSP Matrix, Synthwave Dream
- **Real-time Audio Visualization**: Waveform + frequency analysis
- **Particle Animations**: Theme-specific slow-motion effects
- **Conversation Persistence**: SQLite with full history
- **Dual Playback**: Original recording + AI response
- **Theme Persistence**: localStorage-based preference saving

## ⚙️ Configuration

### `backend/config.yaml`

```yaml
stt:
  model: "base"                    # tiny/base/small/medium/large
  device: "cpu"                    # cpu/cuda
  compute_type: "int8"             # int8/float16/float32
  
llm:
  model: "mistral"                 # Any Ollama model
  temperature: 0.7
  max_tokens: 500
  
tts:
  model: "en_US-amy-medium"        # Piper voice model
  speaker_id: 0
  length_scale: 1.0                # Speech speed
  noise_scale: 0.667
  sample_rate: 22050
  
database:
  url: "sqlite:///./data/conversations.db"
```

### Environment Variables

**Frontend** (`.env`):
```bash
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_MAX_AUDIO_DURATION=30
```

**Backend** (`.env`):
```bash
OLLAMA_BASE_URL=http://localhost:11434
DATABASE_URL=sqlite:///./data/conversations.db
LOG_LEVEL=INFO
```

## 📊 Performance

| Component | Latency | Model Size | Notes |
|-----------|---------|------------|-------|
| STT (Whisper base) | ~300ms | 74MB | CPU int8 quantized |
| LLM (Mistral 7B) | ~1.5s | 4.1GB | Depends on prompt length |
| TTS (Piper) | ~200ms | 63MB | ONNX optimized |
| **Total Pipeline** | **~2s** | - | Includes network overhead |

**Hardware**: M1/M2 Mac or modern x86_64 CPU recommended. GPU optional but improves STT/LLM by 2-3x.

## 🚧 Known Issues

| Issue | Impact | Workaround |
|-------|--------|------------|
| Safari audio encoding | WebM not supported | Auto-fallback to WAV |
| Large audio files (>5min) | Memory pressure | Chunk processing planned |
| First request slow | Model loading | Keep services warm |
| Piper voice quality | Robotic on some models | Try different voice models |

## 🔮 Roadmap

- [ ] WebSocket streaming for real-time responses
- [ ] GPU acceleration toggle in UI
- [ ] Voice activity detection (VAD)
- [ ] Multi-language support (Whisper multilingual)
- [ ] Custom Piper voice training
- [ ] Conversation export (JSON/Markdown)

## 🛠️ Development

### Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI routes, HTTP endpoints |
| `backend/app/stt/whisper_service.py` | Whisper integration |
| `backend/app/llm/ollama_service.py` | Ollama API client |
| `backend/app/tts/piper_service.py` | Piper TTS synthesis |
| `frontend/src/services/ApiService.js` | HTTP client, audio upload |
| `frontend/src/services/AudioService.js` | MediaRecorder, audio analysis |
| `frontend/src/components/VoiceInterface.js` | Main UI component |

### Extending

**Add new LLM provider**:
1. Create `backend/app/llm/new_provider.py`
2. Implement `generate()` method
3. Update `config.yaml` with provider settings

**Add new theme**:
1. Add config to `THEME_CONFIGS` in `App.js`
2. Add styles to `themeStyles` in `VoiceInterface.js`
3. Update `ParticleBackground.js` particle config

## 🚨 Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Model not found` | LLM not downloaded | `ollama pull mistral` |
| `Port already in use` | Service running | `lsof -ti:8000,3000 \| xargs kill -9` |
| `Microphone not accessible` | Browser permissions | Check HTTPS or localhost only |
| `Module not found (Python)` | Dependencies missing | `poetry install` in backend/ |
| `Module not found (Node)` | Dependencies missing | `npm install` in frontend/ |
| `python-multipart error` | Wrong execution context | Use `poetry run` prefix |
| `Slow LLM responses` | CPU bottleneck | Use smaller model or GPU |
| `TTS silent output` | Piper model issue | Check logs, re-download model |

**Debug Mode**:
```bash
# Backend verbose logging
LOG_LEVEL=DEBUG poetry run start

# Frontend console logs
# Open browser DevTools → Console
```

## 📚 References

- **STT**: [faster-whisper](https://github.com/SYSTRAN/faster-whisper) - CTranslate2-optimized Whisper
- **LLM**: [Ollama](https://github.com/ollama/ollama) - Local LLM runtime
- **TTS**: [Piper](https://github.com/rhasspy/piper) - Neural TTS with VITS
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- **Frontend**: [React](https://react.dev/) + [Material-UI](https://mui.com/)

## 📄 License

Apache License 2.0 - See [LICENSE](LICENSE) file for details
