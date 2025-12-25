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

// SpyCho Security Operations Theme for MUI
function createSecurityTheme() {
  return createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#dc2626',
        light: '#f87171',
        dark: '#991b1b',
      },
      secondary: {
        main: '#2563eb',
        light: '#3b82f6',
        dark: '#1e40af',
      },
      background: {
        default: '#0a0f1a',
        paper: '#0f172a',
      },
      text: {
        primary: '#e2e8f0',
        secondary: '#64748b',
      },
      error: {
        main: '#dc2626',
      },
      success: {
        main: '#16a34a',
      },
      warning: {
        main: '#d97706',
      },
    },
    typography: {
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
      fontSize: 13,
      h4: { 
        fontWeight: 600, 
        fontSize: '1.25rem',
        letterSpacing: '0.05em',
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.1rem',
        letterSpacing: '0.03em',
      },
      h6: {
        fontWeight: 600,
        fontSize: '0.95rem',
        letterSpacing: '0.02em',
      },
      body1: {
        fontSize: '0.875rem',
      },
      body2: {
        fontSize: '0.8rem',
      },
      button: { 
        fontSize: '0.8rem',
        letterSpacing: '0.05em',
        fontWeight: 600,
        textTransform: 'uppercase',
      },
      caption: {
        fontSize: '0.7rem',
        letterSpacing: '0.03em',
      },
    },
    shape: {
      borderRadius: 3,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: '#0a0f1a',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid #1e3a5f',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 3,
            textTransform: 'uppercase',
            fontWeight: 600,
            boxShadow: 'none',
            letterSpacing: '0.05em',
          },
          contained: {
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            color: '#ffffff',
            '&:hover': {
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              boxShadow: '0 0 20px rgba(220, 38, 38, 0.3)',
            },
          },
          outlined: {
            borderColor: '#1e3a5f',
            color: '#e2e8f0',
            '&:hover': {
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid #1e3a5f',
            boxShadow: 'none',
            '&:hover': {
              borderColor: '#2563eb',
            },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 3,
            backgroundColor: '#1e3a5f',
            height: 4,
          },
          bar: {
            borderRadius: 3,
            background: 'linear-gradient(90deg, #dc2626, #2563eb)',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: '#64748b',
            '&:hover': {
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              color: '#dc2626',
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #1e3a5f',
            borderRadius: 3,
            fontFamily: '"JetBrains Mono", monospace',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #1e3a5f',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: '"JetBrains Mono", monospace',
            '&:hover': {
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
            },
            '&.Mui-selected': {
              backgroundColor: '#1e3a5f',
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
              backgroundColor: '#0f172a',
              borderRadius: 3,
              fontFamily: '"JetBrains Mono", monospace',
              '& fieldset': {
                borderColor: '#1e3a5f',
              },
              '&:hover fieldset': {
                borderColor: '#2563eb',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#dc2626',
                borderWidth: 1,
              },
            },
            '& .MuiInputLabel-root': {
              color: '#64748b',
              fontFamily: '"JetBrains Mono", monospace',
            },
            '& .MuiInputBase-input': {
              color: '#e2e8f0',
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            backgroundColor: '#0f172a',
            fontFamily: '"JetBrains Mono", monospace',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#1e3a5f',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#2563eb',
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            color: '#64748b',
            fontFamily: '"JetBrains Mono", monospace',
            '&.Mui-selected': {
              color: '#e2e8f0',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: '#1e3a5f',
            color: '#e2e8f0',
            border: '1px solid #2563eb',
            fontFamily: '"JetBrains Mono", monospace',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          standardSuccess: {
            backgroundColor: 'rgba(22, 163, 74, 0.12)',
            color: '#86efac',
            border: '1px solid rgba(22, 163, 74, 0.25)',
          },
          standardError: {
            backgroundColor: 'rgba(220, 38, 38, 0.12)',
            color: '#fca5a5',
            border: '1px solid rgba(220, 38, 38, 0.25)',
          },
          standardWarning: {
            backgroundColor: 'rgba(217, 119, 6, 0.12)',
            color: '#fcd34d',
            border: '1px solid rgba(217, 119, 6, 0.25)',
          },
          standardInfo: {
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            color: '#93c5fd',
            border: '1px solid rgba(37, 99, 235, 0.25)',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: '#1e3a5f',
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
  
  const muiTheme = useMemo(() => createSecurityTheme(), []);

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
            {/* Option to use legacy mode */}
            <Box sx={{ textAlign: 'center', mt: 4, pb: 4 }}>
              <Button
                variant="text"
                onClick={handleSwitchToLegacy}
                sx={{ 
                  color: '#64748b', 
                  fontSize: '0.75rem',
                  fontFamily: '"JetBrains Mono", monospace',
                  letterSpacing: '0.05em',
                  '&:hover': {
                    color: '#94a3b8',
                    background: 'transparent',
                  },
                }}
              >
                Access Legacy Voice Terminal →
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
                  borderColor: '#1e3a5f',
                  color: '#e2e8f0',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.75rem',
                }}
              >
                ← Back to Operations
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
