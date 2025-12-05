# Echo Voice Agent - AWS Migration Roadmap

## 🎯 Project Vision

Transform Echo from a local-only voice assistant to a scalable, cloud-native application leveraging AWS services for enterprise-grade reliability, performance, and cost efficiency.

---

## 📋 Executive Summary

| Current State | Target State |
|---------------|--------------|
| Local Whisper STT | AWS Transcribe |
| Local Ollama LLM | AWS Bedrock (Claude/Titan) |
| Local Piper TTS | AWS Polly |
| Local SQLite | AWS DynamoDB + S3 |
| Single machine | Auto-scaling cloud infrastructure |

---

## 🏗️ Architecture Overview

### Current Architecture (Local)
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼───────────────────────────────────┐
│                  Backend (FastAPI)                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐   │
│  │ Whisper │  │ Ollama  │  │  Piper  │  │  SQLite  │   │
│  │  (STT)  │  │  (LLM)  │  │  (TTS)  │  │   (DB)   │   │
│  └─────────┘  └─────────┘  └─────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Target Architecture (AWS)
```
┌─────────────────────────────────────────────────────────┐
│              Frontend (React on CloudFront/S3)           │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────┐
│              API Gateway + Lambda / ECS                  │
└───┬─────────────┬─────────────┬─────────────┬───────────┘
    │             │             │             │
┌───▼───┐   ┌─────▼─────┐   ┌───▼───┐   ┌─────▼─────┐
│  AWS  │   │    AWS    │   │  AWS  │   │  DynamoDB │
│Transcr│   │  Bedrock  │   │ Polly │   │    + S3   │
│ ibe   │   │(Claude/   │   │ (TTS) │   │  (Storage)│
│ (STT) │   │ Titan)    │   │       │   │           │
└───────┘   └───────────┘   └───────┘   └───────────┘
```

---

## 📅 Phase 1: Foundation & Storage (Weeks 1-2)

### Objective
Set up AWS infrastructure and migrate data storage from SQLite to AWS managed services.

### Tasks

#### 1.1 AWS Account & IAM Setup
- [ ] Create dedicated AWS account or use existing organization
- [ ] Set up IAM roles with least-privilege access
- [ ] Create service accounts for backend services
- [ ] Configure AWS CLI and SDK credentials
- [ ] Set up cost alerts and budgets

#### 1.2 DynamoDB Setup (Client & Agent Storage)
- [ ] Design DynamoDB table schema for conversations
- [ ] Create `echo-conversations` table
  ```
  Table: echo-conversations
  ├── PK: conversation_id (UUID)
  ├── SK: timestamp
  ├── client_input: string (user speech transcript)
  ├── agent_response: string (LLM response)
  ├── session_id: string
  ├── metadata: map (model info, latencies, etc.)
  └── ttl: number (optional auto-expiry)
  ```
- [ ] Create `echo-sessions` table for session management
- [ ] Set up DynamoDB Streams for real-time analytics (optional)
- [ ] Implement DAX caching layer for high-traffic scenarios

#### 1.3 S3 Setup (Audio Storage)
- [ ] Create S3 bucket `echo-audio-storage`
- [ ] Configure bucket policies and encryption (SSE-S3 or SSE-KMS)
- [ ] Set up lifecycle rules for audio file retention
- [ ] Structure: `s3://echo-audio-storage/{session_id}/{timestamp}_input.webm`
- [ ] Structure: `s3://echo-audio-storage/{session_id}/{timestamp}_output.mp3`

#### 1.4 Backend Storage Service Refactor
- [ ] Create `app/storage/dynamodb_service.py`
- [ ] Create `app/storage/s3_service.py`
- [ ] Implement repository pattern for data access
- [ ] Add environment-based storage switching (local/AWS)

### Deliverables
- [ ] DynamoDB tables created and accessible
- [ ] S3 bucket configured with proper permissions
- [ ] Backend can store/retrieve conversations from DynamoDB
- [ ] Audio files stored in S3

---

## 📅 Phase 2: Speech-to-Text Migration (Weeks 3-4)

### Objective
Replace local Whisper with AWS Transcribe for speech recognition.

### Tasks

#### 2.1 AWS Transcribe Integration
- [ ] Create `app/stt/transcribe_service.py`
- [ ] Implement streaming transcription for real-time feedback
- [ ] Implement batch transcription for longer recordings
- [ ] Handle audio format conversion (WebM → supported formats)

#### 2.2 Transcribe Service Implementation
```python
# Target API
class AWSTranscribeSTT:
    async def transcribe_audio(self, audio_data: bytes) -> str
    async def start_streaming_transcription(self, audio_stream) -> AsyncGenerator
    def get_supported_languages(self) -> List[str]
```

#### 2.3 Features to Implement
- [ ] Real-time streaming transcription
- [ ] Speaker diarization (identify different speakers)
- [ ] Custom vocabulary for domain-specific terms
- [ ] Automatic language detection
- [ ] Profanity filtering (optional)
- [ ] Medical/legal transcription models (if needed)

#### 2.4 Configuration
```yaml
# config.yaml additions
aws:
  transcribe:
    language_code: "en-US"
    media_encoding: "pcm"
    sample_rate: 16000
    enable_speaker_diarization: false
    vocabulary_name: "echo-custom-vocab"  # optional
```

### Deliverables
- [ ] AWS Transcribe service integrated
- [ ] Streaming transcription working
- [ ] Fallback to local Whisper (optional for offline mode)
- [ ] Latency benchmarks documented

---

## 📅 Phase 3: LLM Migration to Bedrock (Weeks 5-7)

### Objective
Replace local Ollama with AWS Bedrock for LLM capabilities, including text generation and summarization.

### Tasks

#### 3.1 AWS Bedrock Setup
- [ ] Enable Bedrock in AWS account
- [ ] Request access to foundation models:
  - **Claude 3.5 Sonnet** (Anthropic) - Primary
  - **Claude 3 Haiku** (Anthropic) - Fast responses
  - **Amazon Titan Text** - Cost-effective alternative
  - **Llama 3** (Meta) - Open source option

#### 3.2 Bedrock Service Implementation
- [ ] Create `app/llm/bedrock_service.py`
```python
# Target API
class AWSBedrockLLM:
    async def generate_response(self, prompt: str, context: dict = None) -> dict
    async def summarize_text(self, text: str, max_length: int = 100) -> str
    async def stream_response(self, prompt: str) -> AsyncGenerator
    def get_available_models(self) -> List[str]
```

#### 3.3 Text Summarization Feature
- [ ] Implement conversation summarization
- [ ] Implement session summary generation
- [ ] Add extractive vs abstractive summarization options
- [ ] Create summary storage in DynamoDB

#### 3.4 Prompt Engineering
- [ ] Create prompt templates for different use cases
- [ ] Implement system prompts for Echo personality
- [ ] Add conversation context management
- [ ] Implement token usage tracking and optimization

#### 3.5 Model Selection Strategy
| Use Case | Primary Model | Fallback |
|----------|---------------|----------|
| Quick responses | Claude 3 Haiku | Titan Express |
| Complex reasoning | Claude 3.5 Sonnet | Claude 3 Opus |
| Summarization | Titan Text | Claude Haiku |
| Cost-sensitive | Titan Text Lite | - |

### Deliverables
- [ ] Bedrock integration complete
- [ ] Multiple model support
- [ ] Text summarization working
- [ ] Response streaming implemented
- [ ] Cost tracking per request

---

## 📅 Phase 4: Text-to-Speech Migration (Weeks 8-9)

### Objective
Replace local Piper TTS with AWS Polly for high-quality speech synthesis.

### Tasks

#### 4.1 AWS Polly Integration
- [ ] Create `app/tts/polly_service.py`
```python
# Target API
class AWSPollyTTS:
    async def synthesize_speech(self, text: str, voice_id: str = "Joanna") -> bytes
    async def synthesize_ssml(self, ssml: str) -> bytes
    def get_available_voices(self, language: str = "en-US") -> List[dict]
    async def create_speech_marks(self, text: str) -> List[dict]
```

#### 4.2 Voice Configuration
- [ ] Select default voices per language
- [ ] Implement Neural TTS voices (higher quality)
- [ ] Add SSML support for prosody control
- [ ] Configure speech marks for lip-sync (future feature)

#### 4.3 Recommended Voices
| Language | Standard Voice | Neural Voice |
|----------|----------------|--------------|
| English (US) | Joanna | Joanna (Neural) |
| English (UK) | Amy | Amy (Neural) |
| Spanish | Lucia | Lucia (Neural) |
| French | Léa | Léa (Neural) |

#### 4.4 Audio Output
- [ ] Support MP3, OGG, PCM output formats
- [ ] Implement audio caching for repeated phrases
- [ ] Add speech rate and pitch controls
- [ ] Store generated audio in S3 (optional)

### Deliverables
- [ ] AWS Polly integration complete
- [ ] Multiple voice support
- [ ] SSML prosody control working
- [ ] Audio streaming to frontend

---

## 📅 Phase 5: API & Infrastructure (Weeks 10-11)

### Objective
Deploy backend to AWS with proper scaling and monitoring.

### Tasks

#### 5.1 Deployment Options (Choose One)

**Option A: AWS Lambda + API Gateway (Serverless)**
- [ ] Create Lambda functions for each endpoint
- [ ] Configure API Gateway with WebSocket support
- [ ] Set up Lambda Layers for dependencies
- [ ] Implement cold start optimization

**Option B: Amazon ECS/Fargate (Containers)**
- [ ] Create Dockerfile for production
- [ ] Set up ECS cluster with Fargate
- [ ] Configure Application Load Balancer
- [ ] Set up auto-scaling policies

**Option C: Amazon EKS (Kubernetes)**
- [ ] Create Kubernetes manifests
- [ ] Set up EKS cluster
- [ ] Configure Horizontal Pod Autoscaler
- [ ] Implement service mesh (optional)

#### 5.2 Frontend Deployment
- [ ] Build production React bundle
- [ ] Create S3 bucket for static hosting
- [ ] Configure CloudFront CDN
- [ ] Set up custom domain with Route 53
- [ ] Enable HTTPS with ACM certificate

#### 5.3 Networking & Security
- [ ] Configure VPC with private subnets
- [ ] Set up NAT Gateway for outbound traffic
- [ ] Implement WAF rules for API protection
- [ ] Enable AWS Shield for DDoS protection

### Deliverables
- [ ] Backend deployed to AWS
- [ ] Frontend served via CloudFront
- [ ] Auto-scaling configured
- [ ] SSL/TLS enabled

---

## 📅 Phase 6: Monitoring & Optimization (Week 12)

### Objective
Implement comprehensive monitoring, logging, and cost optimization.

### Tasks

#### 6.1 Monitoring Setup
- [ ] Configure CloudWatch dashboards
- [ ] Set up CloudWatch Alarms for:
  - API latency > 2s
  - Error rate > 1%
  - Lambda/ECS CPU > 80%
  - DynamoDB throttling
- [ ] Implement X-Ray tracing for request flow
- [ ] Set up CloudWatch Logs Insights queries

#### 6.2 Cost Optimization
- [ ] Implement request caching (ElastiCache)
- [ ] Use Savings Plans for predictable workloads
- [ ] Enable S3 Intelligent Tiering
- [ ] Set up Cost Explorer reports
- [ ] Implement usage quotas per user (optional)

#### 6.3 Performance Optimization
- [ ] Benchmark all AWS service latencies
- [ ] Implement connection pooling
- [ ] Add response caching layer
- [ ] Optimize DynamoDB read/write capacity

### Deliverables
- [ ] Monitoring dashboard live
- [ ] Alerts configured
- [ ] Cost reports automated
- [ ] Performance benchmarks documented

---

## 💰 AWS Cost Estimation

### Monthly Cost Breakdown (Estimated)

| Service | Usage Assumption | Est. Cost/Month |
|---------|------------------|-----------------|
| **AWS Transcribe** | 100 hours audio | $144 |
| **AWS Bedrock (Claude)** | 1M input + 500K output tokens | ~$50-150 |
| **AWS Polly** | 1M characters (Neural) | $16 |
| **DynamoDB** | 25 WCU, 25 RCU, 10GB | $25 |
| **S3** | 100GB storage + requests | $5 |
| **Lambda/Fargate** | Moderate traffic | $20-50 |
| **CloudFront** | 100GB transfer | $10 |
| **API Gateway** | 1M requests | $3.50 |
| **CloudWatch** | Logs + metrics | $10 |
| **Total Estimated** | | **$280-420/month** |

*Note: Costs vary significantly based on usage. Free tier eligible for first 12 months on new accounts.*

---

## 🔧 Technical Specifications

### Environment Variables (AWS)
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from-iam>
AWS_SECRET_ACCESS_KEY=<from-iam>

# Service Configuration
ECHO_STT_SERVICE=transcribe  # whisper | transcribe
ECHO_LLM_SERVICE=bedrock     # ollama | bedrock
ECHO_TTS_SERVICE=polly       # piper | polly
ECHO_STORAGE_SERVICE=aws     # local | aws

# Bedrock Configuration
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_REGION=us-east-1

# Polly Configuration
POLLY_VOICE_ID=Joanna
POLLY_ENGINE=neural

# DynamoDB Configuration
DYNAMODB_TABLE_CONVERSATIONS=echo-conversations
DYNAMODB_TABLE_SESSIONS=echo-sessions

# S3 Configuration
S3_BUCKET_AUDIO=echo-audio-storage
```

### Service Interface (Unified)
```python
# All services implement these interfaces for easy swapping

class STTService(Protocol):
    async def transcribe_audio(self, audio_data: bytes) -> str: ...
    
class LLMService(Protocol):
    async def generate_response(self, prompt: str) -> dict: ...
    async def summarize_text(self, text: str) -> str: ...
    
class TTSService(Protocol):
    async def synthesize_speech(self, text: str) -> bytes: ...
    
class StorageService(Protocol):
    async def save_conversation(self, data: dict) -> str: ...
    async def get_conversation(self, id: str) -> dict: ...
    async def save_audio(self, audio: bytes, key: str) -> str: ...
```

---

## ✅ Success Criteria

### Performance Targets
- [ ] End-to-end latency < 3 seconds (STT + LLM + TTS)
- [ ] STT accuracy > 95% for clear speech
- [ ] 99.9% uptime (AWS SLA backed)
- [ ] Support 100+ concurrent users

### Quality Targets
- [ ] Natural-sounding TTS output
- [ ] Contextual LLM responses
- [ ] Accurate summarization
- [ ] Reliable conversation storage

### Cost Targets
- [ ] < $500/month for moderate usage
- [ ] Per-request cost tracking
- [ ] No unexpected billing spikes

---

## 🚀 Quick Start Commands

```bash
# Install AWS CLI
brew install awscli

# Configure AWS credentials
aws configure

# Verify access
aws sts get-caller-identity

# Create DynamoDB table
aws dynamodb create-table \
  --table-name echo-conversations \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Create S3 bucket
aws s3 mb s3://echo-audio-storage-$(aws sts get-caller-identity --query Account --output text)

# Test Bedrock access
aws bedrock list-foundation-models --region us-east-1
```

---

## 📚 Resources

- [AWS Transcribe Documentation](https://docs.aws.amazon.com/transcribe/)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS Polly Documentation](https://docs.aws.amazon.com/polly/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Anthropic Claude on Bedrock](https://docs.anthropic.com/claude/docs/claude-on-amazon-bedrock)

---

## 📝 Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-05 | 1.0 | Initial roadmap created |

---

*This roadmap is a living document and will be updated as implementation progresses.*

