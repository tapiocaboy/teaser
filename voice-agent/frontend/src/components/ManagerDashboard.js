import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  CircularProgress,
  LinearProgress,
  Alert,
  IconButton,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Dashboard,
  Logout,
  PlayArrow,
  Mic,
  Stop,
  Send,
  Person,
  Group,
  Summarize,
  QuestionAnswer,
  ExpandMore,
  Today,
  CalendarMonth,
  Refresh,
  Security,
  Shield,
  FiberManualRecord,
  Radar,
} from '@mui/icons-material';
import AudioService from '../services/AudioService';
import ConstructionApiService from '../services/ConstructionApi';

const ManagerDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [workers, setWorkers] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayUpdates, setTodayUpdates] = useState([]);
  const [aggregatedSummary, setAggregatedSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Q&A State
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [question, setQuestion] = useState('');
  const [isRecordingQuestion, setIsRecordingQuestion] = useState(false);
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryType, setQueryType] = useState('single');
  const [audioLevel, setAudioLevel] = useState(0);

  const audioService = useRef(new AudioService());
  const api = useRef(new ConstructionApiService());

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSite || selectedDate) {
      loadUpdates();
    }
  }, [selectedSite, selectedDate]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [workersResult, sitesResult] = await Promise.all([
        api.current.getManagerWorkersList(),
        api.current.getSites(),
      ]);
      setWorkers(workersResult.workers || []);
      setSites(sitesResult.sites || []);
    } catch (err) {
      setError('Failed to load operational data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUpdates = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.current.getUpdatesByDate(selectedDate, selectedSite || null);
      setTodayUpdates(result.updates || []);
    } catch (err) {
      setError('Failed to retrieve intel reports');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAggregatedSummary = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.current.getAggregatedSummary(
        selectedDate,
        selectedSite || null
      );
      setAggregatedSummary(result);
    } catch (err) {
      setError('Failed to generate intelligence briefing');
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (audioBase64) => {
    if (!audioBase64) {
      // Fallback to Web Speech
      if (aggregatedSummary?.summary) {
        const utterance = new SpeechSynthesisUtterance(aggregatedSummary.summary);
        window.speechSynthesis.speak(utterance);
      }
      return;
    }
    api.current.playAudioFromBase64(audioBase64);
  };

  const handleSubmitTextQuestion = async () => {
    if (!question.trim()) {
      setError('Please enter an intelligence query');
      return;
    }

    setIsProcessingQuery(true);
    setError('');
    setQueryResult(null);

    try {
      let result;
      if (queryType === 'single' && selectedWorker) {
        result = await api.current.querySingleWorker(
          user.id,
          selectedWorker,
          question
        );
      } else if (queryType === 'multiple' && selectedWorkers.length > 0) {
        result = await api.current.queryMultipleWorkers(
          user.id,
          selectedWorkers,
          question
        );
      } else {
        setError('Please select agent(s) to query');
        setIsProcessingQuery(false);
        return;
      }
      setQueryResult(result);
    } catch (err) {
      setError(`Query failed: ${err.message}`);
    } finally {
      setIsProcessingQuery(false);
    }
  };

  const startVoiceQuestion = async () => {
    setError('');
    setIsRecordingQuestion(true);

    try {
      await audioService.current.startRecording(
        handleVoiceQuestionComplete,
        (level) => setAudioLevel(level),
        null
      );
    } catch (err) {
      setError('Failed to access secure audio channel');
      setIsRecordingQuestion(false);
    }
  };

  const stopVoiceQuestion = async () => {
    setIsRecordingQuestion(false);
    setAudioLevel(0);
    try {
      await audioService.current.stopRecording();
    } catch (err) {
      setError('Transmission interrupted');
    }
  };

  const handleVoiceQuestionComplete = async (audioBlob) => {
    if (!audioBlob || audioBlob.size < 100) {
      setError('Recording too short');
      return;
    }

    setIsProcessingQuery(true);
    setError('');
    setQueryResult(null);

    try {
      const result = await api.current.queryWithVoice(
        user.id,
        audioBlob,
        queryType === 'single' ? selectedWorker : null,
        queryType === 'multiple' ? selectedWorkers : null
      );
      setQueryResult(result);
      setQuestion(result.transcribed_question || '');
    } catch (err) {
      setError(`Query failed: ${err.message}`);
    } finally {
      setIsProcessingQuery(false);
    }
  };

  const toggleWorkerSelection = (workerId) => {
    setSelectedWorkers((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    );
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
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1.5, sm: 2 } }}>
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
            <Security sx={{ fontSize: 20, color: '#2563eb' }} />
            <Typography sx={{ 
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 600, 
              color: '#e2e8f0', 
              fontSize: { xs: '0.9rem', sm: '1rem' },
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Command Center
            </Typography>
            <Chip
              size="small"
              icon={<FiberManualRecord sx={{ fontSize: '8px !important', color: '#16a34a !important' }} />}
              label="ONLINE"
              sx={{
                ml: 1,
                height: 20,
                background: 'rgba(22, 163, 74, 0.15)',
                border: '1px solid rgba(22, 163, 74, 0.3)',
                color: '#86efac',
                fontSize: '0.6rem',
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: '0.1em',
              }}
            />
          </Box>
          <Typography sx={{ 
            color: '#64748b', 
            mt: 0.25, 
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            Commander: {user?.name}
          </Typography>
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

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: { xs: '0.7rem', sm: '0.75rem' } }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, v) => setActiveTab(v)}
        variant="fullWidth"
        sx={{
          mb: { xs: 2, sm: 2.5 },
          minHeight: { xs: 44, sm: 52 },
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '3px',
          border: '1px solid #1e3a5f',
          '& .MuiTab-root': {
            color: '#64748b',
            fontSize: { xs: '0.7rem', sm: '0.8rem' },
            minHeight: { xs: 44, sm: 52 },
            py: { xs: 0.5, sm: 1 },
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: '0.08em',
            '&.Mui-selected': {
              color: '#e2e8f0',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#dc2626',
            height: 3,
          },
        }}
      >
        <Tab icon={<Radar sx={{ fontSize: { xs: 18, sm: 20 } }} />} label="Intel Briefing" iconPosition="start" />
        <Tab icon={<QuestionAnswer sx={{ fontSize: { xs: 18, sm: 20 } }} />} label="Query Agents" iconPosition="start" />
      </Tabs>

      {/* Tab 0: Intel Briefing */}
      {activeTab === 0 && (
        <Box>
          {/* Filters */}
          <Paper
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: { xs: 2, sm: 2.5 },
              background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.3) 100%)',
              border: '1px solid #1e3a5f',
              borderRadius: '3px',
            }}
          >
            <Grid container spacing={{ xs: 1.5, sm: 2 }} alignItems="center">
              <Grid item xs={6} sm={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="Operation Date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  sx={{ '& .MuiInputBase-input': { fontSize: { xs: '0.7rem', sm: '0.8rem' } } }}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem' } }}>Sector</InputLabel>
                  <Select
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    label="Sector"
                    sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem' } }}
                  >
                    <MenuItem value="" sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem' } }}>All Sectors</MenuItem>
                    {sites.map((site) => (
                      <MenuItem key={site} value={site} sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem' } }}>
                        {site}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Refresh sx={{ fontSize: 14 }} />}
                    onClick={loadUpdates}
                    sx={{ 
                      flex: 1, 
                      fontSize: { xs: '0.65rem', sm: '0.7rem' },
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Summarize sx={{ fontSize: 14 }} />}
                    onClick={loadAggregatedSummary}
                    disabled={isLoading}
                    sx={{
                      flex: 1,
                      fontSize: { xs: '0.65rem', sm: '0.7rem' },
                      fontFamily: '"JetBrains Mono", monospace',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                      '&:hover': { 
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)',
                      },
                    }}
                  >
                    Generate Briefing
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Aggregated Summary */}
          {aggregatedSummary && (
            <Card
              sx={{
                mb: { xs: 2, sm: 2.5 },
                background: 'linear-gradient(135deg, #0f172a 0%, rgba(37, 99, 235, 0.15) 100%)',
                border: '1px solid #2563eb',
                borderRadius: '3px',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '3px',
                  height: '100%',
                  background: '#2563eb',
                },
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography sx={{ 
                      color: '#93c5fd', 
                      fontFamily: '"JetBrains Mono", monospace',
                      fontWeight: 600, 
                      fontSize: { xs: '0.8rem', sm: '0.85rem' },
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}>
                      Intelligence Briefing
                    </Typography>
                    <Typography sx={{ 
                      color: '#64748b', 
                      fontSize: '0.65rem',
                      fontFamily: '"JetBrains Mono", monospace',
                      mt: 0.5,
                    }}>
                      {formatDate(aggregatedSummary.date)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`${aggregatedSummary.update_count} REPORTS`}
                      size="small"
                      sx={{ 
                        background: 'rgba(30, 58, 95, 0.5)', 
                        color: '#93c5fd', 
                        fontSize: '0.6rem', 
                        height: 22,
                        fontFamily: '"JetBrains Mono", monospace',
                        border: '1px solid rgba(37, 99, 235, 0.3)',
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => playAudio(aggregatedSummary.summary_audio)}
                      sx={{ color: '#2563eb', p: 0.5 }}
                    >
                      <PlayArrow sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                </Box>
                <Typography
                  sx={{
                    color: '#e2e8f0',
                    lineHeight: 1.8,
                    whiteSpace: 'pre-line',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: { xs: '0.75rem', sm: '0.8rem' },
                  }}
                >
                  {aggregatedSummary.summary}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Individual Updates */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Shield sx={{ fontSize: 16, color: '#dc2626' }} />
            <Typography sx={{ 
              color: '#e2e8f0',
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 600,
              fontSize: { xs: '0.8rem', sm: '0.85rem' },
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              Field Reports ({todayUpdates.length})
            </Typography>
          </Box>

          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#dc2626' }} />
            </Box>
          ) : todayUpdates.length === 0 ? (
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.3) 100%)',
                border: '1px solid #1e3a5f',
              }}
            >
              <Typography sx={{ 
                color: '#64748b',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                No field reports for selected parameters
              </Typography>
            </Paper>
          ) : (
            <List>
              {todayUpdates.map((update, index) => (
                <Accordion
                  key={update.id}
                  sx={{
                    mb: 1,
                    background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.3) 100%)',
                    border: '1px solid #1e3a5f',
                    borderRadius: '3px !important',
                    '&:before': { display: 'none' },
                    '&:hover': {
                      borderColor: '#2563eb',
                    },
                  }}
                >
                  <AccordionSummary 
                    expandIcon={<ExpandMore sx={{ color: '#64748b' }} />}
                    sx={{
                      '&:hover': {
                        background: 'rgba(37, 99, 235, 0.05)',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ 
                        bgcolor: 'rgba(220, 38, 38, 0.2)', 
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        color: '#fca5a5',
                        width: 36,
                        height: 36,
                        fontSize: '0.85rem',
                        fontFamily: '"JetBrains Mono", monospace',
                      }}>
                        {update.worker_name?.[0] || 'A'}
                      </Avatar>
                    </ListItemAvatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ 
                        fontWeight: 600, 
                        color: '#e2e8f0',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.8rem',
                      }}>
                        {update.worker_name}
                      </Typography>
                      <Typography sx={{ 
                        color: '#64748b',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.7rem',
                      }}>
                        {update.worker_role} • {update.site_location}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ borderTop: '1px solid #1e3a5f', pt: 2 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        sx={{ 
                          color: '#2563eb', 
                          mb: 1,
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '0.7rem',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Intelligence Summary:
                      </Typography>
                      <Typography sx={{ 
                        color: '#e2e8f0',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.75rem',
                      }}>
                        {update.summary || 'No summary available'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        sx={{ 
                          color: '#64748b', 
                          mb: 1,
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '0.7rem',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Original Transmission:
                      </Typography>
                      <Typography
                        sx={{
                          color: '#94a3b8',
                          fontStyle: 'italic',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '0.7rem',
                        }}
                      >
                        {update.original_message}
                      </Typography>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </List>
          )}
        </Box>
      )}

      {/* Tab 1: Query Agents */}
      {activeTab === 1 && (
        <Box>
          <Grid container spacing={3}>
            {/* Agent Selection */}
            <Grid item xs={12} md={5}>
              <Paper
                sx={{
                  p: { xs: 2, sm: 3 },
                  background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.3) 100%)',
                  border: '1px solid #1e3a5f',
                  borderRadius: '3px',
                  height: '100%',
                }}
              >
                <Typography sx={{ 
                  mb: 2, 
                  color: '#e2e8f0',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  Select Agents
                </Typography>

                <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant={queryType === 'single' ? 'contained' : 'outlined'}
                    startIcon={<Person sx={{ fontSize: 16 }} />}
                    onClick={() => setQueryType('single')}
                    size="small"
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.7rem',
                      ...(queryType === 'single' && {
                        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                      }),
                    }}
                  >
                    Single
                  </Button>
                  <Button
                    variant={queryType === 'multiple' ? 'contained' : 'outlined'}
                    startIcon={<Group sx={{ fontSize: 16 }} />}
                    onClick={() => setQueryType('multiple')}
                    size="small"
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.7rem',
                      ...(queryType === 'multiple' && {
                        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                      }),
                    }}
                  >
                    Multiple
                  </Button>
                </Box>

                {queryType === 'single' ? (
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                      Select Agent
                    </InputLabel>
                    <Select
                      value={selectedWorker || ''}
                      onChange={(e) => setSelectedWorker(e.target.value)}
                      label="Select Agent"
                      sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}
                    >
                      {workers.map((worker) => (
                        <MenuItem key={worker.id} value={worker.id} sx={{ fontSize: '0.75rem' }}>
                          {worker.name} - {worker.role}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {workers.map((worker) => (
                      <FormControlLabel
                        key={worker.id}
                        control={
                          <Checkbox
                            checked={selectedWorkers.includes(worker.id)}
                            onChange={() => toggleWorkerSelection(worker.id)}
                            sx={{
                              color: '#64748b',
                              '&.Mui-checked': {
                                color: '#dc2626',
                              },
                            }}
                          />
                        }
                        label={`${worker.name} (${worker.role})`}
                        sx={{ 
                          display: 'block', 
                          color: '#e2e8f0',
                          '& .MuiFormControlLabel-label': {
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.75rem',
                          },
                        }}
                      />
                    ))}
                  </Box>
                )}

                {queryType === 'multiple' && selectedWorkers.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Chip
                      label={`${selectedWorkers.length} agents selected`}
                      size="small"
                      sx={{
                        background: 'rgba(220, 38, 38, 0.15)',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        color: '#fca5a5',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.65rem',
                      }}
                    />
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Question Input */}
            <Grid item xs={12} md={7}>
              <Paper
                sx={{
                  p: { xs: 2, sm: 3 },
                  background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.3) 100%)',
                  border: '1px solid #1e3a5f',
                  borderRadius: '3px',
                }}
              >
                <Typography sx={{ 
                  mb: 2, 
                  color: '#e2e8f0',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  Intelligence Query
                </Typography>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="e.g., What surveillance activity was reported in Sector 7 this week?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  sx={{ 
                    mb: 2,
                    '& .MuiInputBase-input': {
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.8rem',
                    },
                  }}
                />

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<Send sx={{ fontSize: 16 }} />}
                    onClick={handleSubmitTextQuestion}
                    disabled={isProcessingQuery}
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.75rem',
                      letterSpacing: '0.05em',
                      background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        boxShadow: '0 0 20px rgba(220, 38, 38, 0.4)',
                      },
                    }}
                  >
                    Submit Query
                  </Button>

                  {!isRecordingQuestion ? (
                    <Button
                      variant="outlined"
                      startIcon={<Mic sx={{ fontSize: 16 }} />}
                      onClick={startVoiceQuestion}
                      disabled={isProcessingQuery}
                      sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.75rem',
                      }}
                    >
                      Voice Query
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<Stop sx={{ fontSize: 16 }} />}
                      onClick={stopVoiceQuestion}
                      sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.75rem',
                        background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                        animation: 'pulse 1.5s infinite',
                      }}
                    >
                      End Recording
                    </Button>
                  )}
                </Box>

                {isRecordingQuestion && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress
                      variant="determinate"
                      value={audioLevel * 100}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(30, 58, 95, 0.5)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #dc2626, #f87171)',
                        },
                      }}
                    />
                    <Typography
                      sx={{ 
                        mt: 1, 
                        color: '#fca5a5',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.7rem',
                      }}
                    >
                      🔴 Recording intelligence query...
                    </Typography>
                  </Box>
                )}

                {isProcessingQuery && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <CircularProgress size={28} sx={{ color: '#dc2626' }} />
                    <Typography
                      sx={{ 
                        mt: 1, 
                        color: '#64748b',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.7rem',
                      }}
                    >
                      Processing intelligence query...
                    </Typography>
                  </Box>
                )}
              </Paper>

              {/* Query Result */}
              {queryResult && (
                <Card
                  sx={{
                    mt: 3,
                    background: 'linear-gradient(135deg, #0f172a 0%, rgba(22, 163, 74, 0.1) 100%)',
                    border: '2px solid #16a34a',
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
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2,
                      }}
                    >
                      <Typography sx={{ 
                        color: '#86efac', 
                        fontFamily: '"JetBrains Mono", monospace',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}>
                        📡 Intelligence Response
                      </Typography>
                      {queryResult.answer_audio && (
                        <IconButton
                          onClick={() => playAudio(queryResult.answer_audio)}
                          sx={{ color: '#16a34a' }}
                        >
                          <PlayArrow />
                        </IconButton>
                      )}
                    </Box>

                    {queryResult.transcribed_question && (
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          sx={{ 
                            color: '#64748b',
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.65rem',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Your Query:
                        </Typography>
                        <Typography
                          sx={{ 
                            color: '#94a3b8', 
                            fontStyle: 'italic',
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.75rem',
                          }}
                        >
                          "{queryResult.transcribed_question}"
                        </Typography>
                      </Box>
                    )}

                    <Typography
                      sx={{
                        color: '#e2e8f0',
                        lineHeight: 1.8,
                        whiteSpace: 'pre-line',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.8rem',
                      }}
                    >
                      {queryResult.answer}
                    </Typography>

                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={`${queryResult.updates_analyzed || 0} reports analyzed`}
                        size="small"
                        sx={{ 
                          background: 'rgba(30, 58, 95, 0.5)',
                          border: '1px solid rgba(37, 99, 235, 0.3)',
                          color: '#93c5fd',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '0.6rem',
                        }}
                      />
                      {queryResult.date_range && (
                        <Chip
                          label={`${queryResult.date_range.start} → ${queryResult.date_range.end}`}
                          size="small"
                          sx={{ 
                            background: 'rgba(30, 58, 95, 0.5)',
                            border: '1px solid rgba(37, 99, 235, 0.3)',
                            color: '#93c5fd',
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.6rem',
                          }}
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default ManagerDashboard;
