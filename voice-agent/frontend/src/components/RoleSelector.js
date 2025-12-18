import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Fade,
} from '@mui/material';
import {
  Construction,
  SupervisorAccount,
  ArrowForward,
  Engineering,
} from '@mui/icons-material';
import ConstructionApiService from '../services/ConstructionApi';

const RoleSelector = ({ onRoleSelect, onUserLogin }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [workerRole, setWorkerRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  const api = new ConstructionApiService();

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setError('');
    setIsNewUser(false);
    setEmployeeId('');
    setName('');
    setSiteLocation('');
    setWorkerRole('');
  };

  const handleLogin = async () => {
    if (!employeeId.trim()) {
      setError('Please enter your Employee ID');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (selectedRole === 'worker') {
        const result = await api.getWorkerByEmployeeId(employeeId);
        if (result && result.worker) {
          onUserLogin(selectedRole, result.worker);
          onRoleSelect(selectedRole);
        } else {
          setIsNewUser(true);
        }
      } else {
        // For managers, try to find or register
        try {
          const managers = await api.getAllManagers();
          const existingManager = managers.managers?.find(
            m => m.employee_id === employeeId
          );
          if (existingManager) {
            onUserLogin(selectedRole, existingManager);
            onRoleSelect(selectedRole);
          } else {
            setIsNewUser(true);
          }
        } catch (e) {
          setIsNewUser(true);
        }
      }
    } catch (err) {
      if (err.message.includes('404')) {
        setIsNewUser(true);
      } else {
        setError('Failed to login. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (selectedRole === 'worker') {
        const result = await api.registerWorker({
          name: name.trim(),
          employee_id: employeeId.trim(),
          site_location: siteLocation.trim() || null,
          role: workerRole.trim() || null,
        });
        if (result.success) {
          onUserLogin(selectedRole, result.worker);
          onRoleSelect(selectedRole);
        }
      } else {
        const result = await api.registerManager({
          name: name.trim(),
          employee_id: employeeId.trim(),
          managed_sites: siteLocation.trim() ? [siteLocation.trim()] : [],
        });
        if (result.success) {
          onUserLogin(selectedRole, result.manager);
          onRoleSelect(selectedRole);
        }
      }
    } catch (err) {
      setError('Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <Engineering sx={{ fontSize: 48, color: 'var(--primary)', mr: 2 }} />
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color: 'var(--foreground)',
              letterSpacing: 2,
            }}
          >
            SiteVoice
          </Typography>
        </Box>
        <Typography
          variant="h6"
          sx={{ color: 'var(--muted-foreground)', maxWidth: 500 }}
        >
          Voice-powered daily updates for construction sites
        </Typography>
      </Box>

      {!selectedRole ? (
        // Role Selection
        <Grid container spacing={4} justifyContent="center" sx={{ maxWidth: 800 }}>
          <Grid item xs={12} md={6}>
            <Card
              onClick={() => handleRoleClick('worker')}
              sx={{
                cursor: 'pointer',
                background: 'var(--card)',
                border: '2px solid var(--border)',
                borderRadius: 4,
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: 'var(--primary)',
                  transform: 'translateY(-8px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                },
              }}
            >
              <CardContent sx={{ p: 5, textAlign: 'center' }}>
                <Construction
                  sx={{
                    fontSize: 80,
                    color: 'var(--primary)',
                    mb: 2,
                  }}
                />
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--foreground)', mb: 1 }}>
                  Site Worker
                </Typography>
                <Typography variant="body1" sx={{ color: 'var(--muted-foreground)' }}>
                  Submit your daily updates via voice
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card
              onClick={() => handleRoleClick('manager')}
              sx={{
                cursor: 'pointer',
                background: 'var(--card)',
                border: '2px solid var(--border)',
                borderRadius: 4,
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: 'var(--primary)',
                  transform: 'translateY(-8px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                },
              }}
            >
              <CardContent sx={{ p: 5, textAlign: 'center' }}>
                <SupervisorAccount
                  sx={{
                    fontSize: 80,
                    color: 'var(--primary)',
                    mb: 2,
                  }}
                />
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--foreground)', mb: 1 }}>
                  Site Manager
                </Typography>
                <Typography variant="body1" sx={{ color: 'var(--muted-foreground)' }}>
                  Review summaries and ask questions
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        // Login Form
        <Fade in={true}>
          <Card
            sx={{
              maxWidth: 450,
              width: '100%',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                {selectedRole === 'worker' ? (
                  <Construction sx={{ fontSize: 48, color: 'var(--primary)' }} />
                ) : (
                  <SupervisorAccount sx={{ fontSize: 48, color: 'var(--primary)' }} />
                )}
                <Typography variant="h5" sx={{ mt: 2, fontWeight: 700, color: 'var(--foreground)' }}>
                  {isNewUser ? 'Register' : 'Login'} as {selectedRole === 'worker' ? 'Site Worker' : 'Site Manager'}
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <TextField
                fullWidth
                label="Employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                sx={{ mb: 3 }}
                disabled={isNewUser}
              />

              {isNewUser && (
                <>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ mb: 3 }}
                  />
                  <TextField
                    fullWidth
                    label="Site Location"
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    sx={{ mb: 3 }}
                    placeholder="e.g., Downtown Tower Project"
                  />
                  {selectedRole === 'worker' && (
                    <TextField
                      fullWidth
                      label="Role/Trade"
                      value={workerRole}
                      onChange={(e) => setWorkerRole(e.target.value)}
                      sx={{ mb: 3 }}
                      placeholder="e.g., Electrician, Mason, Foreman"
                    />
                  )}
                </>
              )}

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={isNewUser ? handleRegister : handleLogin}
                disabled={isLoading}
                endIcon={isLoading ? <CircularProgress size={20} /> : <ArrowForward />}
                sx={{
                  py: 1.5,
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  '&:hover': {
                    background: 'var(--primary)',
                    filter: 'brightness(1.1)',
                  },
                }}
              >
                {isLoading ? 'Please wait...' : isNewUser ? 'Register & Continue' : 'Continue'}
              </Button>

              <Button
                fullWidth
                variant="text"
                onClick={() => {
                  if (isNewUser) {
                    setIsNewUser(false);
                  } else {
                    setSelectedRole(null);
                  }
                }}
                sx={{ mt: 2, color: 'var(--muted-foreground)' }}
              >
                {isNewUser ? 'Back to Login' : 'Choose Different Role'}
              </Button>
            </CardContent>
          </Card>
        </Fade>
      )}
    </Box>
  );
};

export default RoleSelector;

