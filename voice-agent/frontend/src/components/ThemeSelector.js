import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { Palette } from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';

/**
 * ThemeSelector - Displays the current theme info
 * Simplified for single professional theme
 */
function ThemeSelector() {
  const { theme } = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Chip
        icon={<Palette sx={{ fontSize: 16 }} />}
        label={theme?.name || 'Akordi Echo'}
        size="small"
        sx={{
          backgroundColor: 'var(--accent)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          '& .MuiChip-icon': {
            color: 'var(--primary)',
          },
        }}
      />
    </Box>
  );
}

export default ThemeSelector;
