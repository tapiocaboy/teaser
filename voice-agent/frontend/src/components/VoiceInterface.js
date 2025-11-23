import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Mic,
  PlayArrow,
  Stop,
  History,
  ExpandMore,
  Summarize,
  Psychology,
  GraphicEq,
  Memory,
} from '@mui/icons-material';
// Using native WebSocket instead of Socket.IO
import AudioService from '../services/AudioService';
import ApiService from '../services/ApiService';
import ConversationHistory from './ConversationHistory';
import AudioVisualizer from './AudioVisualizer';
import WaveformVisualizer from './WaveformVisualizer';

const INITIAL_VISUALIZER_STATE = {
  wavePoints: new Array(64).fill(0),
  amplitude: 0,
  frequency: 0,
  wavelength: 0,
};

const THEME_CHOICES = [
  { value: 'neon', label: 'Neon Pulse' },
  { value: 'dsp', label: 'DSP Matrix' },
];

const themeStyles = {
  neon: {
    textGradient: 'linear-gradient(120deg, #7CFC00 0%, #1e88e5 45%, #8e24aa 85%)',
    panelBg: 'linear-gradient(145deg, rgba(4, 2, 14, 0.85), rgba(13, 32, 61, 0.95))',
    panelBorder: '1px solid rgba(124, 252, 0, 0.2)',
    panelOverlay: 'radial-gradient(circle at 15% 20%, rgba(124,252,0,0.08), transparent 45%)',
    startGradient: 'linear-gradient(120deg, #7CFC00 0%, #1e88e5 60%)',
    startHover: 'linear-gradient(120deg, #7CFC00 0%, #1d976c 60%, #00B4DB 100%)',
    startColor: '#ffffff',
    startShadow: '0 18px 45px rgba(0, 131, 176, 0.45)',
    listeningGradient: 'linear-gradient(120deg, #00c853 0%, #7CFC00 70%)',
    listeningShadow: '0 15px 35px rgba(0, 200, 83, 0.35)',
    listeningText: '#01010b',
    stopGradient: 'linear-gradient(130deg, #6a11cb 0%, #b91372 80%)',
    stopHover: 'linear-gradient(130deg, #b91372 0%, #ff758c 100%)',
    stopShadow: '0 14px 30px rgba(185, 19, 114, 0.5)',
    progressTrack: 'rgba(255, 255, 255, 0.1)',
    progressBar: 'linear-gradient(90deg, #8e24aa, #1e88e5, #7CFC00)',
    summaryBg: 'linear-gradient(135deg, rgba(30, 136, 229, 0.18), rgba(124, 252, 0, 0.18))',
    summaryBorder: '1px solid rgba(124, 252, 0, 0.25)',
    cardBg: 'linear-gradient(160deg, rgba(4, 5, 20, 0.9), rgba(13, 34, 66, 0.95))',
    cardBorder: '1px solid rgba(124, 252, 0, 0.18)',
    transcriptBg: 'linear-gradient(135deg, rgba(124, 252, 0, 0.12), rgba(30, 136, 229, 0.12))',
    transcriptBorder: '1px solid rgba(124, 252, 0, 0.3)',
    transcriptAccent: '#7CFC00',
    responseBg: 'linear-gradient(135deg, rgba(142, 36, 170, 0.12), rgba(30, 136, 229, 0.12))',
    responseBorder: '1px solid rgba(142, 36, 170, 0.25)',
    responseAccent: '#8e24aa',
    historyBorder: '2px solid rgba(142, 36, 170, 0.6)',
    historyBg: 'rgba(4, 2, 14, 0.7)',
    historyHoverBg: 'rgba(142, 36, 170, 0.2)',
    historyHoverBorder: '2px solid #7CFC00',
    historyHoverShadow: '0 15px 30px rgba(142, 36, 170, 0.35)',
    textShadow: '0 0 30px rgba(124, 252, 0, 0.35)',
    bodyTextShadow: '0 0 20px rgba(0, 188, 212, 0.25)',
  },
  dsp: {
    textGradient: 'none',
    panelBg: '#000000',
    panelBorder: '1px solid #39FF14',
    panelOverlay: 'none',
    startGradient: '#39FF14',
    startHover: '#39FF14',
    startColor: '#000000',
    startShadow: '0 0 20px rgba(57, 255, 20, 0.6)',
    listeningGradient: '#39FF14',
    listeningShadow: '0 0 20px rgba(57, 255, 20, 0.6)',
    listeningText: '#000000',
    stopGradient: '#39FF14',
    stopHover: '#39FF14',
    stopShadow: '0 0 20px rgba(57, 255, 20, 0.6)',
    progressTrack: '#000000',
    progressBar: '#39FF14',
    summaryBg: '#000000',
    summaryBorder: '1px solid #39FF14',
    cardBg: '#000000',
    cardBorder: '1px solid #39FF14',
    transcriptBg: '#000000',
    transcriptBorder: '1px solid #39FF14',
    transcriptAccent: '#39FF14',
    responseBg: '#000000',
    responseBorder: '1px solid #39FF14',
    responseAccent: '#39FF14',
    historyBorder: '2px solid #39FF14',
    historyBg: '#000000',
    historyHoverBg: '#000000',
    historyHoverBorder: '2px solid #39FF14',
    historyHoverShadow: '0 0 25px rgba(57, 255, 20, 0.5)',
    textShadow: '0 0 15px rgba(57, 255, 20, 0.5)',
    bodyTextShadow: '0 0 10px rgba(57, 255, 20, 0.3)',
  },
};

const VoiceInterface = ({ themeName = 'neon', onThemeChange }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const [lastAudioBlob, setLastAudioBlob] = useState(null);
  const [llmMetadata, setLlmMetadata] = useState(null);
  const [pipelineInsights, setPipelineInsights] = useState(null);
  const [visualizerStats, setVisualizerStats] = useState(INITIAL_VISUALIZER_STATE);

  const audioService = useRef(new AudioService());
  const apiService = useRef(new ApiService());

  const palette = useMemo(
    () => themeStyles[themeName] || themeStyles.neon,
    [themeName]
  );

  // WebSocket connection removed - using HTTP API instead
  useEffect(() => {
    console.log('Teaser initialized - ready to process audio');
  }, []);


  const speakWithWebSpeech = (text) => {
    if (!text) {
      alert('No response text available to speak.');
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = 'en-US';
    utterance.onstart = () => console.log('Web Speech synthesis started');
    utterance.onend = () => console.log('Web Speech synthesis finished');
    window.speechSynthesis.speak(utterance);
  };

  const shouldUseSpeechSynthesis = (audioDataString) => {
    if (!audioDataString) return true;
    if (pipelineInsights?.tts?.available === false) return true;
    if ((pipelineInsights?.tts?.audio_bytes ?? 0) < 4000) return true;
    if (audioDataString.length < 4000) return true;
    return false;
  };

  const playAudioResponse = async (audioData: string, fallbackText?: string) => {
    try {
      console.log('=== AUDIO PLAYBACK START ===');
      console.log('Audio data exists:', !!audioData);
      console.log('Audio data length:', audioData?.length);

      if (shouldUseSpeechSynthesis(audioData)) {
        console.log('Falling back to Web Speech synthesis');
        speakWithWebSpeech(fallbackText || response);
        return;
      }

      // Try simple data URL approach first for testing
      console.log('Creating data URL for testing...');
      const dataUrl = `data:audio/wav;base64,${audioData}`;

      const testAudio = new Audio();
      testAudio.src = dataUrl;
      testAudio.volume = 1.0;

      testAudio.onloadeddata = () => {
        console.log('✓ Data URL audio loaded, duration:', testAudio.duration);
      };

      testAudio.oncanplay = () => {
        console.log('✓ Data URL audio can play');
      };

      testAudio.onerror = (e) => {
        console.error('✗ Data URL audio error:', e);
      };

      testAudio.onended = () => {
        console.log('✓ Data URL audio playback completed');
      };

      console.log('Testing data URL playback...');
      testAudio.play().then(() => {
        console.log('✓ Data URL audio started');
      }).catch(err => {
        console.error('✗ Data URL playback failed:', err);
        console.log('Falling back to Web Audio API...');

        // Fallback to Web Audio API
        playWithWebAudioAPI();
      });

      async function playWithWebAudioAPI() {
          try {
            console.log('Decoding base64 audio data for Web Audio API...');
            const audioBytes = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
            console.log('Decoded bytes length:', audioBytes.length);

            // Validate WAV header after decoding
            const header = String.fromCharCode(...audioBytes.slice(0, 4));
            console.log('Decoded WAV header:', header, 'bytes:', audioBytes.slice(0, 4));

            if (header !== 'RIFF') {
              console.error('Invalid WAV header after decoding:', header);
              console.error('First 20 decoded bytes:', audioBytes.slice(0, 20));
              alert('Audio data appears corrupted');
              return;
            }

            // Check WAV format details
            const format = String.fromCharCode(...audioBytes.slice(8, 12));
            const audioFormat = audioBytes[20] | (audioBytes[21] << 8);
            const channels = audioBytes[22] | (audioBytes[23] << 8);
            const sampleRate = audioBytes[24] | (audioBytes[25] << 8) | (audioBytes[26] << 16) | (audioBytes[27] << 24);

            console.log('WAV format check:', {
              format,
              audioFormat,
              channels,
              sampleRate
            });

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext created, state:', audioContext.state);

            // Resume audio context if needed (required by some browsers)
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
              console.log('AudioContext resumed');
            }

            console.log('Decoding audio data...');
            console.log('Audio bytes buffer info:', {
              byteLength: audioBytes.buffer.byteLength,
              firstSample: audioBytes[44] | (audioBytes[45] << 8), // First audio sample after WAV header
              lastSample: audioBytes[audioBytes.length - 2] | (audioBytes[audioBytes.length - 1] << 8)
            });

            const audioBuffer = await audioContext.decodeAudioData(audioBytes.buffer.slice());
            console.log('✓ Audio decoded successfully, duration:', audioBuffer.duration, 'seconds');
            console.log('Channels:', audioBuffer.numberOfChannels, 'Sample rate:', audioBuffer.sampleRate);
            console.log('Buffer length:', audioBuffer.length, 'sample values:');
            if (audioBuffer.length > 0) {
              const channelData = audioBuffer.getChannelData(0);
              console.log('First 10 samples:', Array.from(channelData.slice(0, 10)));
              console.log('Last 10 samples:', Array.from(channelData.slice(-10)));
            }

            // Analyze the decoded audio buffer
            const channelData = audioBuffer.getChannelData(0);
            const maxAmplitude = Math.max(...Array.from(channelData).map(Math.abs));
            const rms = Math.sqrt(channelData.reduce((sum, sample) => sum + sample * sample, 0) / channelData.length);

            console.log('Audio analysis:', {
              duration: audioBuffer.duration,
              length: audioBuffer.length,
              maxAmplitude: maxAmplitude.toFixed(4),
              rms: rms.toFixed(4),
              sampleRate: audioBuffer.sampleRate
            });

            // Check if audio has content (not silence)
            if (maxAmplitude < 0.001) {
              console.warn('⚠️ Audio appears to be silence or very quiet');
              alert('Audio appears to be silent or corrupted');
              return;
            }

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            source.onended = () => {
              console.log('✓ Audio playback completed');
            };

            console.log('Starting audio playback...');
            source.start(0);
            console.log('✓ Audio playback started - you should hear a 440Hz tone');
          } catch (webAudioError) {
            console.error('✗ Web Audio API failed:', webAudioError);
            alert('Unable to play audio. Please check browser compatibility.');
          }
      }

    } catch (err) {
      console.error('✗ Exception in playAudioResponse:', err);
      if (fallbackText) {
        speakWithWebSpeech(fallbackText);
      } else {
        alert('Error playing audio: ' + err.message);
      }
    }
  };

  const startListening = async () => {
    try {
      setError('');
      setIsListening(true);
      setIsProcessing(true);
      setTranscript('');
      setResponse('');
      setVisualizerStats(INITIAL_VISUALIZER_STATE);
      setLlmMetadata(null);
      setPipelineInsights(null);

      await audioService.current.startRecording(
        (audioBlob) => {
          handleAudioRecorded(audioBlob);
        },
        (level) => {
          setAudioLevel(level);
        },
        (analysis) => {
          if (!analysis) return;
          setVisualizerStats({
            wavePoints: analysis.wavePoints || INITIAL_VISUALIZER_STATE.wavePoints,
            amplitude: analysis.amplitude ?? 0,
            frequency: analysis.frequency ?? 0,
            wavelength: analysis.wavelength ?? 0,
          });
        }
      );
    } catch (err) {
      setError('Failed to start recording');
      setIsListening(false);
      setIsProcessing(false);
    }
  };

  const stopListening = async () => {
    try {
      setIsListening(false);
      setVisualizerStats(INITIAL_VISUALIZER_STATE);
      await audioService.current.stopRecording();
    } catch (err) {
      setError('Failed to stop recording');
    }
  };

  const handleAudioRecorded = async (audioBlob) => {
    try {
      console.log('Audio blob received:', {
        size: audioBlob.size,
        type: audioBlob.type,
        blob: audioBlob
      });

      // Store the audio blob for playback
      setLastAudioBlob(audioBlob);

      if (audioBlob.size < 100) {
        setError('Audio recording too short. Please speak for longer.');
        setIsProcessing(false);
        return;
      }

      const result = await apiService.current.processAudio(audioBlob);
      console.log('=== API RESPONSE RECEIVED ===');
      console.log('Transcript:', result.transcript);
      console.log('Response:', result.response);
      console.log('Has audio_data:', !!result.audio_data);
      console.log('Audio data length:', result.audio_data?.length);
      console.log('Audio data preview:', result.audio_data?.substring(0, 50));

      setTranscript(result.transcript);
      setResponse(result.response);
      setAudioData(result.audio_data);
      setLlmMetadata(result.llm_metadata || null);
      setPipelineInsights(result.pipeline || null);
      setIsProcessing(false);

      console.log('=== STATE UPDATED ===');
      console.log('State audioData set to length:', result.audio_data?.length);

      // Generate summary after processing
      if (result.transcript && result.response) {
        await generateSummary(result.transcript, result.response);
      }
    } catch (err) {
      setError('Failed to process audio');
      setIsProcessing(false);
    }
  };

  const generateSummary = async (originalText, aiResponse) => {
    try {
      setIsSummarizing(true);

      // Create a summary by combining and shortening the content
      const combinedText = `User said: "${originalText}". AI responded: "${aiResponse}"`;
      const summary = combinedText.length > 200
        ? combinedText.substring(0, 200) + "..."
        : combinedText;

      setSummary(summary);
    } catch (err) {
      console.error('Failed to generate summary:', err);
      setSummary('Summary generation failed');
    } finally {
      setIsSummarizing(false);
    }
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  const InsightCard = ({ icon, title, value, footer, gradient }) => (
    <Box
      sx={{
        p: 3,
        borderRadius: 3,
        background: themeName === 'dsp' ? '#000000' : (gradient || 'linear-gradient(145deg, rgba(3,7,18,0.9), rgba(11,25,48,0.95))'),
        border: themeName === 'dsp' ? '1px solid #39FF14' : '1px solid rgba(124, 252, 0, 0.2)',
        boxShadow: themeName === 'dsp' ? '0 0 20px rgba(57, 255, 20, 0.3)' : '0 15px 40px rgba(3,7,18,0.55)',
        minHeight: 140,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {React.cloneElement(icon, { sx: { color: themeName === 'dsp' ? '#39FF14' : icon.props.sx?.color } })}
        <Typography variant="subtitle2" sx={{ letterSpacing: 1, color: themeName === 'dsp' ? '#39FF14' : '#E3F2FD' }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: themeName === 'dsp' ? '#39FF14' : '#7CFC00' }}>
        {value}
      </Typography>
      {footer && (
        <Typography variant="body2" sx={{ color: themeName === 'dsp' ? '#39FF14' : 'rgba(227, 242, 253, 0.7)', mt: 1 }}>
          {footer}
        </Typography>
      )}
    </Box>
  );

  const formatMs = (value) => (typeof value === 'number' ? `${value} ms` : '—');

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', position: 'relative', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <ToggleButtonGroup
          value={themeName}
          exclusive
          size="small"
          onChange={(event, value) => {
            if (value && onThemeChange) {
              onThemeChange(value);
            }
          }}
          aria-label="Theme selection"
          sx={{
            background: themeName === 'dsp' ? '#000000' : 'rgba(255,255,255,0.05)',
            border: themeName === 'dsp' ? '1px solid #39FF14' : 'none',
            borderRadius: '999px',
            p: 0.5,
          }}
        >
          {THEME_CHOICES.map((choice) => (
            <ToggleButton
              key={choice.value}
              value={choice.value}
              aria-label={choice.label}
              sx={{
                px: 2,
                textTransform: 'none',
                fontWeight: 600,
                border: 'none',
                color: themeName === 'dsp' ? '#39FF14' : 'inherit',
                '&.Mui-selected': {
                  backgroundColor: themeName === 'dsp' ? '#39FF14' : 'rgba(124, 252, 0, 0.2)',
                  color: themeName === 'dsp' ? '#000000' : 'inherit',
                  '&:hover': {
                    backgroundColor: themeName === 'dsp' ? '#39FF14' : 'rgba(124, 252, 0, 0.3)',
                  },
                },
              }}
            >
              {choice.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        align="center"
        sx={{
          mb: 2,
          background: themeName === 'dsp' ? 'none' : palette.textGradient,
          color: themeName === 'dsp' ? '#39FF14' : 'inherit',
          WebkitBackgroundClip: themeName === 'dsp' ? 'unset' : 'text',
          WebkitTextFillColor: themeName === 'dsp' ? '#39FF14' : 'transparent',
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: 'uppercase',
          textShadow: palette.textShadow,
        }}
      >
        🎭 Teaser
      </Typography>
      <Typography
        variant="body1"
        color={themeName === 'dsp' ? '#39FF14' : 'rgba(176, 190, 197, 0.9)'}
        align="center"
        sx={{
          mb: 4,
          opacity: 0.95,
          fontSize: '1.1rem',
          lineHeight: 1.6,
          maxWidth: 520,
          mx: 'auto',
          textShadow: palette.bodyTextShadow,
        }}
      >
        Click "Start Teaser" to begin recording. Speak clearly, then click "Stop Recording" to process your audio.
      </Typography>

      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 3,
          background: palette.panelBg,
          backdropFilter: 'blur(24px)',
          border: palette.panelBorder,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background:
              themeName === 'dsp'
                ? '#39FF14'
                : 'linear-gradient(90deg, #8e24aa, #1e88e5, #7CFC00)',
            backgroundSize: '200% 100%',
            animation: 'gradientShift 3s ease infinite',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: palette.panelOverlay,
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 3 }}>
          {!isListening ? (
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Mic />}
              onClick={startListening}
              disabled={isProcessing}
              sx={{
                minWidth: 220,
                minHeight: 70,
                fontSize: '1.1rem',
                borderRadius: '28px',
                background: palette.startGradient,
                color: palette.startColor,
                boxShadow: palette.startShadow,
                '&:hover': {
                  background: palette.startHover,
                  boxShadow:
                    themeName === 'dsp'
                      ? '0 0 30px rgba(57, 255, 20, 0.8)'
                      : '0 24px 55px rgba(124, 252, 0, 0.4)',
                  transform: 'translateY(-3px)',
                },
                '&:disabled': {
                  background: themeName === 'dsp' ? '#000000' : 'rgba(255, 255, 255, 0.08)',
                  color: themeName === 'dsp' ? '#39FF14' : 'rgba(255, 255, 255, 0.3)',
                  border: themeName === 'dsp' ? '1px solid #39FF14' : 'none',
                },
              }}
            >
              Start Teaser
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                size="large"
                startIcon={<Stop />}
                onClick={stopListening}
                sx={{
                  minWidth: 180,
                  minHeight: 70,
                  fontSize: '1.1rem',
                  borderRadius: '25px',
                  background: palette.stopGradient,
                  color: themeName === 'dsp' ? '#fff' : undefined,
                  boxShadow: palette.stopShadow,
                  '&:hover': {
                    background: palette.stopHover,
                    boxShadow:
                      themeName === 'dsp'
                        ? '0 0 30px rgba(57, 255, 20, 0.8)'
                        : '0 20px 45px rgba(255, 117, 140, 0.45)',
                    transform: 'translateY(-3px)',
                  },
                }}
              >
                Stop Recording
          </Button>
            </>
          )}
        </Box>

        {isListening && (
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography
              variant="body1"
              color="primary"
              align="center"
              gutterBottom
              sx={{
                fontSize: '1.1rem',
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              🎤 Listening... Speak now
            </Typography>
            <Box sx={{ position: 'relative', mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={audioLevel * 100}
                sx={{
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: palette.progressTrack,
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 6,
                    background: palette.progressBar,
                    boxShadow:
                      themeName === 'dsp'
                        ? '0 0 15px rgba(57, 255, 20, 0.6)'
                        : '0 0 15px rgba(30, 136, 229, 0.4)',
                  },
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: -25,
                  left: `${audioLevel * 100}%`,
                  transform: 'translateX(-50%)',
                  color: themeName === 'dsp' ? '#39FF14' : '#7CFC00',
                  fontSize: '1.5rem',
                  transition: 'left 0.1s ease-out',
                }}
              >
                🎵
              </Box>
            </Box>
            <AudioVisualizer
              level={audioLevel}
              isActive={isListening}
              samples={visualizerStats.wavePoints}
            />
            <WaveformVisualizer
              wavePoints={visualizerStats.wavePoints}
              amplitude={visualizerStats.amplitude}
              frequency={visualizerStats.frequency}
              wavelength={visualizerStats.wavelength}
              isActive={isListening}
            />
          </Box>
        )}

        {isProcessing && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: 3,
              p: 2,
              borderRadius: 2,
              background: themeName === 'dsp' ? '#000000' : 'linear-gradient(135deg, rgba(30, 136, 229, 0.15), rgba(142, 36, 170, 0.2))',
              border: themeName === 'dsp' ? '1px solid #39FF14' : '1px solid rgba(124, 252, 0, 0.25)',
            }}
          >
            <CircularProgress
              size={50}
              sx={{
                color: themeName === 'dsp' ? '#39FF14' : '#7CFC00',
                mb: 1,
              }}
            />
            <Typography
              variant="body1"
              sx={{
                color: themeName === 'dsp' ? '#39FF14' : '#E3F2FD',
                fontWeight: 500,
                textAlign: 'center',
              }}
            >
              Processing your voice...
            </Typography>
            <Typography
              variant="body2"
              color={themeName === 'dsp' ? '#39FF14' : 'text.secondary'}
              sx={{ textAlign: 'center', mt: 0.5 }}
            >
              This may take a few seconds
            </Typography>
          </Box>
        )}

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              borderRadius: 2,
              background: themeName === 'dsp' ? '#000000' : 'rgba(244, 67, 54, 0.1)',
              border: themeName === 'dsp' ? '1px solid #39FF14' : '1px solid rgba(244, 67, 54, 0.3)',
              color: themeName === 'dsp' ? '#39FF14' : '#ffcdd2',
              '& .MuiAlert-icon': {
                color: themeName === 'dsp' ? '#39FF14' : '#f44336',
              },
            }}
          >
            ⚠️ {error}
          </Alert>
        )}
      </Paper>

      {llmMetadata && (
        <Card
          sx={{
            mb: 3,
            background: themeName === 'dsp' ? '#000000' : 'linear-gradient(155deg, rgba(4,6,18,0.95), rgba(12,36,64,0.95))',
            border: themeName === 'dsp' ? '1px solid #39FF14' : '1px solid rgba(124, 252, 0, 0.2)',
            boxShadow: themeName === 'dsp' ? '0 0 20px rgba(57, 255, 20, 0.4)' : '0 20px 45px rgba(2,6,18,0.65)',
          }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: themeName === 'dsp' ? '#39FF14' : 'inherit' }}>
              <GraphicEq sx={{ color: themeName === 'dsp' ? '#39FF14' : '#7CFC00' }} />
              Neural Telemetry
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={4}>
                <InsightCard
                  icon={<Memory sx={{ color: '#90caf9' }} />}
                  title="Tokens Consumed"
                  value={(llmMetadata?.token_usage?.total ?? 0).toLocaleString()}
                  footer={`Prompt ${llmMetadata?.token_usage?.prompt ?? 0} • Completion ${llmMetadata?.token_usage?.completion ?? 0}`}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <InsightCard
                  icon={<Psychology sx={{ color: '#f48fb1' }} />}
                  title="LLM Model"
                  value={llmMetadata?.model || 'unknown'}
                  footer={`Answer length: ${(llmMetadata?.answer || response || '').length} chars`}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <InsightCard
                  icon={<GraphicEq sx={{ color: '#7CFC00' }} />}
                  title="Timings"
                  value={`Total ${formatMs(llmMetadata?.timings?.total_duration_ms)}`}
                  footer={`Prompt ${formatMs(llmMetadata?.timings?.prompt_eval_ms)} • Generation ${formatMs(llmMetadata?.timings?.generation_ms)}`}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {llmMetadata && (
        <Paper
          sx={{
            mb: 3,
            p: 3,
            borderRadius: 3,
            background: themeName === 'dsp' ? '#000000' : 'linear-gradient(135deg, rgba(11,30,61,0.9), rgba(53,16,67,0.85))',
            border: themeName === 'dsp' ? '1px solid #39FF14' : '1px solid rgba(142, 36, 170, 0.35)',
            boxShadow: themeName === 'dsp' ? '0 0 20px rgba(57, 255, 20, 0.3)' : '0 18px 40px rgba(4,5,20,0.7)',
          }}
        >
          <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: themeName === 'dsp' ? '#39FF14' : '#E3F2FD', mb: 1 }}>
            <Psychology fontSize="small" sx={{ color: themeName === 'dsp' ? '#39FF14' : 'inherit' }} />
            Chain of Thought
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: themeName === 'dsp' ? '#39FF14' : 'rgba(227, 242, 253, 0.85)',
              lineHeight: 1.7,
            }}
          >
            {llmMetadata?.reasoning || 'This model kept its internal reasoning hidden for this turn.'}
          </Typography>
        </Paper>
      )}

      {pipelineInsights && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                background: themeName === 'dsp' ? '#000000' : 'rgba(3,7,18,0.85)',
                border: themeName === 'dsp' ? '1px solid #39FF14' : '1px solid rgba(144, 202, 249, 0.25)',
                boxShadow: themeName === 'dsp' ? '0 0 15px rgba(57, 255, 20, 0.3)' : 'none',
                height: '100%',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: themeName === 'dsp' ? '#39FF14' : '#90caf9', letterSpacing: 1 }}>
                STT • {pipelineInsights?.stt?.model || 'Whisper'}
              </Typography>
              <Typography variant="caption" sx={{ color: themeName === 'dsp' ? '#39FF14' : 'rgba(227,242,253,0.6)' }}>
                Device: {pipelineInsights?.stt?.device || 'cpu'} · Precision: {pipelineInsights?.stt?.compute_type || 'int8'}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1.5, color: themeName === 'dsp' ? '#39FF14' : 'rgba(227, 242, 253, 0.8)' }}
              >
                {pipelineInsights?.stt?.transcript || transcript || 'Awaiting speech input...'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                background: themeName === 'dsp' ? '#000000' : 'rgba(8,20,40,0.9)',
                border: themeName === 'dsp' ? '1px solid #39FF14' : '1px solid rgba(124, 252, 0, 0.25)',
                boxShadow: themeName === 'dsp' ? '0 0 15px rgba(57, 255, 20, 0.3)' : 'none',
                height: '100%',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: themeName === 'dsp' ? '#39FF14' : '#7CFC00', letterSpacing: 1 }}>
                LLM • {llmMetadata?.model || pipelineInsights?.llm?.model || '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: themeName === 'dsp' ? '#39FF14' : 'rgba(227,242,253,0.6)' }}>
                Tokens: {(llmMetadata?.token_usage?.total ?? pipelineInsights?.llm?.token_usage?.total ?? 0).toLocaleString()}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1.5, color: themeName === 'dsp' ? '#39FF14' : 'rgba(227, 242, 253, 0.8)' }}
              >
                {pipelineInsights?.llm?.answer || response || 'No response yet.'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                background: themeName === 'dsp' ? '#000000' : 'rgba(19,6,32,0.9)',
                border: themeName === 'dsp' ? '1px solid #39FF14' : '1px solid rgba(244, 143, 177, 0.2)',
                boxShadow: themeName === 'dsp' ? '0 0 15px rgba(57, 255, 20, 0.3)' : 'none',
                height: '100%',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: themeName === 'dsp' ? '#39FF14' : '#f48fb1', letterSpacing: 1 }}>
                TTS • {pipelineInsights?.tts?.model || 'Piper'}
              </Typography>
              <Typography variant="caption" sx={{ color: themeName === 'dsp' ? '#39FF14' : 'rgba(227,242,253,0.6)' }}>
                Speed {pipelineInsights?.tts?.speed ?? 1.0} · Bytes {(pipelineInsights?.tts?.audio_bytes ?? 0).toLocaleString()}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1.5, color: themeName === 'dsp' ? '#39FF14' : 'rgba(227, 242, 253, 0.8)' }}
              >
                Voice synthesis ready. Characters rendered: {pipelineInsights?.tts?.character_count ?? 0}.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {(transcript || response) && (
        <Card
          className="voice-agent-card"
          sx={{
            mb: 3,
            background: palette.cardBg,
            backdropFilter: 'blur(28px)',
            border: palette.cardBorder,
            boxShadow:
              themeName === 'dsp'
                ? '0 0 25px rgba(57, 255, 20, 0.4)'
                : '0 25px 60px rgba(4, 5, 20, 0.8)',
          }}
        >
          <CardContent
            sx={{
              p: 3,
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ color: themeName === 'dsp' ? '#39FF14' : 'inherit' }}>
              Conversation
            </Typography>

            {/* Summary Section */}
            {summary && (
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  background: palette.summaryBg,
                  border: palette.summaryBorder,
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background:
                      themeName === 'dsp'
                        ? '#39FF14'
                        : 'linear-gradient(90deg, #8e24aa, #1e88e5, #7CFC00)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Summarize sx={{ mr: 1, fontSize: 20, color: themeName === 'dsp' ? '#39FF14' : '#90caf9' }} />
                  <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600, color: themeName === 'dsp' ? '#39FF14' : 'primary' }}>
                    ✨ Summary
                  </Typography>
                  {isSummarizing && (
                    <CircularProgress
                      size={18}
                      sx={{ ml: 1, color: themeName === 'dsp' ? '#39FF14' : '#90caf9' }}
                    />
                  )}
                </Box>
                <Typography
                  variant="body1"
                  sx={{
                    color: themeName === 'dsp' ? '#39FF14' : 'text.secondary',
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                    opacity: 0.9,
                  }}
                >
                  {summary}
                </Typography>
              </Box>
            )}

            {/* Original Content Accordion */}
            <Accordion
              sx={{
                background: themeName === 'dsp' ? '#000000' : 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: themeName === 'dsp' ? '1px solid #39FF14' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px !important',
                '&:before': {
                  display: 'none',
                },
                '&.Mui-expanded': {
                  background: themeName === 'dsp' ? '#000000' : 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore sx={{ color: themeName === 'dsp' ? '#39FF14' : 'inherit' }} />}
                aria-controls="conversation-content"
                id="conversation-header"
              >
                <Typography variant="subtitle1" sx={{ color: themeName === 'dsp' ? '#39FF14' : 'inherit' }}>View Details</Typography>
                <Chip
                  label={`${transcript ? 'Transcript' : ''}${transcript && response ? ' + ' : ''}${response ? 'Response' : ''}`}
                  size="small"
                  sx={{ 
                    ml: 1,
                    backgroundColor: themeName === 'dsp' ? '#000000' : 'inherit',
                    color: themeName === 'dsp' ? '#39FF14' : 'inherit',
                    border: themeName === 'dsp' ? '1px solid #39FF14' : 'none',
                  }}
                />
              </AccordionSummary>
              <AccordionDetails>
                {transcript && (
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        color: themeName === 'dsp' ? '#39FF14' : '#4caf50',
                        fontWeight: 600,
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      gutterBottom
                    >
                      <Mic sx={{ mr: 1, fontSize: 20, color: themeName === 'dsp' ? '#39FF14' : 'inherit' }} />
                      You said:
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        p: 2,
                        background: palette.transcriptBg,
                        border: palette.transcriptBorder,
                        borderRadius: 2,
                        borderLeft: `4px solid ${palette.transcriptAccent}`,
                        lineHeight: 1.6,
                        color: themeName === 'dsp' ? '#39FF14' : 'text.primary',
                      }}
                    >
              {transcript}
            </Typography>
                  </Box>
      )}

      {response && (
                  <Box>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        color: themeName === 'dsp' ? '#39FF14' : '#f48fb1',
                        fontWeight: 600,
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      gutterBottom
                    >
                      🤖 Assistant Response:
            </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        p: 2,
                        background: palette.responseBg,
                        border: palette.responseBorder,
                        borderRadius: 2,
                        borderLeft: `4px solid ${palette.responseAccent}`,
                        lineHeight: 1.6,
                        color: themeName === 'dsp' ? '#39FF14' : 'text.primary',
                        mb: 2,
                      }}
                    >
              {response}
            </Typography>
                    <Box
                      sx={{
                        mt: 3,
                        display: 'flex',
                        gap: 2,
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
              <Button
                startIcon={<PlayArrow />}
                        variant="contained"
                        disabled={!audioData}
                        onClick={() => {
                          console.log('=== PLAY RESPONSE BUTTON CLICKED ===');
                          console.log('audioData exists:', !!audioData);
                          console.log('audioData length:', audioData?.length);
                          console.log('response text:', response);

                          if (audioData && audioData.length > 0) {
                            const preview = response.substring(0, 100) + (response.length > 100 ? '...' : '');
                            console.log('About to play audio for text:', preview);

                            // Don't show alert, just play directly
                            playAudioResponse(audioData, response);
                          } else {
                            console.error('No audio data available');
                            speakWithWebSpeech(response);
                          }
                        }}
                        sx={{
                          background: themeName === 'dsp' ? '#39FF14' : 'linear-gradient(120deg, #1e88e5 0%, #7CFC00 90%)',
                          color: themeName === 'dsp' ? '#000000' : '#01010b',
                          fontWeight: 600,
                          borderRadius: '20px',
                          px: 3,
                          py: 1,
                          boxShadow: themeName === 'dsp' ? '0 0 20px rgba(57, 255, 20, 0.5)' : '0 10px 25px rgba(30, 136, 229, 0.35)',
                          '&:hover': {
                            background: themeName === 'dsp' ? '#39FF14' : 'linear-gradient(120deg, #7CFC00 0%, #8e24aa 100%)',
                            boxShadow: themeName === 'dsp' ? '0 0 30px rgba(57, 255, 20, 0.8)' : '0 15px 30px rgba(124, 252, 0, 0.35)',
                            transform: 'translateY(-2px)',
                          },
                          '&:disabled': {
                            background: themeName === 'dsp' ? '#000000' : 'rgba(255, 255, 255, 0.08)',
                            color: themeName === 'dsp' ? '#39FF14' : 'rgba(255, 255, 255, 0.35)',
                            border: themeName === 'dsp' ? '1px solid #39FF14' : 'none',
                            boxShadow: 'none',
                          },
                          '&:active': {
                            transform: 'translateY(0)',
                          },
                        }}
                      >
                        🎵 Play Response
                      </Button>
                      <Button
                        startIcon={<Mic />}
                        variant="contained"
                        onClick={() => {
                          // Play back the original recording
                          if (lastAudioBlob) {
                            const url = URL.createObjectURL(lastAudioBlob);
                            const audio = new Audio(url);
                            audio.onended = () => URL.revokeObjectURL(url);
                            audio.play();
                          } else {
                            alert('No recording available to play back');
                          }
                        }}
                        sx={{
                          background: themeName === 'dsp' ? '#39FF14' : 'linear-gradient(120deg, #8e24aa 0%, #311b92 90%)',
                          color: themeName === 'dsp' ? '#000000' : '#fff',
                          fontWeight: 600,
                          borderRadius: '20px',
                          px: 3,
                          py: 1,
                          boxShadow: themeName === 'dsp' ? '0 0 20px rgba(57, 255, 20, 0.5)' : '0 12px 28px rgba(49, 27, 146, 0.5)',
                          '&:hover': {
                            background: themeName === 'dsp' ? '#39FF14' : 'linear-gradient(120deg, #1e88e5 0%, #8e24aa 80%)',
                            boxShadow: themeName === 'dsp' ? '0 0 30px rgba(57, 255, 20, 0.8)' : '0 18px 36px rgba(142, 36, 170, 0.4)',
                            transform: 'translateY(-2px)',
                          },
                          '&:active': {
                            transform: 'translateY(0)',
                          },
                        }}
                      >
                        🎤 Play Recording
              </Button>
            </Box>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={<History sx={{ color: themeName === 'dsp' ? '#39FF14' : 'inherit' }} />}
            onClick={toggleHistory}
            sx={{
              borderRadius: '25px',
              px: 3,
              py: 1,
              border: palette.historyBorder,
              color: themeName === 'dsp' ? '#39FF14' : '#E3F2FD',
              background: palette.historyBg,
              backdropFilter: 'blur(14px)',
              '&:hover': {
                background: palette.historyHoverBg,
                border: palette.historyHoverBorder,
                transform: 'translateY(-2px)',
                boxShadow: palette.historyHoverShadow,
              },
              transition: 'all 0.3s ease-in-out',
            }}
          >
            Conversation History
          </Button>
      </Box>

      {showHistory && <ConversationHistory />}
    </Box>
  );
};

export default VoiceInterface;
