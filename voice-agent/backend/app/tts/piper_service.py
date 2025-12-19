"""
Piper Text-to-Speech Service
"""
import logging
import os
import io
from typing import Optional, List, Dict, Any, AsyncGenerator
import subprocess
import tempfile
import wave
import struct

logger = logging.getLogger(__name__)

class PiperTTS:
    def __init__(
        self,
        voice_model: str = "en_US-amy-medium",
        speed: float = 1.0,
        noise_scale: float = 0.667,
        noise_w: float = 0.8,
        length_scale: float = 1.0
    ):
        """
        Initialize Piper TTS service

        Args:
            voice_model: Voice model name (e.g., en_US-amy-medium)
            speed: Speech speed multiplier
            noise_scale: Noise scale parameter
            noise_w: Phoneme duration noise
            length_scale: Length scale parameter
        """
        self.voice_model = voice_model
        self.speed = speed
        self.noise_scale = noise_scale
        self.noise_w = noise_w
        self.length_scale = length_scale

        # Model paths
        self.model_dir = "./models/piper"
        self.voice_dir = "./models/voices"
        self.model_path = os.path.join(self.model_dir, f"{voice_model}.onnx")
        self.config_path = os.path.join(self.model_dir, f"{voice_model}.onnx.json")

        # Ensure directories exist
        os.makedirs(self.model_dir, exist_ok=True)
        os.makedirs(self.voice_dir, exist_ok=True)

        logger.info(f"Piper TTS initialized with voice: {voice_model}")

    async def synthesize_speech(
        self,
        text: str,
        speaker_id: Optional[int] = None
    ) -> Optional[bytes]:
        """
        Synthesize speech from text using Piper TTS

        Args:
            text: Text to synthesize
            speaker_id: Speaker ID for multi-speaker models (optional)

        Returns:
            Audio data as bytes (WAV format)
        """
        logger.info(f"TTS synthesizing text: '{text[:100]}...' (length: {len(text)})")
        try:
            # Check if Piper is available and model files exist
            if not self._check_model_files():
                logger.warning(f"Piper model files not found for {self.voice_model}, using fallback")
                return await self._generate_fallback_audio(text)

            # Use piper-tts library for synthesis
            try:
                from piper.voice import PiperVoice
                from piper.download import ensure_voice_exists, get_voices

                # Ensure voice exists
                ensure_voice_exists(self.voice_model, self.model_dir)

                # Load the voice
                voice = PiperVoice.load(self.model_path, self.config_path)

                # Synthesize speech
                audio_data = voice.synthesize(text, speaker_id)

                logger.info(f"Successfully synthesized speech: {len(audio_data)} bytes for text: '{text[:50]}...'")

                # Convert to more browser-compatible format if needed
                try:
                    import scipy.io.wavfile
                    import numpy as np

                    # Load the WAV data
                    sample_rate, audio_array = scipy.io.wavfile.read(io.BytesIO(audio_data))
                    logger.info(f"Original audio: rate={sample_rate}Hz, samples={len(audio_array)}")

                    # Convert to 44100 Hz if not already
                    if sample_rate != 44100:
                        logger.info(f"Converting audio from {sample_rate}Hz to 44100Hz")
                        # Simple resampling (basic implementation)
                        ratio = 44100 / sample_rate
                        new_length = int(len(audio_array) * ratio)
                        resampled = np.interp(
                            np.linspace(0, len(audio_array), new_length),
                            np.arange(len(audio_array)),
                            audio_array
                        ).astype(np.int16)

                        # Save as new WAV at 44100 Hz
                        output_buffer = io.BytesIO()
                        scipy.io.wavfile.write(output_buffer, 44100, resampled)
                        audio_data = output_buffer.getvalue()
                        logger.info(f"Converted audio to {len(audio_data)} bytes at 44100Hz")
                    else:
                        logger.info("Audio already at 44100Hz, skipping conversion")

                except Exception as conv_err:
                    logger.warning(f"Audio conversion failed: {conv_err}, using original")

                return audio_data

            except ImportError:
                logger.warning("piper-tts library not available, using fallback")
                return await self._generate_fallback_audio(text)

        except Exception as e:
            logger.error(f"Error synthesizing speech with Piper: {e}")
            # Fallback to simple audio generation
            return await self._generate_fallback_audio(text)

    async def _generate_fallback_audio(self, text: str) -> bytes:
        """
        Generate fallback audio when Piper is not available using gTTS

        Args:
            text: Text to synthesize

        Returns:
            Audio data as bytes (MP3 converted to WAV for compatibility)
        """
        logger.info(f"Generating fallback audio using gTTS for text: '{text[:50]}...' (length: {len(text)})")
        try:
            from gtts import gTTS
            import io

            # Use gTTS to generate speech
            tts = gTTS(text=text, lang='en', slow=False)
            
            # Save to bytes buffer
            mp3_buffer = io.BytesIO()
            tts.write_to_fp(mp3_buffer)
            mp3_buffer.seek(0)
            
            logger.info(f"gTTS generated MP3: {len(mp3_buffer.getvalue())} bytes")
            
            # Try to convert MP3 to WAV for better browser compatibility
            try:
                from pydub import AudioSegment
                
                audio = AudioSegment.from_mp3(mp3_buffer)
                wav_buffer = io.BytesIO()
                audio.export(wav_buffer, format='wav')
                wav_buffer.seek(0)
                audio_data = wav_buffer.getvalue()
                logger.info(f"Converted to WAV: {len(audio_data)} bytes")
                return audio_data
                
            except ImportError:
                # pydub not available, return MP3 directly
                logger.warning("pydub not available, returning MP3 audio")
                mp3_buffer.seek(0)
                return mp3_buffer.getvalue()
                
        except ImportError:
            logger.warning("gTTS not available, generating simple tone")
            return await self._generate_simple_tone(text)
        except Exception as e:
            logger.error(f"Error generating gTTS audio: {e}")
            return await self._generate_simple_tone(text)

    async def _generate_simple_tone(self, text: str) -> bytes:
        """Generate a simple tone as last resort fallback"""
        try:
            import struct
            import math

            sample_rate = 44100
            duration = min(len(text) * 0.02, 1.0)
            frequency = 440.0
            
            samples = []
            num_samples = int(sample_rate * duration)

            for i in range(num_samples):
                t = i / sample_rate
                fade_in = int(sample_rate * 0.05)
                fade_out = int(sample_rate * 0.1)

                if i < fade_in:
                    envelope = math.sin((i / fade_in) * math.pi / 2)
                elif i > num_samples - fade_out:
                    envelope = math.sin(((num_samples - i) / fade_out) * math.pi / 2)
                else:
                    envelope = 1.0

                wave_val = math.sin(2 * math.pi * frequency * t)
                sample = int(32767 * 0.3 * envelope * wave_val)
                samples.append(struct.pack('<h', max(-32767, min(32767, sample))))

            raw_data = b''.join(samples)
            
            wav_header = struct.pack('<4sL4s4sLHHLLHH4sL',
                b'RIFF', 36 + len(raw_data), b'WAVE', b'fmt ', 16, 1, 1,
                sample_rate, sample_rate * 2, 2, 16, b'data', len(raw_data)
            )
            
            return wav_header + raw_data
        except Exception as e:
            logger.error(f"Error generating simple tone: {e}")
            return b''

    async def _download_model(self):
        """Download Piper model if not available"""
        try:
            # This would typically use a download script or API
            # For now, we'll assume models are pre-downloaded
            logger.warning("Model download not implemented - please download models manually")
            raise FileNotFoundError(f"Model files for {self.voice_model} not found")

        except Exception as e:
            logger.error(f"Failed to download model: {e}")
            raise

    def _check_model_files(self) -> bool:
        """Check if required model files exist"""
        return (
            os.path.exists(self.model_path) and
            os.path.exists(self.config_path)
        )

    async def get_available_voices(self) -> List[str]:
        """Get list of available voice models"""
        try:
            # Check models directory for .onnx files
            if not os.path.exists(self.model_dir):
                return []

            voices = []
            for file in os.listdir(self.model_dir):
                if file.endswith('.onnx'):
                    voice_name = file.replace('.onnx', '')
                    voices.append(voice_name)

            return voices

        except Exception as e:
            logger.error(f"Error getting available voices: {e}")
            return []

    def set_voice(self, voice_model: str):
        """Change the current voice model"""
        self.voice_model = voice_model
        self.model_path = os.path.join(self.model_dir, f"{voice_model}.onnx")
        self.config_path = os.path.join(self.model_dir, f"{voice_model}.onnx.json")
        logger.info(f"Voice changed to: {voice_model}")

    def get_voice_info(self) -> Dict[str, Any]:
        """Get information about current voice"""
        return {
            "model": self.voice_model,
            "speed": self.speed,
            "noise_scale": self.noise_scale,
            "noise_w": self.noise_w,
            "length_scale": self.length_scale,
            "model_path": self.model_path,
            "config_path": self.config_path,
            "available": self._check_model_files()
        }

    async def stream_synthesis(self, text_stream: str) -> AsyncGenerator[bytes, None]:
        """
        Stream synthesis for real-time TTS (placeholder for future implementation)

        Args:
            text_stream: Text to synthesize

        Yields:
            Audio chunks as they are generated
        """
        # For now, just synthesize the full text
        # Future implementation could stream token-by-token
        audio_data = await self.synthesize_speech(text_stream)
        if audio_data:
            yield audio_data

    def _text_to_wav_bytes(self, text: str) -> Optional[bytes]:
        """Alternative implementation using direct Piper Python API if available"""
        try:
            # This would use piper's Python API directly if available
            # For now, we use the executable approach above
            return None
        except Exception as e:
            logger.error(f"Direct Piper API not available: {e}")
            return None
