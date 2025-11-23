import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';

const BAR_COUNT = 48;

/**
 * AudioVisualizer renders a simple bar-based visualization that reacts
 * to the current microphone level. The smoothing keeps the animation fluid
 * while still reflecting quick spikes in the signal.
 */
const AudioVisualizer = ({ level = 0, isActive = false, samples = [] }) => {
  const [smoothedLevel, setSmoothedLevel] = useState(0);

  useEffect(() => {
    setSmoothedLevel((prev) => prev + (level - prev) * 0.25);
  }, [level]);

  const barOffsets = useMemo(
    () => Array.from({ length: BAR_COUNT }, () => 0.5 + Math.random()),
    []
  );

  const normalizedSamples = useMemo(() => {
    if (!samples || samples.length === 0) return null;
    const chunkSize = Math.max(1, Math.floor(samples.length / BAR_COUNT));
    return Array.from({ length: BAR_COUNT }, (_, idx) => {
      const start = idx * chunkSize;
      const slice = samples.slice(start, start + chunkSize);
      if (slice.length === 0) return 0;
      const peak = slice.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
      return Math.min(1, peak * 2.2); // align with waveform amplitude
    });
  }, [samples]);

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
          const sampleEnergy = normalizedSamples ? normalizedSamples[index] ?? smoothedLevel : smoothedLevel;
          const syncedEnergy = Math.min(1, sampleEnergy * (1 + bias * 0.2));
          const curved = isActive ? Math.pow(syncedEnergy, 0.8) : syncedEnergy;
          const height = 6 + curved * 94;
          const hueBase = 260 + (index / BAR_COUNT) * 90;
          const gradientActive = `linear-gradient(180deg, hsla(${hueBase}, 90%, ${80 - curved * 15}%, 1) 0%, hsla(${hueBase + 20}, 85%, ${55 - curved * 5}%, 1) 60%, hsla(${hueBase + 35}, 80%, ${45 - curved * 2}%, 1) 100%)`;
          const gradientIdle = `linear-gradient(180deg, hsla(${hueBase}, 45%, 78%, 0.9), hsla(${hueBase + 20}, 40%, 60%, 0.9))`;
          const glowStrength = isActive ? 0.2 + curved * 0.7 : 0.15;

          return (
            <Box
              key={`bar-${index}`}
              sx={{
                flex: 1,
                minWidth: '4px',
                maxWidth: '16px',
                height: `${height}%`,
                borderRadius: '999px',
                transition: 'height 85ms ease-out, opacity 200ms ease, box-shadow 200ms ease',
                background: isActive ? gradientActive : gradientIdle,
                opacity: isActive ? 0.98 : 0.65,
                boxShadow: isActive
                  ? `0 0 ${12 + curved * 20}px hsla(${hueBase + 15}, 85%, 65%, ${glowStrength})`
                  : '0 0 6px rgba(149, 117, 205, 0.25)',
                transform: `translateY(${(1 - curved) * 1.5}px)`,
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default AudioVisualizer;

