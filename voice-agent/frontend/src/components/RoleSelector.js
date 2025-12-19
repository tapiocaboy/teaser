import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Fade,
} from '@mui/material';
import {
  ArrowForward,
  GraphicEq,
  KeyboardVoice,
  Headphones,
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
        p: { xs: 2, sm: 3 },
      }}
    >
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <GraphicEq sx={{ fontSize: { xs: 18, sm: 20 }, color: '#60a5fa' }} />
          <Typography
            sx={{
              fontWeight: 500,
              color: '#c9d1d9',
              letterSpacing: '0.04em',
              fontSize: { xs: '0.9rem', sm: '1rem' },
            }}
          >
            AKORDI ECHO
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.65rem', color: '#484f58', mt: 0.5 }}>
          Voice Intelligence Platform
        </Typography>
      </Box>

      {!selectedRole ? (
        // Role Selection - Mobile-First Enterprise Style
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1.5, sm: 2 }, 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'center', 
          width: '100%',
          maxWidth: { xs: 280, sm: 420 },
          px: { xs: 1, sm: 0 },
        }}>
          {/* Operator Card */}
          <Box
            onClick={() => handleRoleClick('worker')}
            sx={{
              cursor: 'pointer',
              position: 'relative',
              width: { xs: '100%', sm: 180 },
              height: { xs: 100, sm: 120 },
              background: '#0a0d12',
              border: '1px solid #1a2332',
              borderRadius: '2px',
              transition: 'all 0.2s ease',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '2px',
                height: '100%',
                background: '#3b82f6',
                opacity: 0.6,
              },
              '&:hover': {
                background: '#0d1117',
                borderColor: '#2a3a4f',
                '&::before': { opacity: 1 },
              },
              '&:active': {
                background: '#0d1117',
                '&::before': { opacity: 1 },
              },
            }}
          >
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              p: { xs: 1.5, sm: 2 },
            }}>
              <Box sx={{
                width: { xs: 36, sm: 40 },
                height: { xs: 36, sm: 40 },
                borderRadius: '4px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1,
              }}>
                <KeyboardVoice sx={{ fontSize: { xs: 18, sm: 20 }, color: '#60a5fa' }} />
              </Box>
              
              <Typography sx={{ 
                fontWeight: 500, 
                fontSize: { xs: '0.75rem', sm: '0.8rem' }, 
                color: '#c9d1d9',
                letterSpacing: '0.02em',
                mb: 0.25,
              }}>
                Operator
              </Typography>
              <Typography sx={{ 
                fontSize: { xs: '0.6rem', sm: '0.65rem' }, 
                color: '#586069',
              }}>
                Submit voice updates
              </Typography>
            </Box>
          </Box>

          {/* Manager Card */}
          <Box
            onClick={() => handleRoleClick('manager')}
            sx={{
              cursor: 'pointer',
              position: 'relative',
              width: { xs: '100%', sm: 180 },
              height: { xs: 100, sm: 120 },
              background: '#0a0d12',
              border: '1px solid #1a2332',
              borderRadius: '2px',
              transition: 'all 0.2s ease',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '2px',
                height: '100%',
                background: '#8b5cf6',
                opacity: 0.6,
              },
              '&:hover': {
                background: '#0d1117',
                borderColor: '#2a3a4f',
                '&::before': { opacity: 1 },
              },
              '&:active': {
                background: '#0d1117',
                '&::before': { opacity: 1 },
              },
            }}
          >
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              p: { xs: 1.5, sm: 2 },
            }}>
              <Box sx={{
                width: { xs: 36, sm: 40 },
                height: { xs: 36, sm: 40 },
                borderRadius: '4px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1,
              }}>
                <Headphones sx={{ fontSize: { xs: 18, sm: 20 }, color: '#a78bfa' }} />
              </Box>
              
              <Typography sx={{ 
                fontWeight: 500, 
                fontSize: { xs: '0.75rem', sm: '0.8rem' }, 
                color: '#c9d1d9',
                letterSpacing: '0.02em',
                mb: 0.25,
              }}>
                Manager
              </Typography>
              <Typography sx={{ 
                fontSize: { xs: '0.6rem', sm: '0.65rem' }, 
                color: '#586069',
              }}>
                Review & query updates
              </Typography>
            </Box>
          </Box>
        </Box>
      ) : (
        // Login Form - Mobile Optimized
        <Fade in={true}>
          <Card
            sx={{
              maxWidth: { xs: 300, sm: 340 },
              width: '100%',
              mx: { xs: 2, sm: 0 },
              background: '#0a0d12',
              border: '1px solid #1a2332',
              borderRadius: '2px',
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Box sx={{ textAlign: 'center', mb: { xs: 2, sm: 2.5 } }}>
                {selectedRole === 'worker' ? (
                  <KeyboardVoice sx={{ fontSize: { xs: 22, sm: 24 }, color: '#60a5fa' }} />
                ) : (
                  <Headphones sx={{ fontSize: { xs: 22, sm: 24 }, color: '#a78bfa' }} />
                )}
                <Typography sx={{ mt: 1, fontWeight: 500, color: '#c9d1d9', fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>
                  {isNewUser ? 'Register' : 'Sign In'} as {selectedRole === 'worker' ? 'Operator' : 'Manager'}
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  {error}
                </Alert>
              )}

              <TextField
                fullWidth
                label="Employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                sx={{ mb: 2 }}
                size="small"
                disabled={isNewUser}
              />

              {isNewUser && (
                <>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ mb: 2 }}
                    size="small"
                  />
                  <TextField
                    fullWidth
                    label="Site Location"
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    sx={{ mb: 2 }}
                    size="small"
                    placeholder="e.g., Downtown Tower Project"
                  />
                  {selectedRole === 'worker' && (
                    <TextField
                      fullWidth
                      label="Role/Trade"
                      value={workerRole}
                      size="small"
                      onChange={(e) => setWorkerRole(e.target.value)}
                      sx={{ mb: 2 }}
                      placeholder="e.g., Electrician, Mason, Foreman"
                    />
                  )}
                </>
              )}

              <Button
                fullWidth
                variant="contained"
                size="medium"
                onClick={isNewUser ? handleRegister : handleLogin}
                disabled={isLoading}
                endIcon={isLoading ? <CircularProgress size={16} /> : <ArrowForward sx={{ fontSize: 16 }} />}
                sx={{
                  py: { xs: 1, sm: 1.25 },
                  fontSize: { xs: '0.75rem', sm: '0.8rem' },
                  background: '#3b82f6',
                  color: '#ffffff',
                  '&:hover': {
                    background: '#2563eb',
                  },
                }}
              >
                {isLoading ? 'Please wait...' : isNewUser ? 'Register' : 'Continue'}
              </Button>

              <Button
                fullWidth
                variant="text"
                size="small"
                onClick={() => {
                  if (isNewUser) {
                    setIsNewUser(false);
                  } else {
                    setSelectedRole(null);
                  }
                }}
                sx={{ mt: 1.5, color: '#484f58', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
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

