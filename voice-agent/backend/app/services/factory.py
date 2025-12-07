"""
Echo Voice Agent - Service Factory
Creates appropriate service instances based on IS_AWS environment variable.
"""

import os
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


def is_aws_enabled() -> bool:
    """Check if AWS services should be used"""
    is_aws = os.getenv("IS_AWS", "false").lower()
    return is_aws in ("true", "1", "yes")


def get_stt_service():
    """Get the appropriate STT service based on configuration"""
    if is_aws_enabled():
        logger.info("Using AWS Transcribe for STT")
        from ..stt.transcribe_service import AWSTranscribeSTT
        return AWSTranscribeSTT()
    else:
        logger.info("Using local Whisper for STT")
        from ..stt.whisper_service import WhisperSTT
        return WhisperSTT()


def get_llm_service():
    """Get the appropriate LLM service based on configuration"""
    if is_aws_enabled():
        logger.info("Using AWS Bedrock for LLM")
        from ..llm.bedrock_service import AWSBedrockLLM
        return AWSBedrockLLM()
    else:
        logger.info("Using local Ollama for LLM")
        from ..llm.ollama_service import OllamaLLM
        return OllamaLLM()


def get_tts_service():
    """Get the appropriate TTS service based on configuration"""
    if is_aws_enabled():
        logger.info("Using AWS Polly for TTS")
        from ..tts.polly_service import AWSPollyTTS
        return AWSPollyTTS()
    else:
        logger.info("Using local Piper for TTS")
        from ..tts.piper_service import PiperTTS
        return PiperTTS()


def get_storage_service():
    """Get the appropriate storage service based on configuration"""
    if is_aws_enabled():
        logger.info("Using AWS DynamoDB/S3 for storage")
        from ..storage.aws_storage_service import AWSStorageService
        return AWSStorageService()
    else:
        logger.info("Using local SQLite for storage")
        from ..storage.local_storage_service import LocalStorageService
        return LocalStorageService()


def get_all_services() -> Tuple:
    """
    Get all services based on configuration.
    Returns: (stt_service, llm_service, tts_service, storage_service)
    """
    mode = "AWS" if is_aws_enabled() else "Local"
    logger.info(f"Initializing Echo services in {mode} mode")
    
    return (
        get_stt_service(),
        get_llm_service(),
        get_tts_service(),
        get_storage_service()
    )

