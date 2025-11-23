import React, { useMemo, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Box } from '@mui/material';
import VoiceInterface from './components/VoiceInterface';
import ParticleBackground from './components/ParticleBackground';
import './App.css';

const THEME_CONFIGS = {
  synthwave: {
    palette: {
      mode: 'dark',
      primary: { main: '#ff006e', dark: '#d6005c', light: '#ff3385' },
      secondary: { main: '#8338ec', dark: '#6a2cc4', light: '#9d5ff0' },
      background: { default: '#0f0820', paper: 'rgba(15, 8, 32, 0.9)' },
      text: { primary: '#ffbe0b', secondary: 'rgba(255, 190, 11, 0.7)' },
    },
    typography: {
      fontFamily: '"Space Grotesk", "Orbitron", "Roboto", sans-serif',
      h4: { fontWeight: 700, letterSpacing: '2px' },
      button: { letterSpacing: '1.5px' },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'linear-gradient(145deg, rgba(15,8,32,0.95), rgba(50,20,70,0.9))',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '2px solid rgba(255, 0, 110, 0.3)',
            boxShadow: '0 0 40px rgba(255, 0, 110, 0.2)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '999px',
            textTransform: 'uppercase',
            fontWeight: 700,
            letterSpacing: 2,
            boxShadow: '0 0 25px rgba(255, 0, 110, 0.4)',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              boxShadow: '0 0 35px rgba(255, 0, 110, 0.6)',
              transform: 'translateY(-2px)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '2px solid rgba(131, 56, 236, 0.3)',
            boxShadow: '0 0 40px rgba(131, 56, 236, 0.25)',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: '999px',
            backgroundColor: 'rgba(255, 0, 110, 0.2)',
            border: '1px solid rgba(255, 0, 110, 0.3)',
          },
          bar: {
            borderRadius: '999px',
            background: 'linear-gradient(90deg, #ff006e, #8338ec, #3a86ff)',
          },
        },
      },
    },
  },
  neon: {
    palette: {
      mode: 'dark',
      primary: { main: '#7CFC00', dark: '#62c400', light: '#a5ff4f' },
      secondary: { main: '#8e24aa', dark: '#5c007a', light: '#c158dc' },
      background: { default: '#01010b', paper: 'rgba(7, 15, 28, 0.85)' },
      text: { primary: '#E3F2FD', secondary: 'rgba(227, 242, 253, 0.7)' },
    },
    typography: {
      fontFamily: '"Space Grotesk", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700, letterSpacing: '1px' },
      button: { letterSpacing: '1px' },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backdropFilter: 'blur(18px)',
            borderRadius: '20px',
            border: '1px solid rgba(124, 252, 0, 0.15)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '999px',
            textTransform: 'uppercase',
            fontWeight: 600,
            letterSpacing: 1,
            boxShadow: '0 10px 35px rgba(0,0,0,0.35)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: '0 15px 45px rgba(0,0,0,0.45)',
              transform: 'translateY(-2px)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backdropFilter: 'blur(18px)',
            borderRadius: '20px',
            border: '1px solid rgba(124, 252, 0, 0.12)',
            boxShadow: '0 30px 60px rgba(0, 0, 0, 0.55)',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: '999px',
            backgroundColor: 'rgba(13, 71, 161, 0.35)',
          },
          bar: {
            borderRadius: '999px',
            background: 'linear-gradient(90deg, #8e24aa, #1e88e5, #7CFC00)',
          },
        },
      },
    },
  },
  dsp: {
    palette: {
      mode: 'dark',
      primary: { main: '#39FF14', dark: '#39FF14', light: '#39FF14' },
      secondary: { main: '#39FF14', dark: '#39FF14', light: '#39FF14' },
      background: {
        default: '#000000',
        paper: '#000000',
      },
      text: {
        primary: '#39FF14',
        secondary: '#39FF14',
      },
    },
    typography: {
      fontFamily: '"IBM Plex Mono", "Space Grotesk", "Roboto", sans-serif',
      h4: { fontWeight: 600, letterSpacing: '0.08em' },
      button: { letterSpacing: '0.08em' },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: '#000000',
            borderRadius: '18px',
            border: '1px solid #39FF14',
            boxShadow: '0 0 20px rgba(57, 255, 20, 0.3)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '18px',
            textTransform: 'uppercase',
            fontWeight: 600,
            letterSpacing: '0.1em',
            backgroundImage: 'none',
            backgroundColor: '#39FF14',
            color: '#000000',
            boxShadow: '0 0 15px rgba(57, 255, 20, 0.5)',
            '&:hover': {
              backgroundColor: '#39FF14',
              boxShadow: '0 0 25px rgba(57, 255, 20, 0.8)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '18px',
            border: '1px solid #39FF14',
            boxShadow: '0 0 20px rgba(57, 255, 20, 0.3)',
            backgroundColor: '#000000',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: '999px',
            backgroundColor: '#000000',
            border: '1px solid #39FF14',
          },
          bar: {
            borderRadius: '999px',
            background: '#39FF14',
          },
        },
      },
    },
  },
};

function App() {
  // Load theme from localStorage or default to 'neon'
  const [themeName, setThemeName] = useState(() => {
    const savedTheme = localStorage.getItem('voiceAgentTheme');
    return savedTheme && THEME_CONFIGS[savedTheme] ? savedTheme : 'neon';
  });
  
  const theme = useMemo(
    () => createTheme(THEME_CONFIGS[themeName] || THEME_CONFIGS.neon),
    [themeName]
  );

  // Save theme to localStorage when it changes
  const handleThemeChange = React.useCallback((newTheme) => {
    setThemeName(newTheme);
    localStorage.setItem('voiceAgentTheme', newTheme);
  }, []);

  // Apply body background color based on theme
  React.useEffect(() => {
    if (themeName === 'dsp') {
      document.body.style.backgroundColor = '#000000';
      document.body.style.backgroundImage = 'none';
    } else if (themeName === 'synthwave') {
      document.body.style.backgroundColor = '#0f0820';
      document.body.style.backgroundImage = `
        radial-gradient(circle at 15% 15%, rgba(255, 0, 110, 0.15), transparent 40%),
        radial-gradient(circle at 85% 20%, rgba(131, 56, 236, 0.18), transparent 35%),
        radial-gradient(circle at 50% 85%, rgba(58, 134, 255, 0.12), transparent 40%)
      `;
    } else {
      document.body.style.backgroundColor = '#01010b';
      document.body.style.backgroundImage = `
        radial-gradient(circle at 20% 20%, rgba(124, 252, 0, 0.12), transparent 45%),
        radial-gradient(circle at 80% 0%, rgba(30, 136, 229, 0.18), transparent 30%),
        radial-gradient(circle at 50% 80%, rgba(142, 36, 170, 0.15), transparent 35%)
      `;
    }
  }, [themeName]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {themeName !== 'dsp' && <ParticleBackground themeName={themeName} />}
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
          <VoiceInterface themeName={themeName} onThemeChange={handleThemeChange} />
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
