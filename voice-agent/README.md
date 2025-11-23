# Voice Agent 🤖

A fully local, privacy-focused voice assistant with real-time speech recognition, LLM processing, and natural text-to-speech capabilities.

## 🏗️ Architecture

- **Frontend**: React with TypeScript, Material-UI
- **Backend**: Python FastAPI with WebSocket support
- **STT**: Whisper (faster-whisper for performance)
- **LLM**: Ollama with Mistral/Llama models
- **TTS**: Piper Text-to-Speech
- **Database**: SQLite with SQLAlchemy

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- **Poetry** (Python dependency management) - `pip install poetry`
- Ollama (will be installed automatically)

### Automated Setup

```bash
# Clone and setup everything
chmod +x setup.sh
./setup.sh
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
cd ../frontend
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

```bash
# Download Piper voice models
cd models/piper
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-en-us-amy-medium.tar.gz
tar -xzf voice-en-us-amy-medium.tar.gz
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

1. Click "Start Listening" to begin recording
2. Speak your message
3. The system will:
   - Transcribe your speech to text
   - Generate an AI response using the local LLM
   - Convert the response back to speech
4. View conversation history in the interface

## 🔧 Configuration

Edit `backend/config.yaml` to customize:

- Model sizes and compute settings
- Voice parameters
- Database configuration
- WebSocket settings

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

1. **"Model not found"**: Run `ollama pull mistral`
2. **"Port already in use"**: Kill process or change port in config
3. **"Microphone not accessible"**: Check browser permissions
4. **Slow performance**: Use smaller models or GPU acceleration

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
