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
  Shield,
  FiberManualRecord,
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
      setError('Failed to access secure audio channel. Check permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setAudioLevel(0);
    try {
      await audioService.current.stopRecording();
    } catch (err) {
      setError('Transmission interrupted.');
    }
  };

  const handleRecordingComplete = async (audioBlob) => {
    if (!audioBlob || audioBlob.size < 100) {
      setError('Transmission too short. Please provide detailed report.');
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
        setSuccess('Intel report transmitted successfully!');
        loadUpdateHistory();
      } else {
        setError('Failed to process transmission. Please retry.');
      }
    } catch (err) {
      setError(`Transmission Error: ${err.message}`);
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Shield sx={{ fontSize: 18, color: '#dc2626' }} />
            <Typography sx={{ 
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 600, 
              color: '#e2e8f0', 
              fontSize: { xs: '0.85rem', sm: '0.95rem' },
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              Field Report
            </Typography>
          </Box>
          <Typography sx={{ 
            color: '#64748b', 
            mt: 0.25, 
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            Agent: {user?.name} • {user?.role || 'Field Agent'}
          </Typography>
          {user?.site_location && (
            <Chip
              icon={<FiberManualRecord sx={{ fontSize: 8, color: '#16a34a !important' }} />}
              label={user.site_location}
              size="small"
              sx={{ 
                mt: 0.75, 
                fontSize: '0.65rem', 
                height: 24, 
                background: 'rgba(30, 58, 95, 0.5)', 
                color: '#93c5fd',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                fontFamily: '"JetBrains Mono", monospace',
                '& .MuiChip-icon': { ml: 0.5 },
              }}
            />
          )}
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Logout sx={{ fontSize: 14 }} />}
          onClick={onLogout}
          sx={{
            borderColor: '#1e3a5f',
            color: '#64748b',
            fontSize: '0.7rem',
            py: 0.5,
            px: 1.5,
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: '0.05em',
            '&:hover': {
              borderColor: '#dc2626',
              color: '#fca5a5',
              background: 'rgba(220, 38, 38, 0.1)',
            },
          }}
        >
          Logout
        </Button>
      </Box>

      {/* Recording Card */}
      <Paper
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 2,
          background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.3) 100%)',
          border: '1px solid #1e3a5f',
          borderRadius: '3px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '3px',
            height: '100%',
            background: isRecording 
              ? '#dc2626' 
              : isProcessing 
                ? '#2563eb' 
                : 'linear-gradient(180deg, #dc2626, #991b1b)',
          },
        }}
      >
        <Typography
          sx={{ 
            mb: 2, 
            color: isRecording ? '#fca5a5' : isProcessing ? '#93c5fd' : '#e2e8f0', 
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 600, 
            fontSize: { xs: '0.8rem', sm: '0.85rem' },
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          {isRecording ? (
            <>
              <FiberManualRecord sx={{ fontSize: 12, color: '#dc2626', animation: 'pulse 1s infinite' }} />
              Recording Transmission...
            </>
          ) : isProcessing ? (
            <>
              <CircularProgress size={12} sx={{ color: '#2563eb' }} />
              Processing Intel...
            </>
          ) : (
            'Transmit Intel Report'
          )}
        </Typography>

        {isRecording && (
          <Box sx={{ mb: 2.5 }}>
            <LinearProgress
              variant="determinate"
              value={audioLevel * 100}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(30, 58, 95, 0.5)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  background: 'linear-gradient(90deg, #dc2626, #f87171)',
                },
              }}
            />
            <Typography
              sx={{ 
                mt: 1.5, 
                color: '#64748b', 
                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              Provide detailed situation report. Include location, observations, and status.
            </Typography>
          </Box>
        )}

        {isProcessing && (
          <Box sx={{ mb: 2.5 }}>
            <CircularProgress size={32} sx={{ color: '#2563eb' }} />
            <Typography
              sx={{ 
                mt: 1.5, 
                color: '#64748b', 
                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              Encrypting and transmitting to Command Center...
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          {!isRecording ? (
            <Button
              variant="contained"
              size="medium"
              startIcon={<Mic sx={{ fontSize: { xs: 18, sm: 20 } }} />}
              onClick={startRecording}
              disabled={isProcessing}
              sx={{
                px: { xs: 4, sm: 5 },
                py: { xs: 1.25, sm: 1.5 },
                fontSize: { xs: '0.75rem', sm: '0.8rem' },
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: '0.08em',
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  boxShadow: '0 0 25px rgba(220, 38, 38, 0.4)',
                },
              }}
            >
              Begin Transmission
            </Button>
          ) : (
            <Button
              variant="contained"
              size="medium"
              startIcon={<Stop sx={{ fontSize: { xs: 18, sm: 20 } }} />}
              onClick={stopRecording}
              sx={{
                px: { xs: 4, sm: 5 },
                py: { xs: 1.25, sm: 1.5 },
                fontSize: { xs: '0.75rem', sm: '0.8rem' },
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: '0.08em',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                animation: 'pulse 2s infinite',
                '&:hover': {
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                },
              }}
            >
              End Transmission
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
            background: 'linear-gradient(135deg, #0f172a 0%, rgba(22, 163, 74, 0.1) 100%)',
            border: '1px solid rgba(22, 163, 74, 0.3)',
            borderRadius: '3px',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '3px',
              height: '100%',
              background: '#16a34a',
            },
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography
              sx={{ 
                mb: 1.5, 
                color: '#86efac', 
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 600, 
                fontSize: { xs: '0.75rem', sm: '0.8rem' },
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              ✓ Intel Report Logged
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography
                sx={{ 
                  color: '#64748b', 
                  mb: 0.5, 
                  fontSize: { xs: '0.65rem', sm: '0.7rem' },
                  fontFamily: '"JetBrains Mono", monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Original Transmission:
              </Typography>
              <Typography
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  background: 'rgba(15, 23, 42, 0.8)',
                  borderRadius: '2px',
                  color: '#e2e8f0',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  fontFamily: '"JetBrains Mono", monospace',
                  border: '1px solid #1e3a5f',
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
                  sx={{ 
                    color: '#64748b', 
                    fontSize: { xs: '0.65rem', sm: '0.7rem' },
                    fontFamily: '"JetBrains Mono", monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Intelligence Summary:
                </Typography>
                {lastUpdate.audio && (
                  <IconButton
                    size="small"
                    onClick={() => playAudio(lastUpdate.audio)}
                    sx={{ color: '#16a34a', p: 0.5 }}
                  >
                    <PlayArrow sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </Box>
              <Typography
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  background: 'rgba(15, 23, 42, 0.8)',
                  borderRadius: '2px',
                  color: '#e2e8f0',
                  borderLeft: '3px solid #16a34a',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  fontFamily: '"JetBrains Mono", monospace',
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
            borderColor: '#1e3a5f',
            color: '#64748b',
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: '0.05em',
            '&:hover': {
              borderColor: '#2563eb',
              background: 'rgba(37, 99, 235, 0.1)',
            },
          }}
        >
          {showHistory ? 'Hide Archives' : 'View Intel Archives'}
        </Button>
      </Box>

      {/* Update History */}
      {showHistory && (
        <Card
          sx={{
            background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.3) 100%)',
            border: '1px solid #1e3a5f',
            borderRadius: '3px',
          }}
        >
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography
              sx={{ 
                mb: 1.5, 
                color: '#e2e8f0', 
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 600, 
                fontSize: { xs: '0.75rem', sm: '0.8rem' },
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              📁 Intel Archives
            </Typography>

            {updateHistory.length === 0 ? (
              <Typography sx={{ 
                color: '#64748b', 
                textAlign: 'center', 
                py: 3, 
                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                No archived reports. Begin transmission above.
              </Typography>
            ) : (
              <List sx={{ p: 0 }}>
                {updateHistory.map((update, index) => (
                  <React.Fragment key={update.id}>
                    {index > 0 && <Divider sx={{ borderColor: '#1e3a5f' }} />}
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
                          background: 'rgba(30, 58, 95, 0.5)',
                          color: '#93c5fd',
                          fontSize: '0.6rem',
                          height: 20,
                          mb: 0.75,
                          fontFamily: '"JetBrains Mono", monospace',
                          border: '1px solid rgba(37, 99, 235, 0.2)',
                        }}
                      />
                      <ListItemText
                        primary={update.summary || 'No summary available'}
                        secondary={update.original_message?.substring(0, 80) + '...'}
                        primaryTypographyProps={{
                          sx: { 
                            color: '#e2e8f0', 
                            fontWeight: 500, 
                            fontSize: { xs: '0.7rem', sm: '0.75rem' },
                            fontFamily: '"JetBrains Mono", monospace',
                          },
                        }}
                        secondaryTypographyProps={{
                          sx: { 
                            color: '#64748b', 
                            mt: 0.5, 
                            fontSize: { xs: '0.65rem', sm: '0.7rem' },
                            fontFamily: '"JetBrains Mono", monospace',
                          },
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
