"""
Audio Feature Extraction Service
Extracts MFCC and spectral features from audio for UMAP visualization
"""

import numpy as np
import logging
from typing import Dict, Optional, Tuple
from collections import deque
import io

logger = logging.getLogger(__name__)


class AudioFeatureExtractor:
    """
    Extracts audio features for UMAP-based visualization.
    
    Features extracted:
    - MFCCs (Mel-frequency cepstral coefficients) - captures timbre
    - Delta MFCCs - captures temporal evolution
    - Spectral centroid - brightness of sound
    - Spectral rolloff - frequency distribution
    - RMS energy - loudness
    - Zero crossing rate - noisiness
    """
    
    def __init__(
        self,
        sample_rate: int = 16000,
        n_mfcc: int = 13,
        n_fft: int = 2048,
        hop_length: int = 512,
        buffer_seconds: float = 0.5,  # Increased from 0.1 for more stable features
        smooth_factor: float = 0.3
    ):
        """
        Initialize the feature extractor.
        
        Args:
            sample_rate: Audio sample rate in Hz
            n_mfcc: Number of MFCC coefficients to extract
            n_fft: FFT window size
            hop_length: Number of samples between frames
            buffer_seconds: Duration of audio buffer for feature extraction
            smooth_factor: Exponential smoothing factor (0-1, lower = smoother)
        """
        self.sample_rate = sample_rate
        self.n_mfcc = n_mfcc
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.buffer_seconds = buffer_seconds
        self.smooth_factor = smooth_factor
        
        # Calculate buffer size - need enough samples for stable MFCC extraction
        # Minimum ~0.5 seconds for reliable delta calculation
        self.buffer_size = int(sample_rate * buffer_seconds)
        self.min_samples = int(sample_rate * 0.3)  # Minimum 300ms of audio
        
        # Audio buffer for continuous streaming - larger buffer for accumulation
        self.audio_buffer = deque(maxlen=int(sample_rate * 2))  # 2 seconds max
        
        # Smoothed features for stable visualization
        self._smoothed_features: Optional[np.ndarray] = None
        self._smoothed_rms: float = 0.0
        self._smoothed_centroid: float = 0.0
        
        # Feature dimension (MFCCs + deltas + spectral features)
        # n_mfcc * 3 (mfcc, delta, delta2) + 4 (centroid, rolloff, rms, zcr)
        self.feature_dim = n_mfcc * 3 + 4
        
        # Lazy import librosa to avoid startup delay
        self._librosa = None
        
        logger.info(f"AudioFeatureExtractor initialized: {self.feature_dim}D features, buffer={buffer_seconds}s")
    
    def _get_librosa(self):
        """Lazy load librosa for faster startup."""
        if self._librosa is None:
            import librosa
            self._librosa = librosa
        return self._librosa
    
    def extract_features(self, audio_data: np.ndarray) -> Dict:
        """
        Extract features from audio data.
        
        Args:
            audio_data: Audio samples as numpy array (float32, -1 to 1)
            
        Returns:
            Dictionary containing:
            - features: Combined feature vector (for UMAP)
            - rms: Root mean square energy (loudness)
            - centroid: Spectral centroid (brightness)
            - mfcc: Raw MFCC coefficients
        """
        librosa = self._get_librosa()
        
        # Ensure audio is float32 and normalized
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)
        
        if len(audio_data) < self.min_samples:
            # Not enough audio data yet, return smoothed previous or silent
            if self._smoothed_features is not None:
                return {
                    'features': self._smoothed_features,
                    'rms': self._smoothed_rms,
                    'centroid': self._smoothed_centroid,
                    'mfcc': [0.0] * self.n_mfcc,
                    'feature_dim': self.feature_dim
                }
            return self._get_silent_features()
        
        # Normalize if needed
        max_val = np.abs(audio_data).max()
        if max_val > 1.0:
            audio_data = audio_data / max_val
        elif max_val < 0.001:
            # Very quiet audio - return smoothed previous
            if self._smoothed_features is not None:
                return {
                    'features': self._smoothed_features,
                    'rms': self._smoothed_rms,
                    'centroid': self._smoothed_centroid,
                    'mfcc': [0.0] * self.n_mfcc,
                    'feature_dim': self.feature_dim
                }
            return self._get_silent_features()
        
        try:
            # Use appropriate n_fft for the audio length
            effective_n_fft = min(self.n_fft, len(audio_data))
            # Ensure n_fft is power of 2 for efficiency
            effective_n_fft = 2 ** int(np.log2(effective_n_fft))
            effective_n_fft = max(512, effective_n_fft)  # Minimum 512
            
            # Extract MFCCs
            mfcc = librosa.feature.mfcc(
                y=audio_data,
                sr=self.sample_rate,
                n_mfcc=self.n_mfcc,
                n_fft=effective_n_fft,
                hop_length=self.hop_length
            )
            
            # Calculate delta width based on available frames
            n_frames = mfcc.shape[1]
            
            # Delta requires at least width frames (default is 9)
            # Use adaptive width or zeros if not enough frames
            if n_frames >= 9:
                delta_width = 9
            elif n_frames >= 5:
                delta_width = 5
            elif n_frames >= 3:
                delta_width = 3
            else:
                delta_width = 0  # Can't compute deltas
            
            if delta_width > 0:
                try:
                    mfcc_delta = librosa.feature.delta(mfcc, width=delta_width)
                    mfcc_delta2 = librosa.feature.delta(mfcc, order=2, width=delta_width)
                except Exception:
                    # Fallback to zeros if delta still fails
                    mfcc_delta = np.zeros_like(mfcc)
                    mfcc_delta2 = np.zeros_like(mfcc)
            else:
                mfcc_delta = np.zeros_like(mfcc)
                mfcc_delta2 = np.zeros_like(mfcc)
            
            # Spectral features
            spectral_centroid = librosa.feature.spectral_centroid(
                y=audio_data,
                sr=self.sample_rate,
                n_fft=effective_n_fft,
                hop_length=self.hop_length
            )
            
            spectral_rolloff = librosa.feature.spectral_rolloff(
                y=audio_data,
                sr=self.sample_rate,
                n_fft=effective_n_fft,
                hop_length=self.hop_length
            )
            
            # RMS energy
            rms = librosa.feature.rms(
                y=audio_data,
                frame_length=effective_n_fft,
                hop_length=self.hop_length
            )
            
            # Zero crossing rate
            zcr = librosa.feature.zero_crossing_rate(
                audio_data,
                frame_length=effective_n_fft,
                hop_length=self.hop_length
            )
            
            # Additional spectral features for enhanced visualization
            try:
                # Spectral bandwidth (spread)
                spectral_bandwidth = librosa.feature.spectral_bandwidth(
                    y=audio_data,
                    sr=self.sample_rate,
                    n_fft=effective_n_fft,
                    hop_length=self.hop_length
                )
                spectral_bandwidth_mean = float(np.mean(spectral_bandwidth))
                spectral_spread = min(spectral_bandwidth_mean / (self.sample_rate / 4), 1.0)
            except:
                spectral_spread = 0.5
            
            try:
                # Spectral flatness (tonality - inverse)
                spectral_flatness = librosa.feature.spectral_flatness(
                    y=audio_data,
                    n_fft=effective_n_fft,
                    hop_length=self.hop_length
                )
                tonality = 1.0 - float(np.mean(spectral_flatness))  # Higher = more tonal
            except:
                tonality = 0.5
            
            # Average over time frames
            mfcc_mean = np.mean(mfcc, axis=1)
            mfcc_delta_mean = np.mean(mfcc_delta, axis=1)
            mfcc_delta2_mean = np.mean(mfcc_delta2, axis=1)
            
            centroid_mean = np.mean(spectral_centroid)
            rolloff_mean = np.mean(spectral_rolloff)
            rms_mean = float(np.mean(rms))
            zcr_mean = np.mean(zcr)
            
            # Normalize spectral features to 0-1 range
            centroid_normalized = min(centroid_mean / (self.sample_rate / 2), 1.0)
            rolloff_normalized = min(rolloff_mean / (self.sample_rate / 2), 1.0)
            
            # Combine all features into single vector
            features = np.concatenate([
                mfcc_mean,
                mfcc_delta_mean,
                mfcc_delta2_mean,
                [centroid_normalized, rolloff_normalized, rms_mean, zcr_mean]
            ])
            
            # Apply exponential smoothing
            features = self._smooth_features(features)
            rms_smoothed = self._smooth_value(rms_mean, 'rms')
            centroid_smoothed = self._smooth_value(float(centroid_normalized), 'centroid')
            
            return {
                'features': features,
                'rms': float(rms_smoothed),
                'centroid': float(centroid_smoothed),
                'mfcc': mfcc_mean.tolist(),
                'feature_dim': self.feature_dim,
                'spectral_spread': float(spectral_spread),
                'tonality': float(tonality),
                'zcr': float(np.mean(zcr)),
                'rolloff': float(rolloff_normalized)
            }
            
        except Exception as e:
            logger.debug(f"Feature extraction skipped: {e}")
            # Return smoothed previous features instead of zeros
            if self._smoothed_features is not None:
                return {
                    'features': self._smoothed_features,
                    'rms': self._smoothed_rms,
                    'centroid': self._smoothed_centroid,
                    'mfcc': [0.0] * self.n_mfcc,
                    'feature_dim': self.feature_dim
                }
            return self._get_silent_features()
    
    def extract_features_from_bytes(self, audio_bytes: bytes) -> Dict:
        """
        Extract features from raw audio bytes.
        
        Args:
            audio_bytes: Raw audio data (16-bit PCM)
            
        Returns:
            Feature dictionary
        """
        try:
            # Convert bytes to numpy array (assuming 16-bit PCM)
            audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
            audio_data = audio_data.astype(np.float32) / 32768.0
            
            return self.extract_features(audio_data)
        except Exception as e:
            logger.error(f"Error converting audio bytes: {e}")
            return self._get_silent_features()
    
    def process_stream_chunk(self, chunk: np.ndarray) -> Dict:
        """
        Process a streaming audio chunk.
        Maintains internal buffer for continuous feature extraction.
        
        Args:
            chunk: Audio chunk as numpy array
            
        Returns:
            Feature dictionary
        """
        # Add chunk to buffer
        self.audio_buffer.extend(chunk.flatten())
        
        # Only extract features when we have enough audio
        if len(self.audio_buffer) >= self.min_samples:
            # Use the most recent buffer_size samples
            buffer_array = np.array(list(self.audio_buffer))
            if len(buffer_array) > self.buffer_size:
                buffer_array = buffer_array[-self.buffer_size:]
            return self.extract_features(buffer_array)
        
        # Return smoothed previous or silent while accumulating
        if self._smoothed_features is not None:
            return {
                'features': self._smoothed_features,
                'rms': self._smoothed_rms,
                'centroid': self._smoothed_centroid,
                'mfcc': [0.0] * self.n_mfcc,
                'feature_dim': self.feature_dim
            }
        return self._get_silent_features()
    
    def _smooth_features(self, features: np.ndarray) -> np.ndarray:
        """Apply exponential smoothing to features."""
        if self._smoothed_features is None:
            self._smoothed_features = features.copy()
        else:
            self._smoothed_features = (
                self.smooth_factor * features + 
                (1 - self.smooth_factor) * self._smoothed_features
            )
        return self._smoothed_features.copy()
    
    def _smooth_value(self, value: float, key: str) -> float:
        """Apply exponential smoothing to a single value."""
        if key == 'rms':
            self._smoothed_rms = (
                self.smooth_factor * value + 
                (1 - self.smooth_factor) * self._smoothed_rms
            )
            return self._smoothed_rms
        elif key == 'centroid':
            self._smoothed_centroid = (
                self.smooth_factor * value + 
                (1 - self.smooth_factor) * self._smoothed_centroid
            )
            return self._smoothed_centroid
        return value
    
    def _get_silent_features(self) -> Dict:
        """Return features for silent/no audio."""
        return {
            'features': np.zeros(self.feature_dim),
            'rms': 0.0,
            'centroid': 0.0,
            'mfcc': [0.0] * self.n_mfcc,
            'feature_dim': self.feature_dim
        }
    
    def reset(self):
        """Reset internal buffers and smoothing state."""
        self.audio_buffer.clear()
        self._smoothed_features = None
        self._smoothed_rms = 0.0
        self._smoothed_centroid = 0.0
        logger.info("AudioFeatureExtractor reset")
