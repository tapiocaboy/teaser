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
        Generate fallback audio when Piper is not available

        Args:
            text: Text to synthesize

        Returns:
            Simple audio data as bytes
        """
        logger.info(f"Generating fallback audio for text: '{text[:50]}...' (length: {len(text)})")
        try:
            import wave
            import struct

            # Create a simple tone based on text length
            sample_rate = 44100  # Standard sample rate for better browser compatibility
            duration = min(len(text) * 0.05, 2.0)  # Shorter duration
            frequency = 600  # Hz

            # Generate simple, clean sine wave (much more reliable for testing)
            import math
            samples = []
            num_samples = int(sample_rate * duration)

            # Simple sine wave at 440Hz (A note) - very clean and recognizable
            frequency = 440.0

            for i in range(num_samples):
                t = i / sample_rate

                # Smooth envelope to avoid clicks
                fade_in_samples = int(sample_rate * 0.05)  # 50ms fade in
                fade_out_samples = int(sample_rate * 0.1)  # 100ms fade out

                if i < fade_in_samples:
                    envelope = math.sin((i / fade_in_samples) * math.pi / 2)
                elif i > num_samples - fade_out_samples:
                    envelope = math.sin(((num_samples - i) / fade_out_samples) * math.pi / 2)
                else:
                    envelope = 1.0

                # Pure sine wave
                wave = math.sin(2 * math.pi * frequency * t)
                sample = int(32767 * 0.3 * envelope * wave)
                sample = max(-32767, min(32767, sample))
                samples.append(struct.pack('<h', sample))

            # Create raw PCM data for Web Audio API (no WAV wrapper needed)
            raw_data = b''.join(samples)
            logger.info(f"Generated raw PCM audio: {len(raw_data)} bytes, {len(samples)} samples")

            # For Web Audio API, we can send raw PCM data and specify format on frontend
            # But for compatibility, let's create a minimal WAV header
            wav_header = struct.pack('<4sL4s4sLHHLLHH4sL',
                b'RIFF',                    # ChunkID
                36 + len(raw_data),         # ChunkSize
                b'WAVE',                    # Format
                b'fmt ',                    # Subchunk1ID
                16,                         # Subchunk1Size
                1,                          # AudioFormat (PCM)
                1,                          # NumChannels (mono)
                sample_rate,               # SampleRate
                sample_rate * 1 * 2,       # ByteRate
                1 * 2,                     # BlockAlign
                16,                        # BitsPerSample
                b'data',                   # Subchunk2ID
                len(raw_data)              # Subchunk2Size
            )

            audio_data = wav_header + raw_data
            logger.info(f"Created WAV with header, total size: {len(audio_data)} bytes")
            return audio_data

        except Exception as e:
            logger.error(f"Error generating fallback audio: {e}")
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
