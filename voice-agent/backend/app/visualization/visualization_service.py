"""
Visualization Service
Orchestrates audio feature extraction and UMAP projection for real-time visualization
"""

import numpy as np
import logging
import asyncio
from typing import Dict, Optional, Callable, Any
from dataclasses import dataclass
from datetime import datetime
import json

from .audio_features import AudioFeatureExtractor
from .umap_projector import UMAPProjector

logger = logging.getLogger(__name__)


@dataclass
class VisualizationFrame:
    """Single frame of visualization data."""
    timestamp: float
    x: float
    y: float
    z: float
    rms: float
    centroid: float
    is_trained: bool
    training_progress: float
    spectral_spread: float = 0.5
    tonality: float = 0.5
    zcr: float = 0.0
    rolloff: float = 0.5
    
    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp,
            'coords': {'x': self.x, 'y': self.y, 'z': self.z},
            'rms': self.rms,
            'centroid': self.centroid,
            'is_trained': self.is_trained,
            'training_progress': self.training_progress,
            'spectral_spread': self.spectral_spread,
            'tonality': self.tonality,
            'zcr': self.zcr,
            'rolloff': self.rolloff
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())


class VisualizationService:
    """
    Main service for audio visualization.
    
    Handles:
    - Audio feature extraction
    - UMAP training and projection
    - Real-time coordinate streaming
    - Session management
    """
    
    def __init__(
        self,
        sample_rate: int = 16000,
        n_mfcc: int = 13,
        smooth_factor: float = 0.3,
        training_samples: int = 50,  # Reduced for faster training
        training_duration_seconds: float = 5.0
    ):
        """
        Initialize the visualization service.
        
        Args:
            sample_rate: Audio sample rate
            n_mfcc: Number of MFCC coefficients
            smooth_factor: Feature smoothing factor
            training_samples: Samples needed for UMAP training
            training_duration_seconds: Approximate training duration
        """
        self.sample_rate = sample_rate
        
        # Initialize components
        self.feature_extractor = AudioFeatureExtractor(
            sample_rate=sample_rate,
            n_mfcc=n_mfcc,
            smooth_factor=smooth_factor
        )
        
        self.umap_projector = UMAPProjector(
            training_samples=training_samples
        )
        
        # Session state
        self._active_sessions: Dict[str, dict] = {}
        self._frame_count = 0
        
        logger.info(f"VisualizationService initialized: {sample_rate}Hz, {n_mfcc} MFCCs")
    
    async def process_audio_chunk(
        self,
        audio_data: np.ndarray,
        session_id: str = "default"
    ) -> VisualizationFrame:
        """
        Process an audio chunk and return visualization coordinates.
        
        Args:
            audio_data: Audio samples as numpy array
            session_id: Session identifier for multi-user support
            
        Returns:
            VisualizationFrame with coordinates and metadata
        """
        # Extract features
        features = self.feature_extractor.extract_features(audio_data)
        feature_vector = features['features']
        
        # Get projector status
        status = self.umap_projector.get_status()
        
        # Add training sample if not trained
        if not status['is_trained'] and not status['is_training']:
            self.umap_projector.add_training_sample(feature_vector)
            status = self.umap_projector.get_status()
        
        # Project to 3D coordinates
        x, y, z = self.umap_projector.project(feature_vector)
        
        # Create frame
        frame = VisualizationFrame(
            timestamp=datetime.now().timestamp(),
            x=x,
            y=y,
            z=z,
            rms=features['rms'],
            centroid=features['centroid'],
            is_trained=status['is_trained'],
            training_progress=status['progress']
        )
        
        self._frame_count += 1
        
        return frame
    
    async def process_audio_bytes(
        self,
        audio_bytes: bytes,
        session_id: str = "default"
    ) -> VisualizationFrame:
        """
        Process raw audio bytes and return visualization coordinates.
        
        Args:
            audio_bytes: Raw audio data (16-bit PCM)
            session_id: Session identifier
            
        Returns:
            VisualizationFrame with coordinates and metadata
        """
        # Convert bytes to numpy array
        audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_data = audio_data.astype(np.float32) / 32768.0
        
        return await self.process_audio_chunk(audio_data, session_id)
    
    async def process_stream_chunk(
        self,
        chunk: bytes,
        session_id: str = "default"
    ) -> VisualizationFrame:
        """
        Process a streaming audio chunk.
        Uses internal buffer for continuous feature extraction.
        
        Args:
            chunk: Raw audio chunk (16-bit PCM)
            session_id: Session identifier
            
        Returns:
            VisualizationFrame with coordinates
        """
        # Convert bytes to numpy
        audio_data = np.frombuffer(chunk, dtype=np.int16)
        audio_data = audio_data.astype(np.float32) / 32768.0
        
        # Use streaming feature extraction
        features = self.feature_extractor.process_stream_chunk(audio_data)
        feature_vector = features['features']
        
        # Get projector status
        status = self.umap_projector.get_status()
        
        # Add training sample if not trained (extremely low threshold for max sensitivity)
        if not status['is_trained'] and not status['is_training']:
            if features['rms'] > 0.0001:  # Extremely low threshold to capture any audio
                self.umap_projector.add_training_sample(feature_vector)
                status = self.umap_projector.get_status()
        
        # Project to 3D coordinates
        x, y, z = self.umap_projector.project(feature_vector)
        
        return VisualizationFrame(
            timestamp=datetime.now().timestamp(),
            x=x,
            y=y,
            z=z,
            rms=features['rms'],
            centroid=features['centroid'],
            is_trained=status['is_trained'],
            training_progress=status['progress'],
            spectral_spread=features.get('spectral_spread', 0.5),
            tonality=features.get('tonality', 0.5),
            zcr=features.get('zcr', 0.0),
            rolloff=features.get('rolloff', 0.5)
        )
    
    def get_status(self) -> Dict:
        """Get current service status."""
        projector_status = self.umap_projector.get_status()
        
        return {
            'service': 'visualization',
            'status': 'ready',
            'sample_rate': self.sample_rate,
            'feature_dim': self.feature_extractor.feature_dim,
            'frames_processed': self._frame_count,
            'umap': projector_status,
            'active_sessions': len(self._active_sessions)
        }
    
    def start_session(self, session_id: str) -> Dict:
        """Start a new visualization session."""
        self._active_sessions[session_id] = {
            'started_at': datetime.now().isoformat(),
            'frames': 0
        }
        logger.info(f"Visualization session started: {session_id}")
        return {'session_id': session_id, 'status': 'started'}
    
    def end_session(self, session_id: str) -> Dict:
        """End a visualization session."""
        if session_id in self._active_sessions:
            session = self._active_sessions.pop(session_id)
            logger.info(f"Visualization session ended: {session_id}, frames: {session.get('frames', 0)}")
            return {'session_id': session_id, 'status': 'ended'}
        return {'session_id': session_id, 'status': 'not_found'}
    
    def reset(self, reset_umap: bool = True):
        """
        Reset the visualization service.
        
        Args:
            reset_umap: Whether to reset UMAP training
        """
        self.feature_extractor.reset()
        if reset_umap:
            self.umap_projector.reset()
        self._frame_count = 0
        self._active_sessions.clear()
        logger.info("VisualizationService reset")
    
    def force_train_umap(self) -> bool:
        """Force UMAP training with current samples."""
        return self.umap_projector.force_train()
    
    async def create_visualization_generator(
        self,
        audio_generator,
        session_id: str = "default"
    ):
        """
        Create an async generator that yields visualization frames.
        
        Args:
            audio_generator: Async generator yielding audio chunks
            session_id: Session identifier
            
        Yields:
            VisualizationFrame for each audio chunk
        """
        self.start_session(session_id)
        
        try:
            async for chunk in audio_generator:
                frame = await self.process_stream_chunk(chunk, session_id)
                yield frame
        finally:
            self.end_session(session_id)


# Global instance for shared use
_visualization_service: Optional[VisualizationService] = None


def get_visualization_service() -> VisualizationService:
    """Get or create the global visualization service instance."""
    global _visualization_service
    if _visualization_service is None:
        _visualization_service = VisualizationService()
    return _visualization_service


def reset_visualization_service():
    """Reset the global visualization service."""
    global _visualization_service
    if _visualization_service is not None:
        _visualization_service.reset()

