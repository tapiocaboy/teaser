import React, { useState, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Box, Button } from '@mui/material';
import VoiceInterface from './components/VoiceInterface';
import RoleSelector from './components/RoleSelector';
import WorkerInterface from './components/WorkerInterface';
import ManagerDashboard from './components/ManagerDashboard';
import { ThemeProvider } from './contexts/ThemeContext';
import './themes.css';
import './App.css';

// Enterprise Professional Theme for MUI
function createProfessionalTheme() {
  return createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#3b82f6',
        light: '#60a5fa',
        dark: '#2563eb',
      },
      secondary: {
        main: '#8b5cf6',
        light: '#a78bfa',
        dark: '#7c3aed',
      },
      background: {
        default: '#0a0d12',
        paper: '#0d1117',
      },
      text: {
        primary: '#c9d1d9',
        secondary: '#484f58',
      },
      error: {
        main: '#f85149',
      },
      success: {
        main: '#3fb950',
      },
      warning: {
        main: '#d29922',
      },
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
      fontSize: 13,
      h4: { 
        fontWeight: 500, 
        fontSize: '1.25rem',
        letterSpacing: '-0.01em',
      },
      h5: {
        fontWeight: 500,
        fontSize: '1.1rem',
      },
      h6: {
        fontWeight: 500,
        fontSize: '0.95rem',
      },
      body1: {
        fontSize: '0.875rem',
      },
      body2: {
        fontSize: '0.8rem',
      },
      button: { 
        fontSize: '0.8125rem',
        letterSpacing: '0.01em',
        fontWeight: 500,
        textTransform: 'none',
      },
      caption: {
        fontSize: '0.7rem',
      },
    },
    shape: {
      borderRadius: 2,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: '#0a0d12',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: '#0d1117',
            color: '#c9d1d9',
            border: '1px solid #21262d',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 500,
            boxShadow: 'none',
          },
          contained: {
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#2563eb',
              boxShadow: 'none',
            },
          },
          outlined: {
            borderColor: '#21262d',
            color: '#c9d1d9',
            '&:hover': {
              borderColor: '#484f58',
              backgroundColor: 'transparent',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: '#0d1117',
            color: '#c9d1d9',
            border: '1px solid #21262d',
            boxShadow: 'none',
            '&:hover': {
              borderColor: '#30363d',
            },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 2,
            backgroundColor: '#21262d',
            height: 4,
          },
          bar: {
            borderRadius: 2,
            backgroundColor: '#3b82f6',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: '#484f58',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#c9d1d9',
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: '#161b22',
            color: '#c9d1d9',
            border: '1px solid #21262d',
            borderRadius: 2,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: '#161b22',
            color: '#c9d1d9',
            border: '1px solid #21262d',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
            '&.Mui-selected': {
              backgroundColor: '#21262d',
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
              backgroundColor: '#0d1117',
              borderRadius: 2,
              '& fieldset': {
                borderColor: '#21262d',
              },
              '&:hover fieldset': {
                borderColor: '#484f58',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#3b82f6',
                borderWidth: 1,
              },
            },
            '& .MuiInputLabel-root': {
              color: '#484f58',
            },
            '& .MuiInputBase-input': {
              color: '#c9d1d9',
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            backgroundColor: '#0d1117',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#21262d',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#484f58',
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
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: 'var(--accent)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          standardSuccess: {
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
          },
          standardError: {
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
          },
          standardWarning: {
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
          },
          standardInfo: {
            backgroundColor: 'rgba(78, 205, 196, 0.15)',
            color: '#4ecdc4',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: 'var(--border)',
          },
        },
      },
    },
  });
}

// App modes
const APP_MODES = {
  ROLE_SELECT: 'role_select',
  WORKER: 'worker',
  MANAGER: 'manager',
  LEGACY_ECHO: 'legacy_echo',
};

function AppContent() {
  const [appMode, setAppMode] = useState(APP_MODES.ROLE_SELECT);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  
  const muiTheme = useMemo(() => createProfessionalTheme(), []);

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
                sx={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}
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
                ← Back
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
      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            py: { xs: 2, sm: 3, md: 4 },
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
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
