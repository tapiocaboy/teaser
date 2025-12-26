"""
UMAP Projector Service
Projects high-dimensional audio features to 3D space for visualization
"""

import numpy as np
import logging
from typing import List, Optional, Tuple
from collections import deque
import threading
import time

logger = logging.getLogger(__name__)


class UMAPProjector:
    """
    Projects audio features to 3D coordinates using UMAP.
    
    Supports two modes:
    1. Training mode: Collects features to build UMAP model
    2. Projection mode: Projects new features using trained model
    
    Falls back to PCA-like projection if UMAP training is insufficient.
    """
    
    def __init__(
        self,
        n_components: int = 3,
        n_neighbors: int = 10,  # Reduced for faster training
        min_dist: float = 0.1,
        training_samples: int = 50,  # Reduced for faster training
        metric: str = 'euclidean'
    ):
        """
        Initialize the UMAP projector.
        
        Args:
            n_components: Output dimensions (3 for 3D visualization)
            n_neighbors: UMAP neighborhood size
            min_dist: UMAP minimum distance parameter
            training_samples: Number of samples needed for training
            metric: Distance metric for UMAP
        """
        self.n_components = n_components
        self.n_neighbors = n_neighbors
        self.min_dist = min_dist
        self.training_samples = training_samples
        self.metric = metric
        
        # Training state
        self.is_trained = False
        self.is_training = False
        self.training_data: List[np.ndarray] = []
        
        # UMAP model (lazy loaded)
        self._umap_model = None
        self._pca_fallback = None
        
        # Projection bounds for normalization
        self._min_coords: Optional[np.ndarray] = None
        self._max_coords: Optional[np.ndarray] = None
        
        # Thread safety
        self._lock = threading.Lock()
        
        # Recent projections for smoothing
        self._recent_projections = deque(maxlen=5)
        
        logger.info(f"UMAPProjector initialized: {n_components}D output, {training_samples} training samples")
    
    def add_training_sample(self, features: np.ndarray) -> dict:
        """
        Add a feature sample for UMAP training.
        
        Args:
            features: Feature vector from AudioFeatureExtractor
            
        Returns:
            Status dictionary with training progress
        """
        with self._lock:
            if self.is_trained:
                return {
                    'status': 'already_trained',
                    'progress': 1.0,
                    'samples': len(self.training_data)
                }
            
            # Add sample if it's valid (not all zeros)
            if np.any(features != 0):
                self.training_data.append(features.copy())
            
            progress = len(self.training_data) / self.training_samples
            
            # Start training when we have enough samples
            if len(self.training_data) >= self.training_samples and not self.is_training:
                self._start_training()
                return {
                    'status': 'training_started',
                    'progress': progress,
                    'samples': len(self.training_data)
                }
            
            return {
                'status': 'collecting',
                'progress': progress,
                'samples': len(self.training_data),
                'needed': self.training_samples
            }
    
    def _start_training(self):
        """Start UMAP training in background thread."""
        self.is_training = True
        
        def train():
            try:
                logger.info(f"Starting UMAP training with {len(self.training_data)} samples...")
                
                # Import UMAP
                from umap import UMAP
                
                # Stack training data
                X = np.array(self.training_data)
                
                # Fit UMAP
                self._umap_model = UMAP(
                    n_components=self.n_components,
                    n_neighbors=min(self.n_neighbors, len(X) - 1),
                    min_dist=self.min_dist,
                    metric=self.metric,
                    random_state=42
                )
                
                # Transform training data to get bounds
                transformed = self._umap_model.fit_transform(X)
                
                # Store bounds for normalization
                self._min_coords = np.min(transformed, axis=0)
                self._max_coords = np.max(transformed, axis=0)
                
                # Ensure bounds have some range
                coord_range = self._max_coords - self._min_coords
                coord_range[coord_range < 0.001] = 1.0
                self._max_coords = self._min_coords + coord_range
                
                self.is_trained = True
                self.is_training = False
                
                logger.info("UMAP training completed successfully")
                
            except Exception as e:
                logger.error(f"UMAP training failed: {e}")
                self.is_training = False
                # Fall back to PCA
                self._setup_pca_fallback()
        
        # Run training in background
        thread = threading.Thread(target=train, daemon=True)
        thread.start()
    
    def _setup_pca_fallback(self):
        """Set up PCA-based fallback projection."""
        try:
            from sklearn.decomposition import PCA
            
            if len(self.training_data) > 0:
                X = np.array(self.training_data)
                self._pca_fallback = PCA(n_components=self.n_components)
                transformed = self._pca_fallback.fit_transform(X)
                
                self._min_coords = np.min(transformed, axis=0)
                self._max_coords = np.max(transformed, axis=0)
                
                coord_range = self._max_coords - self._min_coords
                coord_range[coord_range < 0.001] = 1.0
                self._max_coords = self._min_coords + coord_range
                
                self.is_trained = True
                logger.info("PCA fallback initialized")
                
        except Exception as e:
            logger.error(f"PCA fallback failed: {e}")
    
    def project(self, features: np.ndarray) -> Tuple[float, float, float]:
        """
        Project features to 3D coordinates.
        
        Args:
            features: Feature vector from AudioFeatureExtractor
            
        Returns:
            Tuple of (x, y, z) coordinates normalized to 0-1 range
        """
        with self._lock:
            if not self.is_trained:
                # Return center position while training
                return (0.5, 0.5, 0.5)
            
            try:
                # Reshape for single sample prediction
                X = features.reshape(1, -1)
                
                if self._umap_model is not None:
                    coords = self._umap_model.transform(X)[0]
                elif self._pca_fallback is not None:
                    coords = self._pca_fallback.transform(X)[0]
                else:
                    return (0.5, 0.5, 0.5)
                
                # Normalize to 0-1 range
                normalized = (coords - self._min_coords) / (self._max_coords - self._min_coords)
                normalized = np.clip(normalized, 0, 1)
                
                # Add to recent projections for smoothing
                self._recent_projections.append(normalized)
                
                # Average recent projections
                if len(self._recent_projections) > 1:
                    smoothed = np.mean(self._recent_projections, axis=0)
                else:
                    smoothed = normalized
                
                return tuple(float(x) for x in smoothed)
                
            except Exception as e:
                logger.warning(f"Projection error: {e}")
                return (0.5, 0.5, 0.5)
    
    def project_batch(self, features_batch: List[np.ndarray]) -> List[Tuple[float, float, float]]:
        """
        Project a batch of features to 3D coordinates.
        
        Args:
            features_batch: List of feature vectors
            
        Returns:
            List of (x, y, z) coordinate tuples
        """
        return [self.project(f) for f in features_batch]
    
    def get_status(self) -> dict:
        """Get current projector status."""
        return {
            'is_trained': self.is_trained,
            'is_training': self.is_training,
            'training_samples': len(self.training_data),
            'training_target': self.training_samples,
            'progress': len(self.training_data) / self.training_samples,
            'model_type': 'umap' if self._umap_model else ('pca' if self._pca_fallback else 'none')
        }
    
    def reset(self):
        """Reset the projector to initial state."""
        with self._lock:
            self.is_trained = False
            self.is_training = False
            self.training_data.clear()
            self._umap_model = None
            self._pca_fallback = None
            self._min_coords = None
            self._max_coords = None
            self._recent_projections.clear()
            logger.info("UMAPProjector reset")
    
    def force_train(self):
        """Force training with current samples (if >= 10 samples)."""
        with self._lock:
            if len(self.training_data) >= 10 and not self.is_training:
                self._start_training()
                return True
            return False

