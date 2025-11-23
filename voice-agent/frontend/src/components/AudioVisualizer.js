import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';

const BAR_COUNT = 48;

/**
 * AudioVisualizer renders a simple bar-based visualization that reacts
 * to the current microphone level. The smoothing keeps the animation fluid
 * while still reflecting quick spikes in the signal.
 */
const AudioVisualizer = ({ level = 0, isActive = false }) => {
  const [smoothedLevel, setSmoothedLevel] = useState(0);

  useEffect(() => {
    setSmoothedLevel((prev) => prev + (level - prev) * 0.25);
  }, [level]);

  const barOffsets = useMemo(
    () => Array.from({ length: BAR_COUNT }, () => 0.5 + Math.random()),
    []
  );

  return (
    <Box
      sx={{
        mt: 3,
        p: 2,
        borderRadius: 3,
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(14px)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: isActive ? '#4caf50' : 'text.secondary',
          fontSize: '0.75rem',
        }}
      >
        Live audio levels
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          height: 90,
          mt: 1,
          gap: 0.25,
        }}
      >
        {barOffsets.map((bias, index) => {
          const energy = Math.min(1, Math.max(0, smoothedLevel * (0.6 + bias)));
          const height = 10 + energy * 90;

          return (
            <Box
              key={`bar-${index}`}
              sx={{
                flex: 1,
                minWidth: '4px',
                maxWidth: '16px',
                height: `${height}%`,
                borderRadius: '999px',
                transition: 'height 120ms ease, opacity 200ms ease',
                background: isActive
                  ? 'linear-gradient(180deg, #f3e5f5 0%, #ce93d8 40%, #7b1fa2 100%)'
                  : 'linear-gradient(180deg, #d1c4e9 0%, #9575cd 100%)',
                opacity: isActive ? 0.95 : 0.6,
                filter: isActive
                  ? 'drop-shadow(0 0 8px rgba(123, 31, 162, 0.5))'
                  : 'none',
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default AudioVisualizer;

