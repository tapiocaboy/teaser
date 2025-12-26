/**
 * AudioVisualizer3D Component
 * Real-time 3D visualization of audio using UMAP projection
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  Visibility,
  VisibilityOff,
  FiberManualRecord,
  Settings,
} from '@mui/icons-material';
import VisualizationService from '../services/VisualizationService';

// Simple 3D renderer using Canvas 2D (no Three.js dependency)
class Canvas3DRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Camera settings
    this.cameraDistance = 3;
    this.rotationX = 0.3;
    this.rotationY = 0;
    this.autoRotate = true;
    
    // Trail history
    this.trail = [];
    this.maxTrailLength = 100;
    
    // Current point
    this.currentPoint = { x: 0.5, y: 0.5, z: 0.5 };
    this.rms = 0;
    this.centroid = 0.5;
    
    // Animation
    this.animationId = null;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  project(x, y, z) {
    // Center the point (0.5, 0.5, 0.5 becomes 0, 0, 0)
    const cx = (x - 0.5) * 2;
    const cy = (y - 0.5) * 2;
    const cz = (z - 0.5) * 2;
    
    // Apply rotation
    const cosY = Math.cos(this.rotationY);
    const sinY = Math.sin(this.rotationY);
    const cosX = Math.cos(this.rotationX);
    const sinX = Math.sin(this.rotationX);
    
    // Rotate around Y axis
    const x1 = cx * cosY - cz * sinY;
    const z1 = cx * sinY + cz * cosY;
    
    // Rotate around X axis
    const y1 = cy * cosX - z1 * sinX;
    const z2 = cy * sinX + z1 * cosX;
    
    // Perspective projection
    const scale = this.cameraDistance / (this.cameraDistance + z2);
    const screenX = this.width / 2 + x1 * scale * this.width * 0.3;
    const screenY = this.height / 2 - y1 * scale * this.height * 0.3;
    
    return { x: screenX, y: screenY, scale, depth: z2 };
  }

  updatePoint(coords, rms, centroid) {
    this.currentPoint = coords;
    this.rms = rms;
    this.centroid = centroid;
    
    // Add to trail
    this.trail.push({ ...coords, rms, centroid, time: Date.now() });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
  }

  render() {
    const ctx = this.ctx;
    
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#0a0f1a');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw grid
    this.drawGrid();
    
    // Draw axes
    this.drawAxes();
    
    // Draw trail
    this.drawTrail();
    
    // Draw current point
    this.drawCurrentPoint();
    
    // Auto-rotate
    if (this.autoRotate) {
      this.rotationY += 0.005;
    }
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.1)';
    ctx.lineWidth = 1;
    
    // Draw floor grid
    const gridSize = 10;
    for (let i = 0; i <= gridSize; i++) {
      const t = i / gridSize;
      
      // Lines along X
      const start = this.project(t, 0, 0);
      const end = this.project(t, 0, 1);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      
      // Lines along Z
      const start2 = this.project(0, 0, t);
      const end2 = this.project(1, 0, t);
      ctx.beginPath();
      ctx.moveTo(start2.x, start2.y);
      ctx.lineTo(end2.x, end2.y);
      ctx.stroke();
    }
  }

  drawAxes() {
    const ctx = this.ctx;
    const origin = this.project(0, 0, 0);
    
    // X axis (red)
    const xEnd = this.project(1, 0, 0);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.5)';
    ctx.lineWidth = 2;
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(xEnd.x, xEnd.y);
    ctx.stroke();
    
    // Y axis (green)
    const yEnd = this.project(0, 1, 0);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(22, 163, 74, 0.5)';
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(yEnd.x, yEnd.y);
    ctx.stroke();
    
    // Z axis (blue)
    const zEnd = this.project(0, 0, 1);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.5)';
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(zEnd.x, zEnd.y);
    ctx.stroke();
  }

  drawTrail() {
    const ctx = this.ctx;
    
    if (this.trail.length < 2) return;
    
    for (let i = 1; i < this.trail.length; i++) {
      const prev = this.trail[i - 1];
      const curr = this.trail[i];
      
      const p1 = this.project(prev.x, prev.y, prev.z);
      const p2 = this.project(curr.x, curr.y, curr.z);
      
      // Fade based on age
      const alpha = (i / this.trail.length) * 0.8;
      
      // Color based on centroid (blue to red)
      const r = Math.floor(220 * curr.centroid);
      const g = Math.floor(100 * (1 - curr.centroid));
      const b = Math.floor(235 * (1 - curr.centroid));
      
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 1 + curr.rms * 3;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  drawCurrentPoint() {
    const ctx = this.ctx;
    const { x, y, z } = this.currentPoint;
    const projected = this.project(x, y, z);
    
    // Base radius affected by RMS
    const baseRadius = 8 + this.rms * 30;
    
    // Glow effect
    const glowGradient = ctx.createRadialGradient(
      projected.x, projected.y, 0,
      projected.x, projected.y, baseRadius * 3
    );
    
    // Color based on centroid
    const r = Math.floor(220 + 35 * this.centroid);
    const g = Math.floor(38 + 60 * (1 - this.centroid));
    const b = Math.floor(38 + 197 * (1 - this.centroid));
    
    glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
    glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.3)`);
    glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, baseRadius * 3, 0, Math.PI * 2);
    ctx.fillStyle = glowGradient;
    ctx.fill();
    
    // Core point
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, baseRadius * projected.scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    
    // Inner highlight
    ctx.beginPath();
    ctx.arc(projected.x - baseRadius * 0.3, projected.y - baseRadius * 0.3, baseRadius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
  }

  startAnimation() {
    const animate = () => {
      this.render();
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  reset() {
    this.trail = [];
    this.currentPoint = { x: 0.5, y: 0.5, z: 0.5 };
    this.rms = 0;
    this.centroid = 0.5;
  }
}


const AudioVisualizer3D = ({ onClose }) => {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const serviceRef = useRef(null);
  
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [error, setError] = useState(null);
  const [showTrail, setShowTrail] = useState(true);
  const [currentRms, setCurrentRms] = useState(0);

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new Canvas3DRenderer(canvasRef.current);
      
      // Handle resize
      const handleResize = () => {
        const container = canvasRef.current.parentElement;
        if (container) {
          rendererRef.current.resize(container.clientWidth, container.clientHeight);
        }
      };
      
      handleResize();
      window.addEventListener('resize', handleResize);
      
      // Start animation
      rendererRef.current.startAnimation();
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (rendererRef.current) {
          rendererRef.current.stopAnimation();
        }
      };
    }
  }, []);

  // Handle frame updates
  const handleFrame = useCallback((frame) => {
    if (rendererRef.current && frame.coords) {
      // Extract x, y, z from coords object
      const coords = {
        x: frame.coords.x || 0.5,
        y: frame.coords.y || 0.5,
        z: frame.coords.z || 0.5
      };
      rendererRef.current.updatePoint(coords, frame.rms || 0, frame.centroid || 0.5);
      setCurrentRms(frame.rms || 0);
      setIsTrained(frame.isTrained || false);
      setTrainingProgress(frame.trainingProgress || 0);
    }
  }, []);

  // Start visualization
  const startVisualization = async () => {
    try {
      setError(null);
      setIsActive(true); // Show loading state
      
      // Create service
      serviceRef.current = new VisualizationService();
      
      // Set callbacks
      serviceRef.current.onFrame(handleFrame);
      serviceRef.current.onStatus((status) => {
        console.log('Status update:', status);
        setIsTrained(status.umap?.is_trained || false);
        setTrainingProgress(status.umap?.progress || 0);
      });
      serviceRef.current.onError((err) => {
        console.error('Service error:', err);
        setError(err.message || 'Unknown error');
      });
      
      // Connect to WebSocket
      console.log('Connecting to WebSocket...');
      await serviceRef.current.connect();
      setIsConnected(true);
      console.log('WebSocket connected!');
      
      // Start audio capture
      console.log('Starting audio capture...');
      const captureStarted = await serviceRef.current.startAudioCapture();
      if (!captureStarted) {
        throw new Error('Failed to start audio capture. Please check microphone permissions.');
      }
      console.log('Audio capture started!');
      
    } catch (err) {
      console.error('Failed to start visualization:', err);
      setError(err.message || 'Failed to start visualization');
      setIsActive(false);
      setIsConnected(false);
      
      // Cleanup on error
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    }
  };

  // Stop visualization
  const stopVisualization = () => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }
    setIsActive(false);
    setIsConnected(false);
  };

  // Reset visualization
  const resetVisualization = () => {
    if (serviceRef.current) {
      serviceRef.current.reset(true);
    }
    if (rendererRef.current) {
      rendererRef.current.reset();
    }
    setIsTrained(false);
    setTrainingProgress(0);
  };

  // Toggle trail visibility
  const toggleTrail = () => {
    setShowTrail(!showTrail);
    if (rendererRef.current) {
      rendererRef.current.maxTrailLength = showTrail ? 0 : 100;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
      }
    };
  }, []);

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 3 },
        background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.3) 100%)',
        border: '1px solid #1e3a5f',
        borderRadius: '3px',
        position: 'relative',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 600,
              fontSize: { xs: '0.85rem', sm: '0.95rem' },
              color: '#e2e8f0',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Audio UMAP Visualizer
          </Typography>
          
          {isActive && (
            <Chip
              size="small"
              icon={<FiberManualRecord sx={{ 
                fontSize: '8px !important', 
                color: isConnected ? '#dc2626 !important' : '#fcd34d !important',
                animation: isConnected ? 'pulse 1s infinite' : 'none'
              }} />}
              label={isConnected ? "LIVE" : "CONNECTING..."}
              sx={{
                height: 20,
                background: isConnected ? 'rgba(220, 38, 38, 0.15)' : 'rgba(252, 211, 77, 0.15)',
                border: isConnected ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid rgba(252, 211, 77, 0.3)',
                color: isConnected ? '#fca5a5' : '#fcd34d',
                fontSize: '0.6rem',
                fontFamily: '"JetBrains Mono", monospace',
              }}
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={showTrail ? 'Hide Trail' : 'Show Trail'}>
            <IconButton size="small" onClick={toggleTrail} sx={{ color: '#64748b' }}>
              {showTrail ? <Visibility sx={{ fontSize: 18 }} /> : <VisibilityOff sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Reset">
            <IconButton size="small" onClick={resetVisualization} sx={{ color: '#64748b' }}>
              <Refresh sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Training Progress */}
      {!isTrained && isActive && (
        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: '#64748b',
              fontFamily: '"JetBrains Mono", monospace',
              mb: 0.5,
            }}
          >
            Training UMAP ({Math.round(trainingProgress * 100)}%) - Make varied sounds...
          </Typography>
          <LinearProgress
            variant="determinate"
            value={trainingProgress * 100}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(30, 58, 95, 0.5)',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #dc2626, #2563eb)',
              },
            }}
          />
        </Box>
      )}

      {/* Canvas Container */}
      <Box
        sx={{
          width: '100%',
          height: { xs: 300, sm: 400, md: 450 },
          position: 'relative',
          borderRadius: '3px',
          overflow: 'hidden',
          border: '1px solid #1e3a5f',
          mb: 2,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
        
        {/* Audio Level Indicator */}
        {isActive && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '4px 8px',
              borderRadius: '2px',
              border: '1px solid #1e3a5f',
            }}
          >
            <FiberManualRecord
              sx={{
                fontSize: 8,
                color: currentRms > 0.1 ? '#dc2626' : '#16a34a',
                animation: currentRms > 0.1 ? 'pulse 0.5s infinite' : 'none',
              }}
            />
            <Typography
              sx={{
                fontSize: '0.6rem',
                color: '#64748b',
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              RMS: {currentRms.toFixed(3)}
            </Typography>
          </Box>
        )}
        
        {/* Status Badge */}
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '4px 8px',
            borderRadius: '2px',
            border: '1px solid #1e3a5f',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.6rem',
              color: isTrained ? '#86efac' : '#fcd34d',
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: '0.1em',
            }}
          >
            {isTrained ? 'UMAP READY' : 'TRAINING'}
          </Typography>
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '2px',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: '#fca5a5',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            Error: {error}
          </Typography>
        </Box>
      )}

      {/* Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        {!isActive ? (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={startVisualization}
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 0 20px rgba(220, 38, 38, 0.4)',
              },
            }}
          >
            Start Visualization
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<Stop />}
            onClick={stopVisualization}
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              },
            }}
          >
            Stop Visualization
          </Button>
        )}
      </Box>

      {/* Instructions */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography
          sx={{
            fontSize: '0.65rem',
            color: '#64748b',
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {!isActive
            ? 'Click Start to begin real-time audio visualization'
            : !isTrained
            ? 'Make varied sounds (speak, whistle, clap) to train the UMAP model'
            : 'Similar sounds cluster together in 3D space'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default AudioVisualizer3D;

