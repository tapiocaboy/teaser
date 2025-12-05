import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Divider,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Paper,
  Chip,
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import CheckIcon from '@mui/icons-material/Check';
import { useTheme, THEME_CATEGORIES, THEMES } from '../contexts/ThemeContext';

// Theme preview colors for visual indication
const THEME_PREVIEWS = {
  light: { bg: '#fafafa', primary: '#3730a3', accent: '#e0e7ff' },
  dark: { bg: '#1f2937', primary: '#818cf8', accent: '#374151' },
  'ai-cyber': { bg: '#0a1628', primary: '#22d3ee', accent: '#ec4899' },
  'ai-neon': { bg: '#1a0a2e', primary: '#a855f7', accent: '#84cc16' },
  'ai-matrix': { bg: '#030a05', primary: '#22c55e', accent: '#166534' },
  'ai-gradient': { bg: '#2e1065', primary: '#f472b6', accent: '#8b5cf6' },
  darkrise: { bg: '#0f172a', primary: '#3b82f6', accent: '#1e3a8a' },
  'darkrise-purple': { bg: '#1e1b4b', primary: '#a78bfa', accent: '#7c3aed' },
  'darkrise-ocean': { bg: '#0c4a6e', primary: '#06b6d4', accent: '#0891b2' },
  'enterprise-elite': { bg: '#0f172a', primary: '#60a5fa', accent: '#8b5cf6' },
  'enterprise-slate': { bg: '#0f172a', primary: '#06b6d4', accent: '#334155' },
  'quantum-pro': { bg: '#030712', primary: '#22d3ee', accent: '#0ea5e9' },
  'retro-90s': { bg: '#c0c0c0', primary: '#0000ee', accent: '#ffff00' },
};

function ThemePreviewDot({ themeId, size = 24 }) {
  const preview = THEME_PREVIEWS[themeId] || THEME_PREVIEWS.dark;
  
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: themeId === 'retro-90s' ? 0 : '50%',
        background: `linear-gradient(135deg, ${preview.bg} 0%, ${preview.bg} 50%, ${preview.primary} 50%, ${preview.primary} 100%)`,
        border: `2px solid ${preview.accent}`,
        boxShadow: `0 0 8px ${preview.primary}40`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'scale(1.1)',
          boxShadow: `0 0 12px ${preview.primary}60`,
        },
      }}
    />
  );
}

function ThemeSelector() {
  const { theme, setTheme, currentTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleThemeSelect = (themeId) => {
    setTheme(themeId);
    handleClose();
  };

  return (
    <>
      <Tooltip title={`Theme: ${currentTheme?.name || 'Unknown'}`} arrow>
        <IconButton
          onClick={handleClick}
          sx={{
            color: 'var(--foreground)',
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: theme === 'retro-90s' ? 0 : 2,
            padding: 1.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: 'var(--accent)',
              transform: 'scale(1.05)',
              boxShadow: '0 0 20px var(--primary)',
            },
          }}
        >
          <PaletteIcon />
        </IconButton>
      </Tooltip>
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            backgroundColor: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            borderRadius: theme === 'retro-90s' ? 0 : 2,
            minWidth: 280,
            maxHeight: 480,
            overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
            '& .MuiMenuItem-root': {
              borderRadius: theme === 'retro-90s' ? 0 : 1,
              margin: '2px 8px',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'var(--accent)',
              },
              '&.Mui-selected': {
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                '&:hover': {
                  backgroundColor: 'var(--primary)',
                },
              },
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaletteIcon sx={{ fontSize: 20, color: 'var(--primary)' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--foreground)' }}>
            Select Theme
          </Typography>
        </Box>
        
        <Divider sx={{ borderColor: 'var(--border)', mx: 1 }} />
        
        {Object.entries(THEME_CATEGORIES).map(([category, themeIds]) => (
          <Box key={category}>
            <Typography
              variant="caption"
              sx={{
                px: 2,
                py: 1,
                display: 'block',
                color: 'var(--muted-foreground)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '0.65rem',
              }}
            >
              {category}
            </Typography>
            
            {themeIds.map((themeId) => {
              const themeInfo = THEMES[themeId];
              const isSelected = theme === themeId;
              
              return (
                <MenuItem
                  key={themeId}
                  onClick={() => handleThemeSelect(themeId)}
                  selected={isSelected}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 1.25,
                  }}
                >
                  <ThemePreviewDot themeId={themeId} size={28} />
                  
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'inherit' : 'var(--foreground)',
                        }}
                      >
                        {themeInfo.icon} {themeInfo.name}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isSelected ? 'inherit' : 'var(--muted-foreground)',
                        opacity: isSelected ? 0.9 : 0.7,
                        display: 'block',
                        lineHeight: 1.3,
                      }}
                    >
                      {themeInfo.description}
                    </Typography>
                  </Box>
                  
                  {isSelected && (
                    <CheckIcon
                      sx={{
                        fontSize: 18,
                        color: 'inherit',
                      }}
                    />
                  )}
                </MenuItem>
              );
            })}
          </Box>
        ))}
        
        <Divider sx={{ borderColor: 'var(--border)', mx: 1, my: 1 }} />
        
        <Box sx={{ px: 2, py: 1, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'var(--muted-foreground)', fontSize: '0.65rem' }}>
            Current: {currentTheme?.icon} {currentTheme?.name}
          </Typography>
        </Box>
      </Menu>
    </>
  );
}

export default ThemeSelector;

