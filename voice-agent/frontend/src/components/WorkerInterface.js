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
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
            👷 Daily Update
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--muted-foreground)', mt: 0.5 }}>
            Welcome, {user?.name} • {user?.role || 'Site Worker'}
          </Typography>
          {user?.site_location && (
            <Chip
              label={user.site_location}
              size="small"
              sx={{ mt: 1, background: 'var(--accent)', color: 'var(--foreground)' }}
            />
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<Logout />}
          onClick={onLogout}
          sx={{
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          Logout
        </Button>
      </Box>

      {/* Recording Card */}
      <Paper
        sx={{
          p: 4,
          mb: 3,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, color: 'var(--foreground)', fontWeight: 600 }}
        >
          {isRecording
            ? '🎤 Recording your update...'
            : isProcessing
            ? '⏳ Processing...'
            : '📢 Record Your Daily Update'}
        </Typography>

        {isRecording && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress
              variant="determinate"
              value={audioLevel * 100}
              sx={{
                height: 12,
                borderRadius: 6,
                backgroundColor: 'var(--muted)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 6,
                  background: 'var(--primary)',
                },
              }}
            />
            <Typography
              variant="body2"
              sx={{ mt: 2, color: 'var(--muted-foreground)' }}
            >
              Speak clearly about your work today: tasks completed, materials used,
              issues encountered, and any safety observations.
            </Typography>
          </Box>
        )}

        {isProcessing && (
          <Box sx={{ mb: 3 }}>
            <CircularProgress sx={{ color: 'var(--primary)' }} />
            <Typography
              variant="body2"
              sx={{ mt: 2, color: 'var(--muted-foreground)' }}
            >
              Transcribing and summarizing your update...
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          {!isRecording ? (
            <Button
              variant="contained"
              size="large"
              startIcon={<Mic />}
              onClick={startRecording}
              disabled={isProcessing}
              sx={{
                px: 6,
                py: 2,
                fontSize: '1.1rem',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                boxShadow: '0 0 30px color-mix(in oklch, var(--primary) 30%, transparent)',
                '&:hover': {
                  background: 'var(--primary)',
                  filter: 'brightness(1.1)',
                },
              }}
            >
              Start Recording
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={<Stop />}
              onClick={stopRecording}
              sx={{
                px: 6,
                py: 2,
                fontSize: '1.1rem',
                background: 'var(--destructive)',
                color: 'white',
                boxShadow: '0 0 30px color-mix(in oklch, var(--destructive) 30%, transparent)',
                '&:hover': {
                  background: 'var(--destructive)',
                  filter: 'brightness(1.1)',
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
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
          <CheckCircle sx={{ mr: 1 }} />
          {success}
        </Alert>
      )}

      {/* Last Update Result */}
      {lastUpdate && (
        <Card
          sx={{
            mb: 3,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 3,
          }}
        >
          <CardContent>
            <Typography
              variant="h6"
              sx={{ mb: 2, color: 'var(--primary)', fontWeight: 600 }}
            >
              ✅ Your Update
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle2"
                sx={{ color: 'var(--muted-foreground)', mb: 1 }}
              >
                Original Recording:
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  p: 2,
                  background: 'var(--accent)',
                  borderRadius: 2,
                  color: 'var(--foreground)',
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
                  mb: 1,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ color: 'var(--muted-foreground)' }}
                >
                  Summary (for managers):
                </Typography>
                {lastUpdate.audio && (
                  <IconButton
                    size="small"
                    onClick={() => playAudio(lastUpdate.audio)}
                    sx={{ color: 'var(--primary)' }}
                  >
                    <PlayArrow />
                  </IconButton>
                )}
              </Box>
              <Typography
                variant="body1"
                sx={{
                  p: 2,
                  background: 'var(--accent)',
                  borderRadius: 2,
                  color: 'var(--foreground)',
                  borderLeft: '4px solid var(--primary)',
                }}
              >
                {lastUpdate.summary}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* History Toggle */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={showHistory ? <Today /> : <History />}
          onClick={() => setShowHistory(!showHistory)}
          sx={{
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          {showHistory ? 'Hide History' : 'View Update History'}
        </Button>
      </Box>

      {/* Update History */}
      {showHistory && (
        <Card
          sx={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 3,
          }}
        >
          <CardContent>
            <Typography
              variant="h6"
              sx={{ mb: 2, color: 'var(--foreground)', fontWeight: 600 }}
            >
              📅 Recent Updates
            </Typography>

            {updateHistory.length === 0 ? (
              <Typography sx={{ color: 'var(--muted-foreground)', textAlign: 'center', py: 3 }}>
                No updates yet. Record your first update above!
              </Typography>
            ) : (
              <List>
                {updateHistory.map((update, index) => (
                  <React.Fragment key={update.id}>
                    {index > 0 && <Divider sx={{ borderColor: 'var(--border)' }} />}
                    <ListItem
                      sx={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        py: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          width: '100%',
                          mb: 1,
                        }}
                      >
                        <Chip
                          label={formatDate(update.update_date)}
                          size="small"
                          sx={{
                            background: 'var(--accent)',
                            color: 'var(--foreground)',
                          }}
                        />
                      </Box>
                      <ListItemText
                        primary={update.summary || 'No summary available'}
                        secondary={`Full message: ${update.original_message?.substring(0, 100)}...`}
                        primaryTypographyProps={{
                          sx: { color: 'var(--foreground)', fontWeight: 500 },
                        }}
                        secondaryTypographyProps={{
                          sx: { color: 'var(--muted-foreground)', mt: 0.5 },
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

