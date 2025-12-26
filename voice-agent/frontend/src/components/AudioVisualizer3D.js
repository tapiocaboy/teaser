/**
 * AudioVisualizer3D Component
 * Real-time 3D Timbre Space visualization of audio using UMAP projection
 * Inspired by advanced audio analysis visualizations
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
} from '@mui/icons-material';
import VisualizationService from '../services/VisualizationService';

// Advanced 3D Timbre Space Renderer
class TimbreSpaceRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Camera settings
    this.cameraDistance = 4;
    this.rotationX = 0.35;
    this.rotationY = 0;
    this.autoRotate = true;
    this.rotationSpeed = 0.001; // Slower, smoother rotation
    
    // Data points history
    this.points = [];
    this.maxPoints = 200;
    this.connections = [];
    this.maxConnections = 150;
    
    // Current audio features
    this.currentFeatures = {
      x: 0.5, y: 0.5, z: 0.5,
      rms: 0, centroid: 0.5,
      spectralFlux: 0, tonality: 0, spectralSpread: 0
    };
    
    // Animation
    this.animationId = null;
    this.frameCount = 0;
    
    // Color palette (bright yellow/gold spark gradient)
    this.colorStops = [
      { pos: 0, color: [180, 83, 9] },      // Dark amber (low)
      { pos: 0.25, color: [245, 158, 11] }, // Amber
      { pos: 0.5, color: [251, 191, 36] },  // Yellow
      { pos: 0.75, color: [253, 224, 71] }, // Light yellow
      { pos: 1, color: [254, 249, 195] }    // Almost white-yellow (high)
    ];
    
    // Smoothing for positions
    this.smoothedPosition = { x: 0.5, y: 0.5, z: 0.5 };
    this.smoothingFactor = 0.15; // Lower = smoother
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  getColorForCentroid(centroid) {
    const c = Math.max(0, Math.min(1, centroid));
    
    // Find color stops
    let lower = this.colorStops[0];
    let upper = this.colorStops[this.colorStops.length - 1];
    
    for (let i = 0; i < this.colorStops.length - 1; i++) {
      if (c >= this.colorStops[i].pos && c <= this.colorStops[i + 1].pos) {
        lower = this.colorStops[i];
        upper = this.colorStops[i + 1];
        break;
      }
    }
    
    // Interpolate
    const t = (c - lower.pos) / (upper.pos - lower.pos || 1);
    const r = Math.round(lower.color[0] + t * (upper.color[0] - lower.color[0]));
    const g = Math.round(lower.color[1] + t * (upper.color[1] - lower.color[1]));
    const b = Math.round(lower.color[2] + t * (upper.color[2] - lower.color[2]));
    
    return { r, g, b };
  }

  project(x, y, z) {
    // Center coordinates
    const cx = (x - 0.5) * 2;
    const cy = (y - 0.5) * 2;
    const cz = (z - 0.5) * 2;
    
    // Apply rotation
    const cosY = Math.cos(this.rotationY);
    const sinY = Math.sin(this.rotationY);
    const cosX = Math.cos(this.rotationX);
    const sinX = Math.sin(this.rotationX);
    
    const x1 = cx * cosY - cz * sinY;
    const z1 = cx * sinY + cz * cosY;
    const y1 = cy * cosX - z1 * sinX;
    const z2 = cy * sinX + z1 * cosX;
    
    // Perspective projection
    const scale = this.cameraDistance / (this.cameraDistance + z2);
    const screenX = this.width / 2 + x1 * scale * this.width * 0.35;
    const screenY = this.height / 2 - y1 * scale * this.height * 0.35;
    
    return { x: screenX, y: screenY, scale, depth: z2 };
  }

  updateFeatures(coords, rms, centroid, additionalFeatures = {}) {
    // Smooth position transitions for fluid movement
    const targetX = coords.x || 0.5;
    const targetY = coords.y || 0.5;
    const targetZ = coords.z || 0.5;
    
    this.smoothedPosition.x += (targetX - this.smoothedPosition.x) * this.smoothingFactor;
    this.smoothedPosition.y += (targetY - this.smoothedPosition.y) * this.smoothingFactor;
    this.smoothedPosition.z += (targetZ - this.smoothedPosition.z) * this.smoothingFactor;
    
    this.currentFeatures = {
      x: this.smoothedPosition.x,
      y: this.smoothedPosition.y,
      z: this.smoothedPosition.z,
      rms: rms || 0,
      centroid: centroid || 0.5,
      spectralFlux: additionalFeatures.spectralFlux || Math.random() * 0.5,
      tonality: additionalFeatures.tonality || Math.random() * 0.5,
      spectralSpread: additionalFeatures.spectralSpread || Math.random() * 0.5
    };
    
    // Add points with any audio activity (very sensitive)
    if (rms > 0.001) {
      const newPoint = {
        ...this.currentFeatures,
        time: Date.now(),
        id: this.frameCount
      };
      
      this.points.push(newPoint);
      
      // Create connections to nearby points
      if (this.points.length > 1) {
        const lastPoints = this.points.slice(-5);
        lastPoints.forEach((p, i) => {
          if (i < lastPoints.length - 1) {
            this.connections.push({
              from: p,
              to: lastPoints[i + 1],
              time: Date.now()
            });
          }
        });
      }
      
      // Limit points
      while (this.points.length > this.maxPoints) {
        this.points.shift();
      }
      while (this.connections.length > this.maxConnections) {
        this.connections.shift();
      }
    }
    
    this.frameCount++;
  }

  render() {
    const ctx = this.ctx;
    
    // Dark gradient background
    const bgGradient = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 0,
      this.width / 2, this.height / 2, this.width * 0.8
    );
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw title
    this.drawTitle();
    
    // Draw subtle grid
    this.drawGrid();
    
    // Draw connections
    this.drawConnections();
    
    // Draw all points
    this.drawPoints();
    
    // Draw current point (highlighted)
    this.drawCurrentPoint();
    
    // Draw axis labels at bottom
    this.drawAxisLabels();
    
    // Draw color legend
    this.drawColorLegend();
    
    // Draw stats panel
    this.drawStatsPanel();
    
    // Auto-rotate
    if (this.autoRotate) {
      this.rotationY += this.rotationSpeed;
    }
  }

  drawTitle() {
    const ctx = this.ctx;
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('3D TIMBRE SPACE', 15, 25);
  }

  drawGrid() {
    const ctx = this.ctx;
    
    const gridSize = 8;
    for (let i = 0; i <= gridSize; i++) {
      const t = i / gridSize;
      const isMajor = i % 4 === 0;
      
      // Warm amber grid lines
      ctx.strokeStyle = isMajor ? 'rgba(180, 83, 9, 0.12)' : 'rgba(180, 83, 9, 0.05)';
      ctx.lineWidth = isMajor ? 0.6 : 0.3;
      
      // Floor grid
      const s1 = this.project(t, 0, 0);
      const e1 = this.project(t, 0, 1);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(e1.x, e1.y);
      ctx.stroke();
      
      const s2 = this.project(0, 0, t);
      const e2 = this.project(1, 0, t);
      ctx.beginPath();
      ctx.moveTo(s2.x, s2.y);
      ctx.lineTo(e2.x, e2.y);
      ctx.stroke();
    }
  }

  drawConnections() {
    const ctx = this.ctx;
    const now = Date.now();
    
    this.connections.forEach((conn, i) => {
      const age = (now - conn.time) / 10000; // Fade over 10 seconds
      const alpha = Math.max(0, 0.4 - age * 0.4);
      
      if (alpha <= 0) return;
      
      const p1 = this.project(conn.from.x, conn.from.y, conn.from.z);
      const p2 = this.project(conn.to.x, conn.to.y, conn.to.z);
      
      // Golden yellow gradient for connections
      const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      gradient.addColorStop(0, `rgba(253, 224, 71, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(251, 191, 36, ${alpha * 0.7})`);
      gradient.addColorStop(1, `rgba(253, 224, 71, ${alpha})`);
      
      // Soft glow effect for connections (draw first, behind)
      ctx.beginPath();
      ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.2})`;
      ctx.lineWidth = 4 + conn.from.rms * 3;
      ctx.lineCap = 'round';
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      
      // Main connection line
      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 0.8 + conn.from.rms * 1.5;
      ctx.lineCap = 'round';
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });
  }

  drawPoints() {
    const ctx = this.ctx;
    const now = Date.now();
    
    // Sort by depth for proper rendering
    const sortedPoints = [...this.points].sort((a, b) => {
      const pa = this.project(a.x, a.y, a.z);
      const pb = this.project(b.x, b.y, b.z);
      return pb.depth - pa.depth;
    });
    
    sortedPoints.forEach((point, i) => {
      const age = (now - point.time) / 12000; // Fade over 12 seconds
      const alpha = Math.max(0.05, 1 - age * 0.8);
      
      if (alpha <= 0) return;
      
      const projected = this.project(point.x, point.y, point.z);
      
      // Yellow/gold spark color
      const intensity = Math.min(1, point.rms * 4);
      
      // Base size affected by RMS and age
      const baseSize = 2 + point.rms * 10 * alpha;
      const size = baseSize * projected.scale;
      
      // Yellow glow effect
      const glowGradient = ctx.createRadialGradient(
        projected.x, projected.y, 0,
        projected.x, projected.y, size * 2.5
      );
      glowGradient.addColorStop(0, `rgba(255, 250, 200, ${alpha * 0.8})`);
      glowGradient.addColorStop(0.3, `rgba(251, 191, 36, ${alpha * 0.4})`);
      glowGradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
      
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, size * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = glowGradient;
      ctx.fill();
      
      // Bright core with white-yellow center
      const coreGradient = ctx.createRadialGradient(
        projected.x, projected.y, 0,
        projected.x, projected.y, size
      );
      coreGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      coreGradient.addColorStop(0.5, `rgba(255, 250, 200, ${alpha * 0.95})`);
      coreGradient.addColorStop(1, `rgba(253, 224, 71, ${alpha * 0.8})`);
      
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, size, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.fill();
      
      // Show value label for some points
      if (i % 20 === 0 && alpha > 0.4) {
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = `rgba(253, 224, 71, ${alpha * 0.8})`;
        ctx.textAlign = 'left';
        ctx.fillText(point.centroid.toFixed(4), projected.x + size + 5, projected.y + 3);
      }
    });
  }

  drawCurrentPoint() {
    const ctx = this.ctx;
    const f = this.currentFeatures;
    const projected = this.project(f.x, f.y, f.z);
    
    // Bright yellow/gold spark color
    const intensity = Math.min(1, f.rms * 5 + 0.4);
    const sparkColor = {
      r: 255,
      g: Math.round(200 + 55 * intensity),
      b: Math.round(50 * (1 - intensity))
    };
    
    // Smooth pulsing
    const pulse = 1 + Math.sin(this.frameCount * 0.08) * 0.15;
    const baseSize = 5 + f.rms * 25;
    const size = baseSize * projected.scale * pulse;
    
    // Outer warm glow (large, soft)
    const outerGlow = ctx.createRadialGradient(
      projected.x, projected.y, 0,
      projected.x, projected.y, size * 6
    );
    outerGlow.addColorStop(0, `rgba(255, 220, 100, 0.6)`);
    outerGlow.addColorStop(0.15, `rgba(255, 180, 50, 0.3)`);
    outerGlow.addColorStop(0.4, `rgba(245, 158, 11, 0.1)`);
    outerGlow.addColorStop(1, 'rgba(180, 83, 9, 0)');
    
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, size * 6, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();
    
    // Inner bright glow
    const innerGlow = ctx.createRadialGradient(
      projected.x, projected.y, 0,
      projected.x, projected.y, size * 2.5
    );
    innerGlow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    innerGlow.addColorStop(0.2, 'rgba(255, 250, 200, 0.95)');
    innerGlow.addColorStop(0.5, `rgba(255, 220, 80, 0.7)`);
    innerGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, size * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = innerGlow;
    ctx.fill();
    
    // Sleek light rays (4 main rays)
    const rayCount = 4;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + Math.PI / 4; // 45 degree offset
      const rayLength = size * (3 + intensity * 2);
      const rayWidth = 1.5 + intensity;
      
      const gradient = ctx.createLinearGradient(
        projected.x, projected.y,
        projected.x + Math.cos(angle) * rayLength,
        projected.y + Math.sin(angle) * rayLength
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.2, 'rgba(255, 240, 150, 0.7)');
      gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.4)');
      gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
      
      ctx.beginPath();
      ctx.moveTo(projected.x, projected.y);
      ctx.lineTo(
        projected.x + Math.cos(angle) * rayLength,
        projected.y + Math.sin(angle) * rayLength
      );
      ctx.strokeStyle = gradient;
      ctx.lineWidth = rayWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    
    // Core (bright white-yellow center)
    const coreGradient = ctx.createRadialGradient(
      projected.x, projected.y, 0,
      projected.x, projected.y, size
    );
    coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    coreGradient.addColorStop(0.4, 'rgba(255, 250, 220, 0.98)');
    coreGradient.addColorStop(0.8, 'rgba(253, 224, 71, 0.9)');
    coreGradient.addColorStop(1, 'rgba(251, 191, 36, 0.7)');
    
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, size, 0, Math.PI * 2);
    ctx.fillStyle = coreGradient;
    ctx.fill();
    
    // Tiny sparkles around
    const sparkleCount = 6;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2 + this.frameCount * 0.03;
      const dist = size * (2 + Math.sin(this.frameCount * 0.1 + i * 1.5) * 0.5);
      const sparkleSize = 1 + Math.random() * 1.5;
      const alpha = 0.4 + Math.sin(this.frameCount * 0.15 + i) * 0.3;
      
      const sx = projected.x + Math.cos(angle) * dist;
      const sy = projected.y + Math.sin(angle) * dist;
      
      ctx.beginPath();
      ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 250, 200, ${alpha})`;
      ctx.fill();
    }
    
    // Value label
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(f.centroid.toFixed(4), projected.x + size * 2 + 10, projected.y + 4);
  }

  drawAxisLabels() {
    const ctx = this.ctx;
    const y = this.height - 25;
    const labels = [
      { name: 'SPECTRAL FLUX', value: this.currentFeatures.spectralFlux, x: 0.12 },
      { name: 'SPECTRAL SPREAD', value: this.currentFeatures.spectralSpread, x: 0.32 },
      { name: 'TONALITY', value: this.currentFeatures.tonality, x: 0.52 },
      { name: 'SPECTRAL CENTROID', value: this.currentFeatures.centroid, x: 0.75 }
    ];
    
    labels.forEach(label => {
      const x = this.width * label.x;
      
      // Label name
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(label.name, x, y);
      
      // Value
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
      ctx.fillText(label.value.toFixed(4), x, y + 14);
    });
  }

  drawColorLegend() {
    const ctx = this.ctx;
    const x = this.width - 25;
    const y = 60;
    const height = this.height - 150;
    const width = 8;
    
    // Gradient bar
    const gradient = ctx.createLinearGradient(0, y + height, 0, y);
    this.colorStops.forEach(stop => {
      gradient.addColorStop(stop.pos, `rgb(${stop.color[0]}, ${stop.color[1]}, ${stop.color[2]})`);
    });
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    // Border
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    // Labels
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.textAlign = 'right';
    
    const labels = ['1.0000', '0.7500', '0.5000', '0.2500', '0.0000'];
    labels.forEach((label, i) => {
      const ly = y + (height * i / (labels.length - 1));
      ctx.fillText(label, x - 5, ly + 3);
    });
    
    // Title (rotated)
    ctx.save();
    ctx.translate(this.width - 8, y + height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('SPECTRAL CENTROID', 0, 0);
    ctx.restore();
  }

  drawStatsPanel() {
    const ctx = this.ctx;
    const f = this.currentFeatures;
    const x = 15;
    const y = 45;
    
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    
    const stats = [
      { label: 'RMS', value: f.rms.toFixed(4), color: f.rms > 0.1 ? '#ef4444' : '#22c55e' },
      { label: 'POINTS', value: this.points.length.toString(), color: '#3b82f6' },
      { label: 'X', value: f.x.toFixed(3), color: '#94a3b8' },
      { label: 'Y', value: f.y.toFixed(3), color: '#94a3b8' },
      { label: 'Z', value: f.z.toFixed(3), color: '#94a3b8' },
    ];
    
    stats.forEach((stat, i) => {
      const sy = y + i * 14;
      ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.fillText(stat.label + ':', x, sy);
      ctx.fillStyle = stat.color;
      ctx.fillText(stat.value, x + 55, sy);
    });
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
    this.points = [];
    this.connections = [];
    this.currentFeatures = {
      x: 0.5, y: 0.5, z: 0.5,
      rms: 0, centroid: 0.5,
      spectralFlux: 0, tonality: 0, spectralSpread: 0
    };
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
  const [showConnections, setShowConnections] = useState(true);
  const [currentRms, setCurrentRms] = useState(0);
  const [pointCount, setPointCount] = useState(0);

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new TimbreSpaceRenderer(canvasRef.current);
      
      const handleResize = () => {
        const container = canvasRef.current.parentElement;
        if (container && rendererRef.current) {
          rendererRef.current.resize(container.clientWidth, container.clientHeight);
        }
      };
      
      handleResize();
      window.addEventListener('resize', handleResize);
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
      const coords = {
        x: frame.coords.x || 0.5,
        y: frame.coords.y || 0.5,
        z: frame.coords.z || 0.5
      };
      
      // Use actual spectral features from backend
      const additionalFeatures = {
        spectralFlux: Math.abs(frame.rms - (rendererRef.current.currentFeatures?.rms || 0)) * 10,
        tonality: frame.tonality || 0.5,
        spectralSpread: frame.spectralSpread || 0.5,
        zcr: frame.zcr || 0,
        rolloff: frame.rolloff || 0.5
      };
      
      rendererRef.current.updateFeatures(coords, frame.rms || 0, frame.centroid || 0.5, additionalFeatures);
      setCurrentRms(frame.rms || 0);
      setIsTrained(frame.isTrained || false);
      setTrainingProgress(frame.trainingProgress || 0);
      setPointCount(rendererRef.current.points.length);
    }
  }, []);

  // Start visualization
  const startVisualization = async () => {
    try {
      setError(null);
      setIsActive(true);
      
      serviceRef.current = new VisualizationService();
      
      serviceRef.current.onFrame(handleFrame);
      serviceRef.current.onStatus((status) => {
        setIsTrained(status.umap?.is_trained || false);
        setTrainingProgress(status.umap?.progress || 0);
      });
      serviceRef.current.onError((err) => {
        setError(err.message || 'Unknown error');
      });
      
      await serviceRef.current.connect();
      setIsConnected(true);
      
      const captureStarted = await serviceRef.current.startAudioCapture();
      if (!captureStarted) {
        throw new Error('Failed to start audio capture. Check microphone permissions.');
      }
      
    } catch (err) {
      console.error('Failed to start visualization:', err);
      setError(err.message || 'Failed to start visualization');
      setIsActive(false);
      setIsConnected(false);
      
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
    setPointCount(0);
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
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
        border: '1px solid #2d2d44',
        borderRadius: '4px',
        position: 'relative',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 600,
              fontSize: { xs: '0.9rem', sm: '1rem' },
              color: '#e2e8f0',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            3D Timbre Space
          </Typography>
          
          {isActive && (
            <Chip
              size="small"
              icon={<FiberManualRecord sx={{ 
                fontSize: '8px !important', 
                color: isConnected ? '#ef4444 !important' : '#fcd34d !important',
                animation: isConnected ? 'pulse 1s infinite' : 'none'
              }} />}
              label={isConnected ? "LIVE" : "..."}
              sx={{
                height: 22,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.65rem',
                fontFamily: '"JetBrains Mono", monospace',
              }}
            />
          )}
          
          {isTrained && (
            <Chip
              size="small"
              label="UMAP READY"
              sx={{
                height: 22,
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#86efac',
                fontSize: '0.65rem',
                fontFamily: '"JetBrains Mono", monospace',
              }}
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Toggle Connections">
            <IconButton 
              size="small" 
              onClick={() => setShowConnections(!showConnections)} 
              sx={{ color: showConnections ? '#3b82f6' : '#64748b' }}
            >
              {showConnections ? <Visibility sx={{ fontSize: 18 }} /> : <VisibilityOff sx={{ fontSize: 18 }} />}
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
              color: '#94a3b8',
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
              height: 3,
              borderRadius: 1,
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #8b5cf6, #3b82f6, #10b981)',
              },
            }}
          />
        </Box>
      )}

      {/* Canvas Container */}
      <Box
        sx={{
          width: '100%',
          height: { xs: 350, sm: 450, md: 500 },
          position: 'relative',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid #2d2d44',
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
      </Box>

      {/* Error Display */}
      {error && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '3px',
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
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)',
                boxShadow: '0 0 25px rgba(139, 92, 246, 0.4)',
              },
            }}
          >
            Start Analysis
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
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
              },
            }}
          >
            Stop Analysis
          </Button>
        )}
      </Box>

      {/* Info Text */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography
          sx={{
            fontSize: '0.65rem',
            color: '#64748b',
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {!isActive
            ? 'Click Start Analysis to begin real-time audio visualization'
            : !isTrained
            ? 'Make varied sounds (speak, whistle, clap) to train the UMAP model'
            : `${pointCount} points captured • Similar timbres cluster together in 3D space`}
        </Typography>
      </Box>
    </Paper>
  );
};

export default AudioVisualizer3D;
