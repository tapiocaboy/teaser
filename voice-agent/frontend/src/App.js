import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Box } from '@mui/material';
import VoiceInterface from './components/VoiceInterface';
import ParticleBackground from './components/ParticleBackground';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7CFC00',
      dark: '#62c400',
      light: '#a5ff4f',
    },
    secondary: {
      main: '#8e24aa',
      dark: '#5c007a',
      light: '#c158dc',
    },
    background: {
      default: '#01010b',
      paper: 'rgba(7, 15, 28, 0.85)',
    },
    text: {
      primary: '#E3F2FD',
      secondary: 'rgba(227, 242, 253, 0.7)',
    },
  },
  typography: {
    fontFamily: '"Space Grotesk", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '1px',
    },
    button: {
      letterSpacing: '1px',
    },
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
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ParticleBackground />
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
          <VoiceInterface />
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
