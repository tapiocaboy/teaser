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
} from '@mui/material';
import {
  Mic,
  MicOff,
  PlayArrow,
  Stop,
  History,
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import AudioService from '../services/AudioService';
import ApiService from '../services/ApiService';
import ConversationHistory from './ConversationHistory';

interface Message {
  transcript: string;
  response: string;
  audio_data?: string;
  timestamp?: string;
}

const VoiceInterface: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioService = useRef(new AudioService());
  const apiService = useRef(new ApiService());

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = io(process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/voice');
    setSocket(ws);

    ws.on('connect', () => {
      console.log('WebSocket connected');
    });

    ws.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    ws.on('message', (data: Message) => {
      handleSocketMessage(data);
    });

    return () => {
      ws.disconnect();
    };
  }, []);

  const handleSocketMessage = (data: Message) => {
    if (data.transcript) {
      setTranscript(data.transcript);
    }
    if (data.response) {
      setResponse(data.response);
      setIsProcessing(false);
    }
    if (data.audio_data) {
      // Handle audio playback
      playAudioResponse(data.audio_data);
    }
  };

  const playAudioResponse = (audioData: string) => {
    try {
      const audioBytes = new Uint8Array(audioData.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
      const blob = new Blob([audioBytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error('Error playing audio:', err);
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

  const handleAudioRecorded = async (audioBlob: Blob) => {
    try {
      const result = await apiService.current.processAudio(audioBlob);
      setTranscript(result.transcript);
      setResponse(result.response);
      setIsProcessing(false);
    } catch (err) {
      setError('Failed to process audio');
      setIsProcessing(false);
    }
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Echo
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Button
            variant={isListening ? "contained" : "outlined"}
            color={isListening ? "error" : "primary"}
            size="large"
            startIcon={isListening ? <Mic /> : <MicOff />}
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            sx={{ minWidth: 200, minHeight: 60 }}
          >
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Button>
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

      {transcript && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              You said:
            </Typography>
            <Typography variant="body1">
              {transcript}
            </Typography>
          </CardContent>
        </Card>
      )}

      {response && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Assistant:
            </Typography>
            <Typography variant="body1">
              {response}
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                size="small"
                startIcon={<PlayArrow />}
                variant="outlined"
                disabled={true}
              >
                Play Response
              </Button>
            </Box>
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
