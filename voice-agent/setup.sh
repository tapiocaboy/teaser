#!/bin/bash

# Echo Setup Script
echo "🎯 Setting up Echo Environment"

# Check for required tools
echo "📋 Checking system requirements..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.10+"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if [[ "$(printf '%s\n' "$PYTHON_VERSION" "3.10" | sort -V | head -n1)" != "3.10" ]]; then
    echo "❌ Python $PYTHON_VERSION found. Please upgrade to Python 3.10+"
    exit 1
fi
echo "✅ Python $PYTHON_VERSION found"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
if [[ "$(printf '%s\n' "$NODE_VERSION" "18.0.0" | sort -V | head -n1)" != "18.0.0" ]]; then
    echo "❌ Node.js $NODE_VERSION found. Please upgrade to Node.js 18+"
    exit 1
fi
echo "✅ Node.js $NODE_VERSION found"

# Setup backend
echo "🔧 Setting up backend..."
cd backend

# Install dependencies with Poetry
echo "📦 Installing Python dependencies with Poetry..."
poetry install

# Setup frontend
echo "🔧 Setting up frontend..."
cd ../frontend

echo "📦 Installing Node.js dependencies..."
npm install

cd ..

# Setup Ollama
echo "🤖 Setting up Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "📥 Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
fi

# Start Ollama service if not running
if ! pgrep -x "ollama" > /dev/null; then
    echo "🚀 Starting Ollama service..."
    nohup ollama serve > /dev/null 2>&1 &
    sleep 5
fi

echo "📥 Pulling required LLM models..."
echo "Pulling Mistral model..."
ollama pull mistral

# Check if Mistral is available
if ollama list | grep -q "mistral"; then
    echo "✅ Mistral model ready"
else
    echo "❌ Failed to pull Mistral model"
    exit 1
fi

# Create necessary directories
echo "📁 Creating project directories..."
mkdir -p data models/whisper models/piper models/voices logs

echo "🎉 Setup complete!"
echo ""
echo "🚀 To start the voice agent:"
echo "1. Backend: cd backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo "2. Frontend: cd frontend && npm start"
echo "3. Ollama: Already running in background"
echo ""
echo "📖 Visit http://localhost:3000 to use the voice agent"
echo ""
echo "🔧 Available Poetry commands:"
echo "  - poetry run uvicorn app.main:app --reload  # Start backend"
echo "  - poetry run pytest                         # Run tests"
echo "  - poetry run black .                        # Format code"
