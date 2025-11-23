import React, { useMemo, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Box } from '@mui/material';
import VoiceInterface from './components/VoiceInterface';
import ParticleBackground from './components/ParticleBackground';
import './App.css';

const THEME_CONFIGS = {
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
  const [themeName, setThemeName] = useState('neon');
  const theme = useMemo(
    () => createTheme(THEME_CONFIGS[themeName] || THEME_CONFIGS.neon),
    [themeName]
  );

  // Apply body background color based on theme
  React.useEffect(() => {
    if (themeName === 'dsp') {
      document.body.style.backgroundColor = '#000000';
      document.body.style.backgroundImage = 'none';
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
      {themeName !== 'dsp' && <ParticleBackground />}
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
          <VoiceInterface themeName={themeName} onThemeChange={setThemeName} />
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
