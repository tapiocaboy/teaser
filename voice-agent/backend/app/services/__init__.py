"""
Echo Voice Agent - Service Interfaces and Factory
Provides unified interfaces for STT, LLM, TTS, and Storage services
with support for both local and AWS implementations.
"""

from typing import Protocol, List, Dict, Optional, AsyncGenerator
from abc import abstractmethod


class STTService(Protocol):
    """Speech-to-Text Service Interface"""
    
    @abstractmethod
    async def transcribe_audio(self, audio_data: bytes, language: Optional[str] = None) -> str:
        """Transcribe audio data to text"""
        ...
    
    @abstractmethod
    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages"""
        ...
    
    @abstractmethod
    def get_model_info(self) -> Dict[str, str]:
        """Get model/service information"""
        ...
    
    def cleanup(self) -> None:
        """Optional cleanup method"""
        pass


class LLMService(Protocol):
    """Large Language Model Service Interface"""
    
    @abstractmethod
    async def generate_response(self, prompt: str, context: Optional[Dict] = None) -> Dict:
        """Generate a response from the LLM"""
        ...
    
    @abstractmethod
    async def summarize_text(self, text: str, max_length: int = 100) -> str:
        """Summarize the given text"""
        ...
    
    async def stream_response(self, prompt: str) -> AsyncGenerator[str, None]:
        """Stream response from LLM (optional)"""
        yield ""
    
    def cleanup(self) -> None:
        """Optional cleanup method"""
        pass


class TTSService(Protocol):
    """Text-to-Speech Service Interface"""
    
    @abstractmethod
    async def synthesize_speech(self, text: str, voice_id: Optional[str] = None) -> bytes:
        """Convert text to speech audio"""
        ...
    
    @abstractmethod
    def get_available_voices(self, language: str = "en-US") -> List[Dict]:
        """Get list of available voices"""
        ...
    
    @abstractmethod
    def get_voice_info(self) -> Dict[str, str]:
        """Get current voice configuration"""
        ...
    
    def cleanup(self) -> None:
        """Optional cleanup method"""
        pass


class StorageService(Protocol):
    """Storage Service Interface for conversations and audio"""
    
    @abstractmethod
    async def save_conversation(
        self,
        user_input: str,
        assistant_response: str,
        session_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """Save a conversation and return its ID"""
        ...
    
    @abstractmethod
    async def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        """Get a conversation by ID"""
        ...
    
    @abstractmethod
    async def get_recent_conversations(self, limit: int = 10, offset: int = 0) -> List[Dict]:
        """Get recent conversations"""
        ...
    
    @abstractmethod
    async def save_audio(self, audio_data: bytes, key: str) -> str:
        """Save audio data and return the storage path/URL"""
        ...
    
    @abstractmethod
    async def get_audio(self, key: str) -> Optional[bytes]:
        """Retrieve audio data by key"""
        ...
    
    def cleanup(self) -> None:
        """Optional cleanup method"""
        pass

