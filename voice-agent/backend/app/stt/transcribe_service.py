"""
AWS Transcribe Speech-to-Text Service
Uses Amazon Transcribe for speech recognition.
"""

import logging
import os
import asyncio
import tempfile
import uuid
from typing import Optional, List, Dict

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AWSTranscribeSTT:
    """AWS Transcribe Speech-to-Text Service"""
    
    def __init__(self):
        """Initialize AWS Transcribe client"""
        self.region = os.getenv("AWS_REGION", "ap-southeast-2")
        self.s3_bucket = os.getenv("S3_BUCKET_AUDIO", "echo-audio-storage")
        self.language_code = os.getenv("TRANSCRIBE_LANGUAGE_CODE", "en-US")
        
        logger.info(f"Initializing AWS Transcribe in region {self.region}")
        
        self.transcribe_client = boto3.client(
            "transcribe",
            region_name=self.region
        )
        self.s3_client = boto3.client(
            "s3",
            region_name=self.region
        )
        
        logger.info("AWS Transcribe service initialized")
    
    async def transcribe_audio(self, audio_data: bytes, language: Optional[str] = None) -> str:
        """
        Transcribe audio data to text using AWS Transcribe.
        
        Args:
            audio_data: Raw audio bytes (WebM, WAV, etc.)
            language: Language code (e.g., 'en-US')
            
        Returns:
            Transcribed text
        """
        try:
            if not audio_data or len(audio_data) < 100:
                logger.warning(f"Audio data too small: {len(audio_data)} bytes")
                return "No audio data received"
            
            logger.info(f"Transcribing {len(audio_data)} bytes of audio")
            
            # Generate unique job name
            job_name = f"echo-transcribe-{uuid.uuid4().hex[:8]}"
            
            # Upload audio to S3 (Transcribe requires S3 input)
            s3_key = f"transcribe-input/{job_name}.webm"
            
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=s3_key,
                Body=audio_data,
                ContentType="audio/webm"
            )
            logger.info(f"Uploaded audio to s3://{self.s3_bucket}/{s3_key}")
            
            # Start transcription job
            media_uri = f"s3://{self.s3_bucket}/{s3_key}"
            
            response = self.transcribe_client.start_transcription_job(
                TranscriptionJobName=job_name,
                Media={"MediaFileUri": media_uri},
                MediaFormat="webm",
                LanguageCode=language or self.language_code,
                Settings={
                    "ShowSpeakerLabels": False,
                    "ChannelIdentification": False
                }
            )
            
            logger.info(f"Started transcription job: {job_name}")
            
            # Wait for transcription to complete
            transcript = await self._wait_for_transcription(job_name)
            
            # Cleanup S3 file
            try:
                self.s3_client.delete_object(Bucket=self.s3_bucket, Key=s3_key)
            except Exception as e:
                logger.warning(f"Failed to cleanup S3 file: {e}")
            
            # Delete transcription job
            try:
                self.transcribe_client.delete_transcription_job(
                    TranscriptionJobName=job_name
                )
            except Exception as e:
                logger.warning(f"Failed to delete transcription job: {e}")
            
            return transcript if transcript else "No speech detected in audio"
            
        except ClientError as e:
            logger.error(f"AWS Transcribe error: {e}")
            raise RuntimeError(f"Transcription failed: {e}")
        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            raise RuntimeError(f"Speech transcription failed: {e}")
    
    async def _wait_for_transcription(self, job_name: str, max_wait: int = 60) -> str:
        """
        Wait for transcription job to complete and return result.
        
        Args:
            job_name: Transcription job name
            max_wait: Maximum wait time in seconds
            
        Returns:
            Transcribed text
        """
        import urllib.request
        import json
        
        elapsed = 0
        poll_interval = 2
        
        while elapsed < max_wait:
            response = self.transcribe_client.get_transcription_job(
                TranscriptionJobName=job_name
            )
            
            status = response["TranscriptionJob"]["TranscriptionJobStatus"]
            
            if status == "COMPLETED":
                # Get transcript from result URL
                transcript_uri = response["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
                
                with urllib.request.urlopen(transcript_uri) as result:
                    data = json.loads(result.read().decode())
                    transcripts = data.get("results", {}).get("transcripts", [])
                    
                    if transcripts:
                        return transcripts[0].get("transcript", "")
                    return ""
                    
            elif status == "FAILED":
                failure_reason = response["TranscriptionJob"].get("FailureReason", "Unknown")
                logger.error(f"Transcription failed: {failure_reason}")
                raise RuntimeError(f"Transcription failed: {failure_reason}")
            
            # Still in progress, wait
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        
        raise RuntimeError(f"Transcription timed out after {max_wait} seconds")
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported language codes"""
        return [
            "en-US", "en-GB", "en-AU", "en-IN",
            "es-ES", "es-US", "fr-FR", "fr-CA",
            "de-DE", "it-IT", "pt-BR", "pt-PT",
            "ja-JP", "ko-KR", "zh-CN", "zh-TW",
            "ar-SA", "ar-AE", "hi-IN", "nl-NL",
            "ru-RU", "pl-PL", "sv-SE", "da-DK",
            "fi-FI", "no-NO", "tr-TR", "he-IL"
        ]
    
    def get_model_info(self) -> Dict[str, str]:
        """Get service information"""
        return {
            "service": "AWS Transcribe",
            "region": self.region,
            "language": self.language_code,
            "provider": "aws"
        }
    
    def cleanup(self) -> None:
        """Cleanup resources"""
        logger.info("AWS Transcribe service cleanup completed")

