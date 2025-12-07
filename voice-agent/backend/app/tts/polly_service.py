"""
AWS Polly Text-to-Speech Service
Uses Amazon Polly for speech synthesis.
"""

import logging
import os
import io
from typing import Optional, List, Dict

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AWSPollyTTS:
    """AWS Polly Text-to-Speech Service"""
    
    # Voice configurations organized by language
    NEURAL_VOICES = {
        "en-US": ["Joanna", "Matthew", "Ivy", "Kendra", "Kimberly", "Salli", "Joey", "Justin", "Kevin", "Ruth", "Stephen"],
        "en-GB": ["Amy", "Emma", "Brian", "Arthur"],
        "en-AU": ["Olivia"],
        "en-IN": ["Kajal"],
        "es-ES": ["Lucia", "Sergio"],
        "es-US": ["Lupe", "Pedro"],
        "fr-FR": ["Lea", "Remi"],
        "fr-CA": ["Gabrielle"],
        "de-DE": ["Vicki", "Daniel"],
        "it-IT": ["Bianca", "Adriano"],
        "pt-BR": ["Camila", "Thiago"],
        "pt-PT": ["Ines"],
        "ja-JP": ["Takumi", "Kazuha"],
        "ko-KR": ["Seoyeon"],
        "zh-CN": ["Zhiyu"],
        "hi-IN": ["Aditi"],
        "ar-AE": ["Hala"],
        "nl-NL": ["Laura"],
    }
    
    def __init__(self):
        """Initialize AWS Polly client"""
        self.region = os.getenv("AWS_REGION", "ap-southeast-2")
        self.voice_id = os.getenv("POLLY_VOICE_ID", "Joanna")
        self.engine = os.getenv("POLLY_ENGINE", "neural")
        self.output_format = os.getenv("POLLY_OUTPUT_FORMAT", "mp3")
        self.sample_rate = os.getenv("POLLY_SAMPLE_RATE", "24000")
        
        logger.info(f"Initializing AWS Polly in region {self.region}")
        logger.info(f"Using voice: {self.voice_id} ({self.engine})")
        
        self.polly_client = boto3.client(
            "polly",
            region_name=self.region
        )
        
        logger.info("AWS Polly service initialized")
    
    async def synthesize_speech(self, text: str, voice_id: Optional[str] = None) -> bytes:
        """
        Convert text to speech using AWS Polly.
        
        Args:
            text: Text to convert to speech
            voice_id: Optional voice ID override
            
        Returns:
            Audio data bytes (MP3 format by default)
        """
        try:
            if not text or not text.strip():
                logger.warning("Empty text provided for speech synthesis")
                return b""
            
            # Truncate very long text (Polly has limits)
            max_chars = 3000
            if len(text) > max_chars:
                logger.warning(f"Text truncated from {len(text)} to {max_chars} chars")
                text = text[:max_chars] + "..."
            
            logger.info(f"Synthesizing {len(text)} characters of text")
            
            # Use SSML if text contains special markers, otherwise plain text
            text_type = "text"
            synthesis_text = text
            
            # Check if this is SSML
            if text.strip().startswith("<speak>"):
                text_type = "ssml"
            
            voice = voice_id or self.voice_id
            
            # Determine if voice supports neural engine
            engine = self.engine
            if not self._voice_supports_neural(voice):
                logger.info(f"Voice {voice} doesn't support neural, using standard")
                engine = "standard"
            
            response = self.polly_client.synthesize_speech(
                Text=synthesis_text,
                TextType=text_type,
                OutputFormat=self.output_format,
                VoiceId=voice,
                Engine=engine,
                SampleRate=self.sample_rate
            )
            
            # Read audio stream
            audio_stream = response.get("AudioStream")
            if audio_stream:
                audio_data = audio_stream.read()
                logger.info(f"Generated {len(audio_data)} bytes of audio")
                return audio_data
            
            logger.warning("No audio stream in Polly response")
            return b""
            
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            logger.error(f"AWS Polly error ({error_code}): {e}")
            raise RuntimeError(f"Speech synthesis failed: {e}")
        except Exception as e:
            logger.error(f"Error synthesizing speech: {e}")
            raise RuntimeError(f"Speech synthesis failed: {e}")
    
    async def synthesize_ssml(self, ssml: str, voice_id: Optional[str] = None) -> bytes:
        """
        Synthesize speech from SSML markup.
        
        Args:
            ssml: SSML formatted text
            voice_id: Optional voice ID override
            
        Returns:
            Audio data bytes
        """
        try:
            # Ensure SSML is wrapped in speak tags
            if not ssml.strip().startswith("<speak>"):
                ssml = f"<speak>{ssml}</speak>"
            
            voice = voice_id or self.voice_id
            engine = self.engine if self._voice_supports_neural(voice) else "standard"
            
            response = self.polly_client.synthesize_speech(
                Text=ssml,
                TextType="ssml",
                OutputFormat=self.output_format,
                VoiceId=voice,
                Engine=engine,
                SampleRate=self.sample_rate
            )
            
            audio_stream = response.get("AudioStream")
            if audio_stream:
                return audio_stream.read()
            
            return b""
            
        except ClientError as e:
            logger.error(f"AWS Polly SSML error: {e}")
            raise RuntimeError(f"SSML synthesis failed: {e}")
    
    def _voice_supports_neural(self, voice_id: str) -> bool:
        """Check if a voice supports neural engine"""
        # All voices in NEURAL_VOICES support neural
        for lang_voices in self.NEURAL_VOICES.values():
            if voice_id in lang_voices:
                return True
        return False
    
    def get_available_voices(self, language: str = "en-US") -> List[Dict]:
        """
        Get available voices for a language.
        
        Args:
            language: Language code (e.g., 'en-US')
            
        Returns:
            List of voice information dictionaries
        """
        try:
            response = self.polly_client.describe_voices(
                LanguageCode=language
            )
            
            voices = []
            for voice in response.get("Voices", []):
                voices.append({
                    "id": voice.get("Id"),
                    "name": voice.get("Name"),
                    "gender": voice.get("Gender"),
                    "language": voice.get("LanguageCode"),
                    "engine": voice.get("SupportedEngines", []),
                    "neural_supported": "neural" in voice.get("SupportedEngines", [])
                })
            
            return voices
            
        except ClientError as e:
            logger.error(f"Error getting voices: {e}")
            # Return default neural voices for the language
            neural_voices = self.NEURAL_VOICES.get(language, ["Joanna"])
            return [{"id": v, "name": v, "neural_supported": True} for v in neural_voices]
    
    def get_voice_info(self) -> Dict[str, str]:
        """Get current voice configuration"""
        return {
            "service": "AWS Polly",
            "voice_id": self.voice_id,
            "engine": self.engine,
            "output_format": self.output_format,
            "sample_rate": self.sample_rate,
            "region": self.region,
            "provider": "aws"
        }
    
    async def create_speech_marks(self, text: str, mark_types: List[str] = None) -> List[Dict]:
        """
        Create speech marks for timing/lip-sync.
        
        Args:
            text: Text to analyze
            mark_types: Types of marks ('sentence', 'word', 'viseme', 'ssml')
            
        Returns:
            List of speech mark dictionaries
        """
        import json
        
        try:
            if mark_types is None:
                mark_types = ["word"]
            
            response = self.polly_client.synthesize_speech(
                Text=text,
                TextType="text",
                OutputFormat="json",
                VoiceId=self.voice_id,
                Engine=self.engine if self._voice_supports_neural(self.voice_id) else "standard",
                SpeechMarkTypes=mark_types
            )
            
            audio_stream = response.get("AudioStream")
            if audio_stream:
                # Parse JSON lines
                content = audio_stream.read().decode("utf-8")
                marks = []
                for line in content.strip().split("\n"):
                    if line:
                        marks.append(json.loads(line))
                return marks
            
            return []
            
        except ClientError as e:
            logger.error(f"Error creating speech marks: {e}")
            return []
    
    def cleanup(self) -> None:
        """Cleanup resources"""
        logger.info("AWS Polly service cleanup completed")

