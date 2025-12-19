import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Mic,
  Stop,
  CheckCircle,
  History,
  Logout,
  PlayArrow,
  Today,
} from '@mui/icons-material';
import AudioService from '../services/AudioService';
import ConstructionApiService from '../services/ConstructionApi';

const WorkerInterface = ({ user, onLogout }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateHistory, setUpdateHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const audioService = useRef(new AudioService());
  const api = useRef(new ConstructionApiService());

  useEffect(() => {
    loadUpdateHistory();
  }, [user]);

  const loadUpdateHistory = async () => {
    if (!user?.id) return;
    try {
      const result = await api.current.getWorkerUpdates(user.id, 7);
      setUpdateHistory(result.updates || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const startRecording = async () => {
    setError('');
    setSuccess('');
    setIsRecording(true);

    try {
      await audioService.current.startRecording(
        handleRecordingComplete,
        (level) => setAudioLevel(level),
        null
      );
    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setAudioLevel(0);
    try {
      await audioService.current.stopRecording();
    } catch (err) {
      setError('Failed to stop recording.');
    }
  };

  const handleRecordingComplete = async (audioBlob) => {
    if (!audioBlob || audioBlob.size < 100) {
      setError('Recording too short. Please speak for longer.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const result = await api.current.submitDailyUpdate(user.id, audioBlob);

      if (result.success) {
        setLastUpdate({
          original: result.original_message,
          summary: result.summary,
          audio: result.summary_audio,
        });
        setSuccess('Daily update submitted successfully!');
        loadUpdateHistory();
      } else {
        setError('Failed to process update. Please try again.');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = (audioBase64) => {
    if (!audioBase64) return;
    api.current.playAudioFromBase64(audioBase64);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: { xs: 1.5, sm: 2 } }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: { xs: 2, sm: 3 },
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 500, color: '#c9d1d9', fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
            Voice Update
          </Typography>
          <Typography sx={{ color: '#484f58', mt: 0.25, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
            {user?.name} • {user?.role || 'Operator'}
          </Typography>
          {user?.site_location && (
            <Chip
              label={user.site_location}
              size="small"
              sx={{ mt: 0.75, fontSize: '0.65rem', height: 22, background: '#21262d', color: '#8b949e' }}
            />
          )}
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Logout sx={{ fontSize: 14 }} />}
          onClick={onLogout}
          sx={{
            borderColor: '#21262d',
            color: '#8b949e',
            fontSize: '0.7rem',
            py: 0.5,
            px: 1.5,
          }}
        >
          Logout
        </Button>
      </Box>

      {/* Recording Card */}
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5 },
          mb: 1.5,
          background: '#0d1117',
          border: '1px solid #21262d',
          borderRadius: '2px',
          textAlign: 'center',
        }}
      >
        <Typography
          sx={{ mb: 1.5, color: '#c9d1d9', fontWeight: 500, fontSize: { xs: '0.75rem', sm: '0.8rem' } }}
        >
          {isRecording
            ? '● Recording...'
            : isProcessing
            ? '◐ Processing...'
            : 'Record Update'}
        </Typography>

        {isRecording && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={audioLevel * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: '#21262d',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: '#3b82f6',
                },
              }}
            />
            <Typography
              sx={{ mt: 1.5, color: '#484f58', fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
            >
              Speak clearly about your work today.
            </Typography>
          </Box>
        )}

        {isProcessing && (
          <Box sx={{ mb: 2 }}>
            <CircularProgress size={28} sx={{ color: '#3b82f6' }} />
            <Typography
              sx={{ mt: 1.5, color: '#484f58', fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
            >
              Processing your update...
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
          {!isRecording ? (
            <Button
              variant="contained"
              size="medium"
              startIcon={<Mic sx={{ fontSize: { xs: 16, sm: 18 } }} />}
              onClick={startRecording}
              disabled={isProcessing}
              sx={{
                px: { xs: 3, sm: 4 },
                py: { xs: 1, sm: 1.25 },
                fontSize: { xs: '0.75rem', sm: '0.8rem' },
                background: '#3b82f6',
                color: '#ffffff',
                '&:hover': {
                  background: '#2563eb',
                },
              }}
            >
              Start Recording
            </Button>
          ) : (
            <Button
              variant="contained"
              size="medium"
              startIcon={<Stop sx={{ fontSize: { xs: 16, sm: 18 } }} />}
              onClick={stopRecording}
              sx={{
                px: { xs: 3, sm: 4 },
                py: { xs: 1, sm: 1.25 },
                fontSize: { xs: '0.75rem', sm: '0.8rem' },
                background: '#f85149',
                color: '#ffffff',
                '&:hover': {
                  background: '#da3633',
                },
              }}
            >
              Stop Recording
            </Button>
          )}
        </Box>
      </Paper>

      {/* Success/Error Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
          <CheckCircle sx={{ mr: 0.5, fontSize: 16 }} />
          {success}
        </Alert>
      )}

      {/* Last Update Result */}
      {lastUpdate && (
        <Card
          sx={{
            mb: 2,
            background: '#0d1117',
            border: '1px solid #21262d',
            borderRadius: '2px',
          }}
        >
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography
              sx={{ mb: 1.5, color: '#3fb950', fontWeight: 500, fontSize: { xs: '0.75rem', sm: '0.8rem' } }}
            >
              ✓ Your Update
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography
                sx={{ color: '#484f58', mb: 0.5, fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
              >
                Original:
              </Typography>
              <Typography
                sx={{
                  p: { xs: 1, sm: 1.5 },
                  background: '#161b22',
                  borderRadius: '2px',
                  color: '#c9d1d9',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                }}
              >
                {lastUpdate.original}
              </Typography>
            </Box>

            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 0.5,
                }}
              >
                <Typography
                  sx={{ color: '#484f58', fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
                >
                  Summary:
                </Typography>
                {lastUpdate.audio && (
                  <IconButton
                    size="small"
                    onClick={() => playAudio(lastUpdate.audio)}
                    sx={{ color: '#3b82f6', p: 0.5 }}
                  >
                    <PlayArrow sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
              <Typography
                sx={{
                  p: { xs: 1, sm: 1.5 },
                  background: '#161b22',
                  borderRadius: '2px',
                  color: '#c9d1d9',
                  borderLeft: '2px solid #3b82f6',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                }}
              >
                {lastUpdate.summary}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* History Toggle */}
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={showHistory ? <Today sx={{ fontSize: 14 }} /> : <History sx={{ fontSize: 14 }} />}
          onClick={() => setShowHistory(!showHistory)}
          sx={{
            borderColor: '#21262d',
            color: '#8b949e',
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
          }}
        >
          {showHistory ? 'Hide History' : 'View History'}
        </Button>
      </Box>

      {/* Update History */}
      {showHistory && (
        <Card
          sx={{
            background: '#0d1117',
            border: '1px solid #21262d',
            borderRadius: '2px',
          }}
        >
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography
              sx={{ mb: 1.5, color: '#c9d1d9', fontWeight: 500, fontSize: { xs: '0.75rem', sm: '0.8rem' } }}
            >
              📅 Recent Updates
            </Typography>

            {updateHistory.length === 0 ? (
              <Typography sx={{ color: '#484f58', textAlign: 'center', py: 2, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                No updates yet. Record your first update above!
              </Typography>
            ) : (
              <List sx={{ p: 0 }}>
                {updateHistory.map((update, index) => (
                  <React.Fragment key={update.id}>
                    {index > 0 && <Divider sx={{ borderColor: '#21262d' }} />}
                    <ListItem
                      sx={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        py: 1.5,
                        px: 0,
                      }}
                    >
                      <Chip
                        label={formatDate(update.update_date)}
                        size="small"
                        sx={{
                          background: '#21262d',
                          color: '#8b949e',
                          fontSize: '0.6rem',
                          height: 20,
                          mb: 0.75,
                        }}
                      />
                      <ListItemText
                        primary={update.summary || 'No summary available'}
                        secondary={update.original_message?.substring(0, 80) + '...'}
                        primaryTypographyProps={{
                          sx: { color: '#c9d1d9', fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.75rem' } },
                        }}
                        secondaryTypographyProps={{
                          sx: { color: '#484f58', mt: 0.5, fontSize: { xs: '0.65rem', sm: '0.7rem' } },
                        }}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default WorkerInterface;

