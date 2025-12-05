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
import ThemeSelector from './ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';

const INITIAL_VISUALIZER_STATE = {
  wavePoints: new Array(64).fill(0),
  amplitude: 0,
  frequency: 0,
  wavelength: 0,
};

// Theme is now managed via CSS variables and ThemeContext

const VoiceInterface = () => {
  const { theme, currentTheme } = useTheme();
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

  // Check if current theme is a "retro" style that needs special handling
  const isRetroTheme = theme === 'retro-90s';
  const isMatrixTheme = theme === 'ai-matrix';

  // WebSocket connection removed - using HTTP API instead
  useEffect(() => {
    console.log('Echo initialized - ready to process audio');
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

  const InsightCard = ({ icon, title, value, footer }) => {
    return (
      <Box
        sx={{
          p: 3,
          borderRadius: isRetroTheme ? 0 : 3,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          minHeight: 140,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {React.cloneElement(icon, { sx: { color: 'var(--primary)' } })}
          <Typography variant="subtitle2" sx={{ letterSpacing: 1, color: 'var(--foreground)' }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--primary)' }}>
          {value}
        </Typography>
        {footer && (
          <Typography variant="body2" sx={{ color: 'var(--muted-foreground)', mt: 1 }}>
            {footer}
          </Typography>
        )}
      </Box>
    );
  };

  const formatMs = (value) => (typeof value === 'number' ? `${value} ms` : '—');

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', position: 'relative', width: '100%' }}>
      {/* Theme Selector */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ThemeSelector />
      </Box>
      
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        align="center"
        sx={{
          mb: 2,
          color: 'var(--primary)',
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: 'uppercase',
          textShadow: isMatrixTheme ? '0 0 20px var(--primary)' : 'none',
        }}
      >
        {currentTheme?.icon || '🎭'} Echo
      </Typography>
      <Typography
        variant="body1"
        align="center"
        sx={{
          mb: 4,
          opacity: 0.9,
          fontSize: '1.1rem',
          lineHeight: 1.6,
          maxWidth: 520,
          mx: 'auto',
          color: 'var(--muted-foreground)',
        }}
      >
        Click "Start Echo" to begin recording. Speak clearly, then click "Stop Recording" to process your audio.
      </Typography>

      <Paper
        elevation={0}
        className="echo-card"
        sx={{
          p: 4,
          mb: 3,
          background: 'var(--card)',
          backdropFilter: isRetroTheme ? 'none' : 'blur(24px)',
          border: '1px solid var(--border)',
          borderRadius: isRetroTheme ? 0 : 3,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'var(--primary)',
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
              className="echo-button-primary"
              sx={{
                minWidth: 220,
                minHeight: 70,
                fontSize: '1.1rem',
                borderRadius: isRetroTheme ? 0 : '28px',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                boxShadow: '0 0 20px color-mix(in oklch, var(--primary) 40%, transparent)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: 'var(--primary)',
                  filter: 'brightness(1.1)',
                  boxShadow: '0 0 30px color-mix(in oklch, var(--primary) 60%, transparent)',
                  transform: 'translateY(-3px)',
                },
                '&:disabled': {
                  background: 'var(--muted)',
                  color: 'var(--muted-foreground)',
                },
              }}
            >
              Start Echo
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={<Stop />}
              onClick={stopListening}
              className="echo-button-primary"
              sx={{
                minWidth: 180,
                minHeight: 70,
                fontSize: '1.1rem',
                borderRadius: isRetroTheme ? 0 : '25px',
                background: 'var(--destructive)',
                color: 'var(--primary-foreground)',
                boxShadow: '0 0 20px color-mix(in oklch, var(--destructive) 40%, transparent)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: 'var(--destructive)',
                  filter: 'brightness(1.1)',
                  boxShadow: '0 0 30px color-mix(in oklch, var(--destructive) 60%, transparent)',
                  transform: 'translateY(-3px)',
                },
              }}
            >
              Stop Recording
            </Button>
          )}
        </Box>

        {isListening && (
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography
              variant="body1"
              align="center"
              gutterBottom
              sx={{
                fontSize: '1.1rem',
                fontWeight: 500,
                color: 'var(--primary)',
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
                  borderRadius: isRetroTheme ? 0 : 6,
                  backgroundColor: 'var(--muted)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: isRetroTheme ? 0 : 6,
                    background: 'var(--primary)',
                    boxShadow: '0 0 15px color-mix(in oklch, var(--primary) 60%, transparent)',
                  },
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: -25,
                  left: `${audioLevel * 100}%`,
                  transform: 'translateX(-50%)',
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
              borderRadius: isRetroTheme ? 0 : 2,
              background: 'var(--accent)',
              border: '1px solid var(--border)',
            }}
          >
            <CircularProgress
              size={50}
              sx={{
                color: 'var(--primary)',
                mb: 1,
              }}
            />
            <Typography
              variant="body1"
              sx={{
                color: 'var(--foreground)',
                fontWeight: 500,
                textAlign: 'center',
              }}
            >
              Processing your voice...
            </Typography>
            <Typography
              variant="body2"
              sx={{ textAlign: 'center', mt: 0.5, color: 'var(--muted-foreground)' }}
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
              borderRadius: isRetroTheme ? 0 : 2,
              background: 'color-mix(in oklch, var(--destructive) 10%, var(--card))',
              border: '1px solid var(--destructive)',
              color: 'var(--foreground)',
              '& .MuiAlert-icon': {
                color: 'var(--destructive)',
              },
            }}
          >
            ⚠️ {error}
          </Alert>
        )}
      </Paper>

      {llmMetadata && (
        <Card
          className="echo-card"
          sx={{
            mb: 3,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: isRetroTheme ? 0 : 3,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, 
              color: 'var(--foreground)',
            }}>
              <GraphicEq sx={{ color: 'var(--primary)' }} />
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
          className="echo-card"
          sx={{
            mb: 3,
            p: 3,
            borderRadius: isRetroTheme ? 0 : 3,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Typography variant="subtitle1" sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            color: 'var(--foreground)', 
            mb: 1 
          }}>
            <Psychology fontSize="small" sx={{ color: 'var(--primary)' }} />
            Chain of Thought
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'var(--muted-foreground)',
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
              className="echo-card"
              sx={{
                p: 3,
                borderRadius: isRetroTheme ? 0 : 3,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                height: '100%',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: 'var(--primary)', letterSpacing: 1 }}>
                STT • {pipelineInsights?.stt?.model || 'Whisper'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
                Device: {pipelineInsights?.stt?.device || 'cpu'} · Precision: {pipelineInsights?.stt?.compute_type || 'int8'}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1.5, color: 'var(--foreground)' }}
              >
                {pipelineInsights?.stt?.transcript || transcript || 'Awaiting speech input...'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper
              className="echo-card"
              sx={{
                p: 3,
                borderRadius: isRetroTheme ? 0 : 3,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                height: '100%',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: 'var(--primary)', letterSpacing: 1 }}>
                LLM • {llmMetadata?.model || pipelineInsights?.llm?.model || '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
                Tokens: {(llmMetadata?.token_usage?.total ?? pipelineInsights?.llm?.token_usage?.total ?? 0).toLocaleString()}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1.5, color: 'var(--foreground)' }}
              >
                {pipelineInsights?.llm?.answer || response || 'No response yet.'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper
              className="echo-card"
              sx={{
                p: 3,
                borderRadius: isRetroTheme ? 0 : 3,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                height: '100%',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: 'var(--primary)', letterSpacing: 1 }}>
                TTS • {pipelineInsights?.tts?.model || 'Piper'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
                Speed {pipelineInsights?.tts?.speed ?? 1.0} · Bytes {(pipelineInsights?.tts?.audio_bytes ?? 0).toLocaleString()}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1.5, color: 'var(--foreground)' }}
              >
                Voice synthesis ready. Characters rendered: {pipelineInsights?.tts?.character_count ?? 0}.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {(transcript || response) && (
        <Card
          className="echo-card voice-agent-card"
          sx={{
            mb: 3,
            background: 'var(--card)',
            backdropFilter: isRetroTheme ? 'none' : 'blur(28px)',
            border: '1px solid var(--border)',
            borderRadius: isRetroTheme ? 0 : 3,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'var(--foreground)' }}>
              Conversation
            </Typography>

            {/* Summary Section */}
            {summary && (
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  borderRadius: isRetroTheme ? 0 : 2,
                  background: 'var(--accent)',
                  border: '1px solid var(--border)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'var(--primary)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Summarize sx={{ mr: 1, fontSize: 20, color: 'var(--primary)' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--primary)' }}>
                    ✨ Summary
                  </Typography>
                  {isSummarizing && (
                    <CircularProgress
                      size={18}
                      sx={{ ml: 1, color: 'var(--primary)' }}
                    />
                  )}
                </Box>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'var(--muted-foreground)',
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                  }}
                >
                  {summary}
                </Typography>
              </Box>
            )}

            {/* Original Content Accordion */}
            <Accordion
              sx={{
                background: 'var(--accent)',
                backdropFilter: isRetroTheme ? 'none' : 'blur(10px)',
                border: '1px solid var(--border)',
                borderRadius: isRetroTheme ? '0 !important' : '12px !important',
                '&:before': {
                  display: 'none',
                },
                '&.Mui-expanded': {
                  background: 'var(--accent)',
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore sx={{ color: 'var(--foreground)' }} />}
                aria-controls="conversation-content"
                id="conversation-header"
              >
                <Typography variant="subtitle1" sx={{ color: 'var(--foreground)' }}>View Details</Typography>
                <Chip
                  label={`${transcript ? 'Transcript' : ''}${transcript && response ? ' + ' : ''}${response ? 'Response' : ''}`}
                  size="small"
                  sx={{ 
                    ml: 1,
                    backgroundColor: 'var(--secondary)',
                    color: 'var(--secondary-foreground)',
                    border: '1px solid var(--border)',
                  }}
                />
              </AccordionSummary>
              <AccordionDetails>
                {transcript && (
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        color: 'var(--primary)',
                        fontWeight: 600,
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      gutterBottom
                    >
                      <Mic sx={{ mr: 1, fontSize: 20, color: 'var(--primary)' }} />
                      You said:
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        p: 2,
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: isRetroTheme ? 0 : 2,
                        borderLeft: '4px solid var(--primary)',
                        lineHeight: 1.6,
                        color: 'var(--foreground)',
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
                        color: 'var(--primary)',
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
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: isRetroTheme ? 0 : 2,
                        borderLeft: '4px solid var(--primary)',
                        lineHeight: 1.6,
                        color: 'var(--foreground)',
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
                            playAudioResponse(audioData, response);
                          } else {
                            console.error('No audio data available');
                            speakWithWebSpeech(response);
                          }
                        }}
                        className="echo-button-primary"
                        sx={{
                          background: 'var(--primary)',
                          color: 'var(--primary-foreground)',
                          fontWeight: 600,
                          borderRadius: isRetroTheme ? 0 : '20px',
                          px: 3,
                          py: 1,
                          boxShadow: '0 0 15px color-mix(in oklch, var(--primary) 40%, transparent)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            background: 'var(--primary)',
                            filter: 'brightness(1.1)',
                            boxShadow: '0 0 25px color-mix(in oklch, var(--primary) 60%, transparent)',
                            transform: 'translateY(-2px)',
                          },
                          '&:disabled': {
                            background: 'var(--muted)',
                            color: 'var(--muted-foreground)',
                            boxShadow: 'none',
                          },
                        }}
                      >
                        🎵 Play Response
                      </Button>
                      <Button
                        startIcon={<Mic />}
                        variant="contained"
                        onClick={() => {
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
                          background: 'var(--secondary)',
                          color: 'var(--secondary-foreground)',
                          fontWeight: 600,
                          borderRadius: isRetroTheme ? 0 : '20px',
                          px: 3,
                          py: 1,
                          border: '1px solid var(--border)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            background: 'var(--accent)',
                            transform: 'translateY(-2px)',
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
          startIcon={<History sx={{ color: 'var(--foreground)' }} />}
          onClick={toggleHistory}
          sx={{
            borderRadius: isRetroTheme ? 0 : '25px',
            px: 3,
            py: 1,
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            background: 'var(--card)',
            backdropFilter: isRetroTheme ? 'none' : 'blur(14px)',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              background: 'var(--accent)',
              borderColor: 'var(--primary)',
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 20px color-mix(in oklch, var(--primary) 30%, transparent)',
            },
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
