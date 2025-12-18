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
      setError('Failed to load initial data');
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
      setError('Failed to load updates');
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
      setError('Failed to generate summary');
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
      setError('Please enter a question');
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
        setError('Please select worker(s) to query');
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
      setError('Failed to start recording');
      setIsRecordingQuestion(false);
    }
  };

  const stopVoiceQuestion = async () => {
    setIsRecordingQuestion(false);
    setAudioLevel(0);
    try {
      await audioService.current.stopRecording();
    } catch (err) {
      setError('Failed to stop recording');
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
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
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
            <Dashboard sx={{ mr: 1, verticalAlign: 'middle' }} />
            Manager Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--muted-foreground)', mt: 0.5 }}>
            Welcome, {user?.name}
          </Typography>
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

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, v) => setActiveTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            color: 'var(--muted-foreground)',
            '&.Mui-selected': {
              color: 'var(--primary)',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'var(--primary)',
          },
        }}
      >
        <Tab icon={<Summarize />} label="Daily Summary" />
        <Tab icon={<QuestionAnswer />} label="Ask Questions" />
      </Tabs>

      {/* Tab 0: Daily Summary */}
      {activeTab === 0 && (
        <Box>
          {/* Filters */}
          <Paper
            sx={{
              p: 3,
              mb: 3,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 2,
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Site Location</InputLabel>
                  <Select
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    label="Site Location"
                  >
                    <MenuItem value="">All Sites</MenuItem>
                    {sites.map((site) => (
                      <MenuItem key={site} value={site}>
                        {site}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={loadUpdates}
                    sx={{ flex: 1 }}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Summarize />}
                    onClick={loadAggregatedSummary}
                    disabled={isLoading}
                    sx={{
                      flex: 1,
                      background: 'var(--primary)',
                      '&:hover': { filter: 'brightness(1.1)' },
                    }}
                  >
                    Generate Summary
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Aggregated Summary */}
          {aggregatedSummary && (
            <Card
              sx={{
                mb: 3,
                background: 'var(--card)',
                border: '2px solid var(--primary)',
                borderRadius: 3,
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ color: 'var(--primary)', fontWeight: 700 }}>
                    📊 Daily Summary - {formatDate(aggregatedSummary.date)}
                  </Typography>
                  <Box>
                    <Chip
                      label={`${aggregatedSummary.update_count} updates`}
                      size="small"
                      sx={{ mr: 1, background: 'var(--accent)' }}
                    />
                    <IconButton
                      onClick={() => playAudio(aggregatedSummary.summary_audio)}
                      sx={{ color: 'var(--primary)' }}
                    >
                      <PlayArrow />
                    </IconButton>
                  </Box>
                </Box>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'var(--foreground)',
                    lineHeight: 1.8,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {aggregatedSummary.summary}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Individual Updates */}
          <Typography variant="h6" sx={{ mb: 2, color: 'var(--foreground)' }}>
            Individual Updates ({todayUpdates.length})
          </Typography>

          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress sx={{ color: 'var(--primary)' }} />
            </Box>
          ) : todayUpdates.length === 0 ? (
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <Typography sx={{ color: 'var(--muted-foreground)' }}>
                No updates for the selected date/site
              </Typography>
            </Paper>
          ) : (
            <List>
              {todayUpdates.map((update, index) => (
                <Accordion
                  key={update.id}
                  sx={{
                    mb: 1,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    '&:before': { display: 'none' },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'var(--primary)' }}>
                        {update.worker_name?.[0] || 'W'}
                      </Avatar>
                    </ListItemAvatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, color: 'var(--foreground)' }}>
                        {update.worker_name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
                        {update.worker_role} • {update.site_location}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ color: 'var(--primary)', mb: 1 }}
                      >
                        Summary:
                      </Typography>
                      <Typography sx={{ color: 'var(--foreground)' }}>
                        {update.summary || 'No summary available'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ color: 'var(--muted-foreground)', mb: 1 }}
                      >
                        Original Message:
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'var(--muted-foreground)',
                          fontStyle: 'italic',
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

      {/* Tab 1: Q&A */}
      {activeTab === 1 && (
        <Box>
          <Grid container spacing={3}>
            {/* Worker Selection */}
            <Grid item xs={12} md={5}>
              <Paper
                sx={{
                  p: 3,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  height: '100%',
                }}
              >
                <Typography variant="h6" sx={{ mb: 2, color: 'var(--foreground)' }}>
                  Select Workers
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Button
                    variant={queryType === 'single' ? 'contained' : 'outlined'}
                    startIcon={<Person />}
                    onClick={() => setQueryType('single')}
                    sx={{ mr: 1 }}
                  >
                    Single
                  </Button>
                  <Button
                    variant={queryType === 'multiple' ? 'contained' : 'outlined'}
                    startIcon={<Group />}
                    onClick={() => setQueryType('multiple')}
                  >
                    Multiple
                  </Button>
                </Box>

                {queryType === 'single' ? (
                  <FormControl fullWidth>
                    <InputLabel>Select Worker</InputLabel>
                    <Select
                      value={selectedWorker || ''}
                      onChange={(e) => setSelectedWorker(e.target.value)}
                      label="Select Worker"
                    >
                      {workers.map((worker) => (
                        <MenuItem key={worker.id} value={worker.id}>
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
                          />
                        }
                        label={`${worker.name} (${worker.role})`}
                        sx={{ display: 'block', color: 'var(--foreground)' }}
                      />
                    ))}
                  </Box>
                )}

                {queryType === 'multiple' && selectedWorkers.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
                      Selected: {selectedWorkers.length} workers
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Question Input */}
            <Grid item xs={12} md={7}>
              <Paper
                sx={{
                  p: 3,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ mb: 2, color: 'var(--foreground)' }}>
                  Ask a Question
                </Typography>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="e.g., What progress was made on the electrical work this week?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  sx={{ mb: 2 }}
                />

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    onClick={handleSubmitTextQuestion}
                    disabled={isProcessingQuery}
                    sx={{
                      background: 'var(--primary)',
                      '&:hover': { filter: 'brightness(1.1)' },
                    }}
                  >
                    Ask Question
                  </Button>

                  {!isRecordingQuestion ? (
                    <Button
                      variant="outlined"
                      startIcon={<Mic />}
                      onClick={startVoiceQuestion}
                      disabled={isProcessingQuery}
                    >
                      Ask with Voice
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<Stop />}
                      onClick={stopVoiceQuestion}
                      sx={{
                        background: 'var(--destructive)',
                        '&:hover': { filter: 'brightness(1.1)' },
                      }}
                    >
                      Stop Recording
                    </Button>
                  )}
                </Box>

                {isRecordingQuestion && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress
                      variant="determinate"
                      value={audioLevel * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'var(--muted)',
                        '& .MuiLinearProgress-bar': {
                          background: 'var(--primary)',
                        },
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ mt: 1, color: 'var(--muted-foreground)' }}
                    >
                      🎤 Recording your question...
                    </Typography>
                  </Box>
                )}

                {isProcessingQuery && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <CircularProgress size={24} sx={{ color: 'var(--primary)' }} />
                    <Typography
                      variant="body2"
                      sx={{ mt: 1, color: 'var(--muted-foreground)' }}
                    >
                      Processing your question...
                    </Typography>
                  </Box>
                )}
              </Paper>

              {/* Query Result */}
              {queryResult && (
                <Card
                  sx={{
                    mt: 3,
                    background: 'var(--card)',
                    border: '2px solid var(--primary)',
                    borderRadius: 3,
                  }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2,
                      }}
                    >
                      <Typography variant="h6" sx={{ color: 'var(--primary)', fontWeight: 700 }}>
                        💬 Answer
                      </Typography>
                      {queryResult.answer_audio && (
                        <IconButton
                          onClick={() => playAudio(queryResult.answer_audio)}
                          sx={{ color: 'var(--primary)' }}
                        >
                          <PlayArrow />
                        </IconButton>
                      )}
                    </Box>

                    {queryResult.transcribed_question && (
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ color: 'var(--muted-foreground)' }}
                        >
                          Your question:
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: 'var(--foreground)', fontStyle: 'italic' }}
                        >
                          "{queryResult.transcribed_question}"
                        </Typography>
                      </Box>
                    )}

                    <Typography
                      variant="body1"
                      sx={{
                        color: 'var(--foreground)',
                        lineHeight: 1.8,
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {queryResult.answer}
                    </Typography>

                    <Box sx={{ mt: 2 }}>
                      <Chip
                        label={`${queryResult.updates_analyzed || 0} updates analyzed`}
                        size="small"
                        sx={{ mr: 1, background: 'var(--accent)' }}
                      />
                      {queryResult.date_range && (
                        <Chip
                          label={`${queryResult.date_range.start} to ${queryResult.date_range.end}`}
                          size="small"
                          sx={{ background: 'var(--accent)' }}
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

