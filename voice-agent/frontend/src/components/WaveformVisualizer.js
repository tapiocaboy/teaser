import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

const formatFrequency = (value = 0) => {
  if (!value || Number.isNaN(value)) return '0 Hz';
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} kHz`;
  }
  return `${value.toFixed(0)} Hz`;
};

const formatWavelength = (value = 0) => {
  if (!value || Number.isNaN(value)) return '∞ m';
  if (value >= 1) {
    return `${value.toFixed(2)} m`;
  }
  return `${(value * 100).toFixed(1)} cm`;
};

const StatBadge = ({ label, value }) => (
  <Box
    sx={{
      p: 2,
      borderRadius: 3,
      background: 'rgba(12, 12, 24, 0.75)',
      border: '1px solid rgba(124, 252, 0, 0.35)',
      boxShadow: '0 10px 30px rgba(10, 255, 160, 0.12)',
    }}
  >
    <Typography
      variant="caption"
      sx={{
        color: 'rgba(173, 216, 230, 0.7)',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </Typography>
    <Typography
      variant="h6"
      sx={{
        mt: 0.5,
        color: '#7CFC00',
        fontWeight: 700,
        textShadow: '0 0 10px rgba(124, 252, 0, 0.5)',
      }}
    >
      {value}
    </Typography>
  </Box>
);

const WaveformVisualizer = ({
  wavePoints = [],
  amplitude = 0,
  frequency = 0,
  wavelength = 0,
  isActive = false,
}) => {
  const pathData = useMemo(() => {
    if (!wavePoints.length) return 'M0 50 L100 50';
    return wavePoints
      .map((point, index) => {
        const x = (index / (wavePoints.length - 1)) * 100;
        const y = 50 - point * 40;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [wavePoints]);

  return (
    <Box
      sx={{
        position: 'relative',
        mt: 4,
        p: 3,
        borderRadius: 4,
        background: 'linear-gradient(145deg, rgba(4,2,14,0.95) 0%, rgba(13,32,61,0.95) 100%)',
        border: '1px solid rgba(124, 252, 0, 0.25)',
        boxShadow: '0 20px 45px rgba(7, 20, 45, 0.85)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 20% 20%, rgba(124,252,0,0.15), transparent 50%)',
          opacity: isActive ? 1 : 0.5,
          pointerEvents: 'none',
        }}
      />
      <Typography
        variant="subtitle2"
        sx={{
          textTransform: 'uppercase',
          letterSpacing: 6,
          color: '#7CFC00',
          fontSize: '0.75rem',
          mb: 2,
        }}
      >
        Quantum Wave Monitor
      </Typography>

      <Box sx={{ position: 'relative' }}>
        <svg
          width="100%"
          height="160"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <defs>
            <pattern
              id="gridPattern"
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 4 0 L 0 0 0 4"
                stroke="rgba(30, 136, 229, 0.15)"
                strokeWidth="0.3"
                fill="none"
              />
            </pattern>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8e24aa" />
              <stop offset="50%" stopColor="#1e88e5" />
              <stop offset="100%" stopColor="#7CFC00" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            fill="url(#gridPattern)"
            opacity="0.25"
          />
          <path
            d={pathData}
            stroke="url(#waveGradient)"
            strokeWidth="1.5"
            fill="none"
            filter="url(#glow)"
          />
          <path
            d={`${pathData} L 100 100 L 0 100 Z`}
            fill="url(#waveGradient)"
            opacity="0.15"
          />
        </svg>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 2,
          mt: 3,
        }}
      >
        <StatBadge label="Amplitude" value={`${(amplitude * 100).toFixed(1)}%`} />
        <StatBadge label="Frequency" value={formatFrequency(frequency)} />
        <StatBadge label="Wavelength" value={formatWavelength(wavelength)} />
      </Box>
    </Box>
  );
};

export default WaveformVisualizer;

