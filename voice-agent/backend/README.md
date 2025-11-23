# Voice Agent Backend

Backend API for the Voice Agent application, built with FastAPI and managed with Poetry.

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Poetry (dependency management)

### Installation

1. **Install dependencies**:
   ```bash
   poetry install
   ```

2. **Activate the virtual environment**:
   ```bash
   poetry shell
   ```

### Running the Application

**Development mode** (with auto-reload):
```bash
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Production mode**:
```bash
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Using Poetry scripts**:
```bash
poetry run start  # Development with reload
poetry run serve  # Production mode
```

### Running Tests

```bash
poetry run pytest
```

### Code Formatting

```bash
# Format code
poetry run black .
poetry run isort .

# Check formatting
poetry run black --check .
poetry run isort --check-only .
```

## 📋 API Endpoints

- `GET /` - Health check
- `GET /health` - Detailed health status
- `POST /api/voice/process` - Process voice audio files
- `GET /api/conversations` - Conversation history
- `WebSocket /ws/voice` - Real-time voice streaming

## 🏗️ Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application
│   ├── stt/                 # Speech-to-text services
│   ├── llm/                 # LLM integration
│   ├── tts/                 # Text-to-speech services
│   ├── database/            # Database models
│   └── websocket/           # WebSocket management
├── pyproject.toml           # Poetry configuration
├── poetry.lock             # Dependency lock file
├── config.yaml             # Application configuration
└── README.md
```

## 🔧 Configuration

Edit `config.yaml` to customize:

- Model sizes and compute settings
- Voice parameters
- Database configuration
- WebSocket settings

## 🎯 Development

### Adding Dependencies

```bash
# Add runtime dependency
poetry add package-name

# Add development dependency
poetry add --group dev package-name
```

### Virtual Environment

Poetry automatically manages virtual environments. To activate:

```bash
poetry shell
```

Or run commands directly:

```bash
poetry run python script.py
```

## 📚 API Documentation

When the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
