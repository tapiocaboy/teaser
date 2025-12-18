import React, { useState, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Box, Button } from '@mui/material';
import VoiceInterface from './components/VoiceInterface';
import ParticleBackground from './components/ParticleBackground';
import RoleSelector from './components/RoleSelector';
import WorkerInterface from './components/WorkerInterface';
import ManagerDashboard from './components/ManagerDashboard';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import './themes.css';
import './App.css';

// Theme color configurations for MUI palette (MUI doesn't support CSS variables in palette)
const THEME_COLORS = {
  light: {
    primary: '#3730a3',
    secondary: '#6366f1',
    background: '#fafafa',
    paper: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
  },
  dark: {
    primary: '#818cf8',
    secondary: '#a78bfa',
    background: '#111827',
    paper: '#1f2937',
    text: '#f3f4f6',
    textSecondary: '#9ca3af',
  },
  'ai-cyber': {
    primary: '#22d3ee',
    secondary: '#ec4899',
    background: '#0a1628',
    paper: '#0f2340',
    text: '#e0f2fe',
    textSecondary: '#7dd3fc',
  },
  'ai-neon': {
    primary: '#a855f7',
    secondary: '#84cc16',
    background: '#1a0a2e',
    paper: '#2d1b4e',
    text: '#fef3c7',
    textSecondary: '#d8b4fe',
  },
  'ai-matrix': {
    primary: '#22c55e',
    secondary: '#16a34a',
    background: '#030a05',
    paper: '#0a1f10',
    text: '#86efac',
    textSecondary: '#4ade80',
  },
  'ai-gradient': {
    primary: '#f472b6',
    secondary: '#8b5cf6',
    background: '#2e1065',
    paper: '#3b0f7a',
    text: '#fce7f3',
    textSecondary: '#f9a8d4',
  },
  darkrise: {
    primary: '#3b82f6',
    secondary: '#60a5fa',
    background: '#0f172a',
    paper: '#1e293b',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
  },
  'darkrise-purple': {
    primary: '#a78bfa',
    secondary: '#7c3aed',
    background: '#1e1b4b',
    paper: '#312e81',
    text: '#f5f3ff',
    textSecondary: '#c4b5fd',
  },
  'darkrise-ocean': {
    primary: '#06b6d4',
    secondary: '#0891b2',
    background: '#0c4a6e',
    paper: '#155e75',
    text: '#ecfeff',
    textSecondary: '#67e8f9',
  },
  'enterprise-elite': {
    primary: '#60a5fa',
    secondary: '#8b5cf6',
    background: '#0f172a',
    paper: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
  },
  'enterprise-slate': {
    primary: '#06b6d4',
    secondary: '#3b82f6',
    background: '#0f172a',
    paper: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
  },
  'quantum-pro': {
    primary: '#22d3ee',
    secondary: '#0ea5e9',
    background: '#030712',
    paper: '#111827',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
  },
  'retro-90s': {
    primary: '#0000EE',
    secondary: '#551A8B',
    background: '#C0C0C0',
    paper: '#D4D0C8',
    text: '#000000',
    textSecondary: '#404040',
  },
  // Construction-focused theme
  'construction': {
    primary: '#f59e0b',
    secondary: '#ea580c',
    background: '#1c1917',
    paper: '#292524',
    text: '#fafaf9',
    textSecondary: '#a8a29e',
  },
};

// MUI theme that uses actual color values (not CSS variables)
function createAdaptiveTheme(themeId) {
  const isDark = themeId !== 'light' && themeId !== 'retro-90s';
  const colors = THEME_COLORS[themeId] || THEME_COLORS.dark;
  
  return createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: colors.primary,
      },
      secondary: {
        main: colors.secondary,
      },
      background: {
        default: colors.background,
        paper: colors.paper,
      },
      text: {
        primary: colors.text,
        secondary: colors.textSecondary,
      },
    },
    typography: {
      fontFamily: themeId === 'retro-90s' 
        ? '"Courier New", Courier, monospace'
        : '"Space Grotesk", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { 
        fontWeight: 700, 
        letterSpacing: themeId === 'retro-90s' ? '0' : '1px' 
      },
      button: { 
        letterSpacing: themeId === 'retro-90s' ? '0.5px' : '1px' 
      },
    },
    shape: {
      borderRadius: themeId === 'retro-90s' ? 0 : 16,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: 'transparent',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: 'var(--card)',
            color: 'var(--card-foreground)',
            backdropFilter: themeId === 'retro-90s' ? 'none' : 'blur(20px)',
            border: '1px solid var(--border)',
            transition: 'all 0.3s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: themeId === 'retro-90s' ? 0 : 999,
            textTransform: themeId === 'retro-90s' ? 'uppercase' : 'none',
            fontWeight: 600,
            letterSpacing: themeId === 'retro-90s' ? '0.5px' : '1px',
            transition: 'all 0.3s ease',
          },
          contained: {
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            '&:hover': {
              backgroundColor: 'var(--primary)',
              filter: 'brightness(1.1)',
            },
          },
          outlined: {
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
            '&:hover': {
              borderColor: 'var(--primary)',
              backgroundColor: 'var(--accent)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: 'var(--card)',
            color: 'var(--card-foreground)',
            backdropFilter: themeId === 'retro-90s' ? 'none' : 'blur(20px)',
            border: '1px solid var(--border)',
            boxShadow: themeId === 'retro-90s' 
              ? 'inset 1px 1px 0 #DFDFDF, inset -1px -1px 0 #404040'
              : '0 8px 32px rgba(0, 0, 0, 0.2)',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: themeId === 'retro-90s' ? 0 : 999,
            backgroundColor: 'var(--muted)',
            border: '1px solid var(--border)',
          },
          bar: {
            borderRadius: themeId === 'retro-90s' ? 0 : 999,
            backgroundColor: 'var(--primary)',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: 'var(--foreground)',
            '&:hover': {
              backgroundColor: 'var(--accent)',
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: 'var(--popover)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
            borderRadius: themeId === 'retro-90s' ? 0 : 8,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: 'var(--popover)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: 'var(--accent)',
            },
            '&.Mui-selected': {
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
            },
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            color: 'inherit',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'var(--border)',
              },
              '&:hover fieldset': {
                borderColor: 'var(--primary)',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'var(--muted-foreground)',
            },
            '& .MuiInputBase-input': {
              color: 'var(--foreground)',
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--border)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--primary)',
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            color: 'var(--muted-foreground)',
            '&.Mui-selected': {
              color: 'var(--primary)',
            },
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: 'var(--muted-foreground)',
            '&.Mui-checked': {
              color: 'var(--primary)',
            },
          },
        },
      },
    },
  });
}

// Determine if particles should be shown based on theme
function shouldShowParticles(themeId) {
  return !['retro-90s', 'enterprise-slate', 'light'].includes(themeId);
}

// Get particle theme name for compatibility with existing ParticleBackground
function getParticleThemeName(themeId) {
  const particleThemeMap = {
    'ai-cyber': 'synthwave',
    'ai-neon': 'neon',
    'ai-matrix': 'dsp',
    'ai-gradient': 'synthwave',
    'darkrise': 'neon',
    'darkrise-purple': 'synthwave',
    'darkrise-ocean': 'neon',
    'enterprise-elite': 'neon',
    'quantum-pro': 'neon',
    'dark': 'neon',
    'construction': 'neon',
  };
  return particleThemeMap[themeId] || 'neon';
}

// App modes
const APP_MODES = {
  ROLE_SELECT: 'role_select',
  WORKER: 'worker',
  MANAGER: 'manager',
  LEGACY_ECHO: 'legacy_echo',
};

function AppContent() {
  const { theme } = useTheme();
  const [appMode, setAppMode] = useState(APP_MODES.ROLE_SELECT);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  
  const muiTheme = useMemo(
    () => createAdaptiveTheme(theme),
    [theme]
  );

  const showParticles = shouldShowParticles(theme);
  const particleTheme = getParticleThemeName(theme);

  const handleRoleSelect = (role) => {
    setUserRole(role);
    setAppMode(role === 'worker' ? APP_MODES.WORKER : APP_MODES.MANAGER);
  };

  const handleUserLogin = (role, user) => {
    setUserRole(role);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setAppMode(APP_MODES.ROLE_SELECT);
    setCurrentUser(null);
    setUserRole(null);
  };

  const handleSwitchToLegacy = () => {
    setAppMode(APP_MODES.LEGACY_ECHO);
  };

  const renderContent = () => {
    switch (appMode) {
      case APP_MODES.ROLE_SELECT:
        return (
          <Box>
            <RoleSelector
              onRoleSelect={handleRoleSelect}
              onUserLogin={handleUserLogin}
            />
            {/* Option to use legacy Echo */}
            <Box sx={{ textAlign: 'center', mt: 4, pb: 4 }}>
              <Button
                variant="text"
                onClick={handleSwitchToLegacy}
                sx={{ color: 'var(--muted-foreground)' }}
              >
                Use Classic Echo Voice Assistant →
              </Button>
            </Box>
          </Box>
        );

      case APP_MODES.WORKER:
        return <WorkerInterface user={currentUser} onLogout={handleLogout} />;

      case APP_MODES.MANAGER:
        return <ManagerDashboard user={currentUser} onLogout={handleLogout} />;

      case APP_MODES.LEGACY_ECHO:
        return (
          <Box>
            <Box sx={{ textAlign: 'right', mb: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setAppMode(APP_MODES.ROLE_SELECT)}
                sx={{
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                ← Back to SiteVoice
              </Button>
            </Box>
            <VoiceInterface />
          </Box>
        );

      default:
        return <RoleSelector onRoleSelect={handleRoleSelect} onUserLogin={handleUserLogin} />;
    }
  };

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {showParticles && <ParticleBackground themeName={particleTheme} />}
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            py: 4,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {renderContent()}
        </Box>
      </Container>
    </MuiThemeProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
