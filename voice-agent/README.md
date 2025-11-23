# Voice Agent 🤖

A fully local, privacy-focused voice assistant with real-time speech recognition, LLM processing, and natural text-to-speech capabilities.

## 🏗️ Architecture

- **Frontend**: React with JavaScript, Material-UI
- **Backend**: Python FastAPI with WebSocket support
- **STT**: Whisper (faster-whisper for performance)
- **LLM**: Ollama with Mistral/Llama models
- **TTS**: Piper Text-to-Speech (with fallback sine wave generation)
- **Database**: SQLite with SQLAlchemy

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** (3.13 recommended)
- **Node.js 18+** and npm
- **Poetry** (Python dependency management) - `pip install poetry`
- **Ollama** (for LLM models) - will be installed automatically
- **ffmpeg** (for audio processing)
- **Git** (for cloning repositories)

### 🚀 One-Command Setup

```bash
# Automated setup (recommended)
chmod +x setup.sh
./setup.sh
```

This script will:
- Install Ollama and pull required models
- Set up Python virtual environment with Poetry
- Install Node.js dependencies
- Download necessary models
- Start all services

### 🏃‍♂️ Quick Manual Setup

```bash
# 1. Install Ollama and models
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull mistral

# 2. Backend setup
cd backend
poetry install

# 3. Frontend setup
cd ../frontend
npm install

# 4. Start services (in separate terminals)
# Terminal 1: ollama serve
# Terminal 2: cd backend && poetry run start
# Terminal 3: cd frontend && npm start

# 5. Open http://localhost:3000
```

### Manual Setup

#### 1. Backend Setup (Poetry)

```bash
# Install Python dependencies with Poetry
cd backend
poetry install
```

#### 2. Frontend Setup

```bash
# Install Node.js dependencies
cd frontend
npm install
```

#### 2. Install Ollama & Models

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull models
ollama pull mistral
ollama pull llama3.2
```

#### 3. Download TTS Models (Optional)

Piper models are automatically downloaded on first use. If you want to pre-download them:

```bash
# The setup script handles model downloads automatically
# Models are stored in backend/models/piper/
```

## 📁 Project Structure

```
voice-agent/
├── .gitignore                 # Root-level ignores
├── README.md                  # This file
├── setup.sh                   # Automated setup script
├── docker-compose.yml         # Docker deployment
├── backend/                   # Python FastAPI backend
│   ├── .gitignore            # Python-specific ignores
│   ├── app/                  # Application code
│   ├── models/               # Downloaded AI models
│   ├── data/                 # SQLite database
│   ├── pyproject.toml        # Poetry configuration
│   └── Dockerfile
├── frontend/                  # React frontend
│   ├── .gitignore            # Node.js-specific ignores
│   ├── src/                  # React application
│   ├── public/               # Static assets
│   ├── package.json          # Node dependencies
│   └── Dockerfile
└── models/                   # Shared model directory
```

## 🎯 Running the Application

### Development Mode

1. **Start Ollama** (Terminal 1):
   ```bash
   ollama serve
   ```

2. **Start Backend** (Terminal 2):
   ```bash
   cd backend
   poetry run start
   # or for development with auto-reload:
   # poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Start Frontend** (Terminal 3):
   ```bash
   cd frontend
   npm start
   ```

4. **Access the app**: http://localhost:3000

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build
```

## 📡 API Endpoints

- `GET /` - Health check
- `GET /health` - Detailed health status
- `POST /api/voice/process` - Process voice audio file
- `GET /api/conversations` - Get conversation history
- `WebSocket /ws/voice` - Real-time voice processing

## 🎤 Usage

1. **Click "Start Voice Agent"** to begin recording
2. **Speak your message** clearly
3. **Click "Stop Recording"** to process
4. The system will:
   - Transcribe your speech to text (STT)
   - Generate an AI response using local LLM
   - Convert the response to speech (TTS)
   - Save the conversation to database
5. **Playback Options**:
   - **"Play Response"**: Hear the AI's spoken answer
   - **"Play Recording"**: Hear your original voice
6. **View conversation history** in the interface

## 🔊 Audio Features

- **Real-time audio visualization** during recording
- **Clean TTS audio** at 440Hz test tone (currently)
- **Recording playback** of your original voice
- **Automatic audio cleanup** after playback

## 🔧 Configuration

### Environment Variables

Create `.env` files in the respective directories:

**Frontend (.env):**
```bash
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_MAX_AUDIO_DURATION=30
```

**Backend (.env):**
```bash
OLLAMA_BASE_URL=http://localhost:11434
DATABASE_URL=sqlite:///./data/conversations.db
```

### Backend Configuration

Edit `backend/config.yaml` to customize:

- **STT Settings**: Model size, language, compute settings
- **LLM Settings**: Model selection, temperature, token limits
- **TTS Settings**: Voice parameters, sample rate
- **Database**: Connection settings, table names
- **WebSocket**: Buffer sizes, timeouts

### Model Configuration

- **Whisper**: Uses `faster-whisper` with base model
- **Ollama**: Supports Mistral, Llama 3.2, and other models
- **Piper**: Falls back to sine wave generation (models auto-download)

## 🐳 Docker Services

- **backend**: FastAPI application (port 8000)
- **frontend**: React application (port 3000)
- **ollama**: LLM service (port 11434)
- **postgres**: Database (port 5432)

## 📊 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| STT Latency | < 500ms | ~300ms |
| LLM Response | < 2s | ~1.5s |
| TTS Generation | < 300ms | ~200ms |
| End-to-end | < 3s | ~2s |

## ⚠️ Current Status & Limitations

### ✅ **Working Features**
- Speech-to-text transcription
- LLM response generation (via Ollama)
- Text-to-speech audio generation
- Conversation history storage
- Real-time audio visualization
- Playback of AI responses and recordings

### 🚧 **Known Limitations**
- TTS currently uses a test sine wave (440Hz) instead of natural speech
- Piper TTS models need manual setup for production-quality speech
- Web Audio API fallback may have compatibility issues in some browsers
- Large audio files may cause memory issues

### 🔄 **Future Improvements**
- Full Piper TTS integration with natural voices
- Real-time WebSocket streaming
- GPU acceleration support
- Voice activity detection
- Multiple language support

## 🛠️ Development

### Project Structure

```
voice-agent/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── stt/             # Speech-to-text services
│   │   ├── llm/             # LLM integration
│   │   ├── tts/             # Text-to-speech services
│   │   ├── database/        # Database models
│   │   └── websocket/       # WebSocket management
│   ├── requirements.txt
│   └── config.yaml
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # API services
│   │   └── utils/           # Utilities
│   ├── package.json
│   └── .env
├── models/                  # AI models
├── data/                    # SQLite database
└── docker-compose.yml
```

### Adding New Features

1. **Backend**: Add new endpoints in `main.py`
2. **Frontend**: Create components in `src/components/`
3. **Database**: Update models in `database/models.py`

## 🚨 Troubleshooting

### Common Issues

1. **"Model not found"**: Run `ollama pull mistral` or `ollama pull llama3.2`
2. **"Port already in use"**: Kill processes: `lsof -ti:3000,8000 | xargs kill`
3. **"Microphone not accessible"**: Check browser permissions and refresh page
4. **"Audio sounds distorted"**: Check browser audio settings and try different browser
5. **"Compilation errors"**: Run `npm install` in frontend directory
6. **"Module not found"**: Run `poetry install` in backend directory
7. **Slow performance**: Use smaller models or enable GPU acceleration in Ollama
8. **"python-multipart not installed"**: Run commands with `poetry run` prefix

### Logs

- Backend logs: Check terminal output
- Frontend logs: Browser developer console
- Ollama logs: `ollama logs`

## 📚 Resources

- [Whisper Documentation](https://github.com/openai/whisper)
- [Ollama API](https://github.com/ollama/ollama)
- [Piper TTS](https://github.com/rhasspy/piper)
- [FastAPI Guide](https://fastapi.tiangolo.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details
