# Echo Backend

Backend API for the Echo voice assistant application. Supports both **local** (privacy-focused) and **AWS** (cloud-scale) deployment modes.

## 🌟 Features

- **Dual Mode Operation**: Switch between local and AWS services via a single environment variable
- **Local Mode**: Whisper STT, Ollama LLM, Piper TTS, SQLite storage
- **AWS Mode**: Transcribe STT, Bedrock LLM (Claude/Titan), Polly TTS, DynamoDB/S3 storage
- **Real-time WebSocket**: Stream voice interactions
- **Conversation History**: Persistent storage with summarization

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Poetry (dependency management)
- For local mode: Ollama running locally
- For AWS mode: AWS credentials configured

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

#### Local Mode (Default)

```bash
# Uses Whisper, Ollama, Piper, SQLite
poetry run start
```

#### AWS Mode

```bash
# Uses AWS Transcribe, Bedrock, Polly, DynamoDB/S3
IS_AWS=true poetry run start
```

**Production mode**:
```bash
IS_AWS=true poetry run serve
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `IS_AWS` | `false` | Set to `true` to use AWS services |
| `AWS_REGION` | `ap-southeast-2` | AWS region for all services |
| `BEDROCK_MODEL_ID` | `anthropic.claude-3-sonnet-20240229-v1:0` | Bedrock model to use |
| `BEDROCK_MAX_TOKENS` | `1024` | Max response tokens |
| `POLLY_VOICE_ID` | `Joanna` | Polly voice to use |
| `POLLY_ENGINE` | `neural` | `neural` or `standard` |
| `TRANSCRIBE_LANGUAGE_CODE` | `en-US` | Language for transcription |
| `DYNAMODB_TABLE_CONVERSATIONS` | `echo-conversations` | DynamoDB table name |
| `S3_BUCKET_AUDIO` | `echo-audio-storage` | S3 bucket for audio |

### AWS Credentials

For AWS mode, configure credentials using one of:

1. **Environment Variables**:
   ```bash
   export AWS_ACCESS_KEY_ID=your-key
   export AWS_SECRET_ACCESS_KEY=your-secret
   export AWS_REGION=ap-southeast-2
   ```

2. **AWS CLI**:
   ```bash
   aws configure
   ```

3. **IAM Role** (for EC2/ECS/Lambda)

### Config File

Edit `config.yaml` to customize local and AWS service settings.

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check with mode info |
| `GET` | `/health` | Detailed service health status |
| `GET` | `/api/info` | Service configuration info |
| `POST` | `/api/voice/process` | Process voice audio file |
| `POST` | `/api/summarize` | Summarize text using LLM |
| `GET` | `/api/conversations` | Get conversation history |
| `WebSocket` | `/ws/voice` | Real-time voice streaming |

## 🏗️ Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application
│   ├── services/            # Service interfaces & factory
│   │   ├── __init__.py      # Protocol definitions
│   │   └── factory.py       # Service factory (AWS/local)
│   ├── stt/                 # Speech-to-text services
│   │   ├── whisper_service.py    # Local Whisper
│   │   └── transcribe_service.py # AWS Transcribe
│   ├── llm/                 # LLM services
│   │   ├── ollama_service.py     # Local Ollama
│   │   └── bedrock_service.py    # AWS Bedrock
│   ├── tts/                 # Text-to-speech services
│   │   ├── piper_service.py      # Local Piper
│   │   └── polly_service.py      # AWS Polly
│   ├── storage/             # Storage services
│   │   ├── local_storage_service.py  # SQLite/filesystem
│   │   └── aws_storage_service.py    # DynamoDB/S3
│   ├── database/            # Local database models
│   └── websocket/           # WebSocket management
├── pyproject.toml           # Poetry configuration
├── config.yaml              # Application configuration
└── README.md
```

## 🔧 Service Architecture

The application uses a **factory pattern** to switch between services:

```python
# In app/services/factory.py
def get_stt_service():
    if is_aws_enabled():
        return AWSTranscribeSTT()
    else:
        return WhisperSTT()
```

All services implement common interfaces defined in `app/services/__init__.py`:

- `STTService`: Speech-to-text
- `LLMService`: Language model
- `TTSService`: Text-to-speech
- `StorageService`: Conversation/audio storage

## 🧪 Running Tests

```bash
poetry run pytest
```

## 💰 AWS Cost Considerations

When using AWS mode, be aware of costs:

| Service | Typical Usage | Estimated Cost |
|---------|---------------|----------------|
| Transcribe | 100 hrs/month | ~$144/month |
| Bedrock (Claude) | 1M tokens | ~$50-150/month |
| Polly (Neural) | 1M chars | ~$16/month |
| DynamoDB | 25 WCU/RCU | ~$25/month |
| S3 | 100GB | ~$5/month |

See the [ROADMAP.md](../ROADMAP.md) for detailed cost breakdown.

## 📚 API Documentation

When the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
