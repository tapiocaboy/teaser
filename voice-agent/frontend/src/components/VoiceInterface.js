import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Mic,
  PlayArrow,
  Stop,
  History,
  ExpandMore,
  Summarize,
} from '@mui/icons-material';
// Using native WebSocket instead of Socket.IO
import AudioService from '../services/AudioService';
import ApiService from '../services/ApiService';
import ConversationHistory from './ConversationHistory';

const VoiceInterface = () => {
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

  const audioService = useRef(new AudioService());
  const apiService = useRef(new ApiService());

  // WebSocket connection removed - using HTTP API instead
  useEffect(() => {
    console.log('Voice Agent initialized - ready to process audio');
  }, []);


  const playAudioResponse = async (audioData: string) => {
    try {
      console.log('=== AUDIO PLAYBACK START ===');
      console.log('Audio data exists:', !!audioData);
      console.log('Audio data length:', audioData?.length);

      if (!audioData) {
        alert('No audio data available to play');
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
      alert('Error playing audio: ' + err.message);
    }
  };

  const startListening = async () => {
    try {
      setError('');
      setIsListening(true);
      setIsProcessing(true);
      setTranscript('');
      setResponse('');

      await audioService.current.startRecording((audioBlob) => {
        handleAudioRecorded(audioBlob);
      }, (level) => {
        setAudioLevel(level);
      });
    } catch (err) {
      setError('Failed to start recording');
      setIsListening(false);
      setIsProcessing(false);
    }
  };

  const stopListening = async () => {
    try {
      setIsListening(false);
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

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        🤖 AI Voice Agent
      </Typography>
      <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
        Click "Start Voice Agent" to begin recording. Speak clearly, then click "Stop Recording" to process your audio.
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
          {!isListening ? (
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Mic />}
              onClick={startListening}
              disabled={isProcessing}
              sx={{ minWidth: 200, minHeight: 60 }}
            >
              Start Voice Agent
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<Mic />}
                disabled
                sx={{ minWidth: 150, minHeight: 60 }}
              >
                Listening...
              </Button>
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={<Stop />}
                onClick={stopListening}
                sx={{ minWidth: 150, minHeight: 60 }}
              >
                Stop Recording
              </Button>
            </>
          )}
        </Box>

        {isListening && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
              Listening... Speak now
            </Typography>
            <LinearProgress
              variant="determinate"
              value={audioLevel * 100}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {isProcessing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <CircularProgress size={40} />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Processing...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {(transcript || response) && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conversation
            </Typography>

            {/* Summary Section */}
            {summary && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Summarize sx={{ mr: 1, fontSize: 18 }} />
                  <Typography variant="subtitle2" color="primary">
                    Summary
                  </Typography>
                  {isSummarizing && <CircularProgress size={16} sx={{ ml: 1 }} />}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  {summary}
                </Typography>
                <Divider sx={{ my: 2 }} />
              </Box>
            )}

            {/* Original Content Accordion */}
            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMore />}
                aria-controls="conversation-content"
                id="conversation-header"
              >
                <Typography variant="subtitle1">View Details</Typography>
                <Chip
                  label={`${transcript ? 'Transcript' : ''}${transcript && response ? ' + ' : ''}${response ? 'Response' : ''}`}
                  size="small"
                  sx={{ ml: 1 }}
                />
              </AccordionSummary>
              <AccordionDetails>
                {transcript && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      You said:
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                      {transcript}
                    </Typography>
                  </Box>
                )}

                {response && (
                  <Box>
                    <Typography variant="subtitle2" color="secondary" gutterBottom>
                      Assistant Response:
                    </Typography>
                    <Typography variant="body1" sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                      {response}
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={<PlayArrow />}
                        variant="outlined"
                        onClick={() => {
                          console.log('=== PLAY RESPONSE BUTTON CLICKED ===');
                          console.log('audioData exists:', !!audioData);
                          console.log('audioData length:', audioData?.length);
                          console.log('response text:', response);

                          if (audioData && audioData.length > 0) {
                            const preview = response.substring(0, 100) + (response.length > 100 ? '...' : '');
                            console.log('About to play audio for text:', preview);

                            // Don't show alert, just play directly
                            playAudioResponse(audioData);
                          } else {
                            console.error('No audio data available');
                            alert('No audio data available to play');
                          }
                        }}
                      >
                        Play Response
                      </Button>
                      <Button
                        size="small"
                        startIcon={<Mic />}
                        variant="outlined"
                        color="secondary"
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
                      >
                        Play Recording
                      </Button>
                    </Box>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <IconButton
          color="primary"
          onClick={toggleHistory}
          size="large"
        >
          <History />
        </IconButton>
      </Box>

      {showHistory && <ConversationHistory />}
    </Box>
  );
};

export default VoiceInterface;
