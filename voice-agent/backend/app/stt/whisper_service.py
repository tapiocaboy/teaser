"""
Whisper Speech-to-Text Service
"""
import logging
from typing import Optional, List, Tuple
import io
import tempfile
import os
import subprocess
import numpy as np

logger = logging.getLogger(__name__)

class WhisperSTT:
    def __init__(self, model_size: str = "base", device: str = "cpu", compute_type: str = "int8"):
        """
        Initialize Whisper STT service

        Args:
            model_size: Model size (tiny, base, small, medium, large)
            device: Device to run on (cpu, cuda)
            compute_type: Compute type for quantization (int8, float16, float32)
        """
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type

        logger.info(f"Loading Whisper model: {model_size} on {device}")

        try:
            from faster_whisper import WhisperModel
            self.model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                download_root="./models/whisper"
            )
            logger.info("Whisper model loaded successfully")
        except ImportError as e:
            logger.error(f"Failed to import faster_whisper: {e}")
            raise RuntimeError("faster_whisper not available. Install with: poetry add faster-whisper")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise RuntimeError(f"Could not load Whisper model: {e}")

    async def transcribe_audio(self, audio_data: bytes, language: Optional[str] = None) -> str:
        """
        Transcribe audio data to text using Whisper

        Args:
            audio_data: Raw audio bytes
            language: Language code (optional, auto-detect if None)

        Returns:
            Transcribed text
        """
        try:
            if self.model is None:
                raise RuntimeError("Whisper model not loaded")

            logger.info(f"Processing {len(audio_data)} bytes of audio data")

            # Convert audio bytes to numpy array
            audio_array = self._bytes_to_array(audio_data)

            if len(audio_array) == 0:
                logger.warning("Audio conversion resulted in empty array")
                return "No audio data received"

            logger.info(f"Audio array shape: {audio_array.shape}, dtype: {audio_array.dtype}, range: [{audio_array.min():.3f}, {audio_array.max():.3f}]")

            # Run transcription
            segments, info = self.model.transcribe(
                audio_array,
                language=language,
                beam_size=5,
                patience=1.0,
                length_penalty=1.0,
                repetition_penalty=1.0,
                no_repeat_ngram_size=0,
                initial_prompt=None,
                suppress_blank=True,
                suppress_tokens=[-1],
                without_timestamps=True,
                max_initial_timestamp=1.0,
                hallucination_silence_threshold=None,
            )

            # Log transcription info
            logger.info(f"Transcription info: language={info.language}, duration={info.duration:.2f}s")

            # Collect all text segments
            text_segments = [segment.text for segment in segments]
            full_text = " ".join(text_segments).strip()

            logger.info(f"Transcribed {len(audio_data)} bytes to: '{full_text}' ({len(full_text)} characters)")
            return full_text if full_text else "No speech detected in audio"

        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            raise RuntimeError(f"Speech transcription failed: {e}")

    def _bytes_to_array(self, audio_bytes: bytes):
        """
        Convert audio bytes to numpy array, handling various formats

        Args:
            audio_bytes: Raw audio data (WebM, WAV, etc.)

        Returns:
            Audio as numpy array (float32, normalized to [-1, 1])
        """
        try:
            # Check if we have audio data
            if not audio_bytes or len(audio_bytes) < 100:
                logger.warning(f"Audio data too small: {len(audio_bytes)} bytes")
                return np.array([])

            # Try to use ffmpeg for format conversion (handles WebM, etc.)
            try:
                # Create temporary files for input and output
                with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as input_temp:
                    input_temp.write(audio_bytes)
                    input_path = input_temp.name

                output_path = input_path + '_converted.wav'

                try:
                    logger.info(f"Converting {len(audio_bytes)} bytes WebM file: {input_path}")

                    # Use ffmpeg to convert WebM to WAV (16kHz mono)
                    cmd = [
                        'ffmpeg', '-y', '-i', input_path,
                        '-ac', '1', '-ar', '16000', '-f', 'wav',
                        output_path
                    ]

                    logger.info(f"Running ffmpeg command: {' '.join(cmd)}")
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

                    if result.returncode != 0:
                        logger.error(f"ffmpeg conversion failed: {result.stderr}")
                        logger.error(f"ffmpeg stdout: {result.stdout}")
                        # Let's try a different approach - maybe the input isn't WebM
                        logger.info("Trying direct WAV parsing as fallback...")
                        raise RuntimeError(f"ffmpeg failed: {result.stderr}")

                    # Check if output file was created
                    if not os.path.exists(output_path):
                        logger.error(f"ffmpeg didn't create output file: {output_path}")
                        raise RuntimeError("ffmpeg didn't create output file")

                    output_size = os.path.getsize(output_path)
                    logger.info(f"Created WAV file: {output_path}, size: {output_size} bytes")

                    # Load the converted WAV file
                    import scipy.io.wavfile
                    sample_rate, audio_data = scipy.io.wavfile.read(output_path)

                    logger.info(f"WAV loaded: sample_rate={sample_rate}, shape={audio_data.shape}, dtype={audio_data.dtype}")

                    # Convert to float32 and normalize
                    if audio_data.dtype != np.float32:
                        if audio_data.dtype == np.int16:
                            samples = audio_data.astype(np.float32) / 32768.0
                        elif audio_data.dtype == np.int32:
                            samples = audio_data.astype(np.float32) / 2147483648.0
                        else:
                            samples = audio_data.astype(np.float32)
                    else:
                        samples = audio_data

                    logger.info(f"Final audio array: shape={samples.shape}, dtype={samples.dtype}, range=[{samples.min():.3f}, {samples.max():.3f}]")
                    return samples

                finally:
                    # Clean up temp files
                    for path in [input_path, output_path]:
                        try:
                            os.unlink(path)
                        except OSError:
                            pass

            except (subprocess.SubprocessError, FileNotFoundError, ImportError) as e:
                logger.warning(f"ffmpeg conversion failed ({e}), trying direct WAV parsing")

            # Fallback 1: Try to parse as WAV directly
            try:
                import scipy.io.wavfile
                logger.info("Trying to parse audio data as WAV directly...")
                # Create a temporary file and try to read it as WAV
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                    temp_file.write(audio_bytes)
                    temp_path = temp_file.name

                try:
                    sample_rate, audio_data = scipy.io.wavfile.read(temp_path)
                    logger.info(f"Direct WAV parsing succeeded: rate={sample_rate}, shape={audio_data.shape}")

                    # Convert to float32 and normalize
                    if audio_data.dtype == np.int16:
                        samples = audio_data.astype(np.float32) / 32768.0
                    else:
                        samples = audio_data.astype(np.float32)

                    return samples
                finally:
                    os.unlink(temp_path)

            except Exception as e2:
                logger.warning(f"Direct WAV parsing failed ({e2}), trying raw PCM conversion")

            # Fallback: assume it's already 16-bit PCM at 16kHz
            logger.warning("Using fallback audio conversion - may not work with WebM")
            samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            return samples

        except Exception as e:
            logger.error(f"Error converting audio bytes to array: {e}")
            # Return empty array as fallback
            return np.array([])

    async def transcribe_file(self, file_path: str, language: Optional[str] = None) -> str:
        """
        Transcribe audio from file path

        Args:
            file_path: Path to audio file
            language: Language code (optional)

        Returns:
            Transcribed text
        """
        try:
            segments, info = self.model.transcribe(
                file_path,
                language=language,
                without_timestamps=True
            )

            text_segments = [segment.text for segment in segments]
            return " ".join(text_segments).strip()

        except Exception as e:
            logger.error(f"Error transcribing file {file_path}: {e}")
            raise

    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages"""
        return [
            "en", "zh", "de", "es", "ru", "ko", "fr", "ja", "pt", "tr", "pl", "ca", "nl",
            "ar", "sv", "it", "id", "hi", "fi", "vi", "he", "uk", "el", "ms", "cs", "ro",
            "da", "hu", "ta", "no", "th", "ur", "hr", "bg", "lt", "la", "mi", "ml", "cy",
            "sk", "te", "fa", "lv", "bn", "sr", "az", "sl", "kn", "et", "mk", "br", "eu",
            "is", "hy", "ne", "mn", "bs", "kk", "sq", "sw", "gl", "mr", "pa", "si", "km",
            "sn", "yo", "so", "af", "oc", "ka", "be", "tg", "sd", "gu", "am", "yi", "lo",
            "uz", "fo", "ht", "ps", "tk", "nn", "mt", "sa", "lb", "my", "bo", "tl", "mg",
            "as", "tt", "haw", "ln", "ha", "ba", "jw", "su"
        ]
