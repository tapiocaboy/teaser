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
  Security,
  RecordVoiceOver,
  Shield,
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
      setError('Please enter your Badge ID');
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
        // For commanders, try to find or register
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
        setError('Authentication failed. Please try again.');
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
      setError('Registration failed. Please try again.');
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
      <Box sx={{ textAlign: 'center', mb: { xs: 4, sm: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1 }}>
          <Shield sx={{ fontSize: { xs: 28, sm: 32 }, color: '#dc2626' }} />
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 700,
              color: '#e2e8f0',
              letterSpacing: '0.15em',
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
              textTransform: 'uppercase',
            }}
          >
            SPYCHO
          </Typography>
        </Box>
        <Typography sx={{ 
          fontSize: { xs: '0.65rem', sm: '0.7rem' }, 
          color: '#64748b', 
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          Security Operations Platform
        </Typography>
        <Box sx={{ 
          mt: 2, 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: 1,
          px: 2,
          py: 0.5,
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.2)',
          borderRadius: '2px',
        }}>
          <Box sx={{ 
            width: 6, 
            height: 6, 
            borderRadius: '50%', 
            background: '#16a34a',
            boxShadow: '0 0 8px #16a34a',
          }} />
          <Typography sx={{ 
            fontSize: '0.6rem', 
            color: '#86efac',
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: '0.1em',
          }}>
            SYSTEM ACTIVE
          </Typography>
        </Box>
      </Box>

      {!selectedRole ? (
        // Role Selection - Tactical Command Style
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 2, sm: 2.5 }, 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'center', 
          width: '100%',
          maxWidth: { xs: 300, sm: 480 },
          px: { xs: 1, sm: 0 },
        }}>
          {/* Field Agent Card */}
          <Box
            onClick={() => handleRoleClick('worker')}
            sx={{
              cursor: 'pointer',
              position: 'relative',
              width: { xs: '100%', sm: 210 },
              height: { xs: 120, sm: 140 },
              background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.4) 100%)',
              border: '1px solid #1e3a5f',
              borderRadius: '3px',
              transition: 'all 0.25s ease',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '3px',
                height: '100%',
                background: 'linear-gradient(180deg, #dc2626, #991b1b)',
                opacity: 0.7,
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#16a34a',
                boxShadow: '0 0 6px #16a34a',
              },
              '&:hover': {
                background: 'linear-gradient(135deg, #0f172a 0%, rgba(220, 38, 38, 0.15) 100%)',
                borderColor: '#dc2626',
                boxShadow: '0 0 30px rgba(220, 38, 38, 0.2)',
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
              p: { xs: 2, sm: 2.5 },
            }}>
              <Box sx={{
                width: { xs: 44, sm: 48 },
                height: { xs: 44, sm: 48 },
                borderRadius: '50%',
                background: 'rgba(220, 38, 38, 0.15)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
              }}>
                <RecordVoiceOver sx={{ fontSize: { xs: 22, sm: 24 }, color: '#fca5a5' }} />
              </Box>
              
              <Typography sx={{ 
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 600, 
                fontSize: { xs: '0.8rem', sm: '0.85rem' }, 
                color: '#e2e8f0',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                mb: 0.5,
              }}>
                Field Agent
              </Typography>
              <Typography sx={{ 
                fontSize: { xs: '0.6rem', sm: '0.65rem' }, 
                color: '#64748b',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                Submit Intel Reports
              </Typography>
            </Box>
          </Box>

          {/* Commander Card */}
          <Box
            onClick={() => handleRoleClick('manager')}
            sx={{
              cursor: 'pointer',
              position: 'relative',
              width: { xs: '100%', sm: 210 },
              height: { xs: 120, sm: 140 },
              background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.4) 100%)',
              border: '1px solid #1e3a5f',
              borderRadius: '3px',
              transition: 'all 0.25s ease',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '3px',
                height: '100%',
                background: 'linear-gradient(180deg, #2563eb, #1e40af)',
                opacity: 0.7,
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#16a34a',
                boxShadow: '0 0 6px #16a34a',
              },
              '&:hover': {
                background: 'linear-gradient(135deg, #0f172a 0%, rgba(37, 99, 235, 0.15) 100%)',
                borderColor: '#2563eb',
                boxShadow: '0 0 30px rgba(37, 99, 235, 0.2)',
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
              p: { xs: 2, sm: 2.5 },
            }}>
              <Box sx={{
                width: { xs: 44, sm: 48 },
                height: { xs: 44, sm: 48 },
                borderRadius: '50%',
                background: 'rgba(37, 99, 235, 0.15)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
              }}>
                <Security sx={{ fontSize: { xs: 22, sm: 24 }, color: '#93c5fd' }} />
              </Box>
              
              <Typography sx={{ 
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 600, 
                fontSize: { xs: '0.8rem', sm: '0.85rem' }, 
                color: '#e2e8f0',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                mb: 0.5,
              }}>
                Commander
              </Typography>
              <Typography sx={{ 
                fontSize: { xs: '0.6rem', sm: '0.65rem' }, 
                color: '#64748b',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                Command & Query Intel
              </Typography>
            </Box>
          </Box>
        </Box>
      ) : (
        // Login Form - Tactical Security Style
        <Fade in={true}>
          <Card
            sx={{
              maxWidth: { xs: 320, sm: 360 },
              width: '100%',
              mx: { xs: 2, sm: 0 },
              background: 'linear-gradient(135deg, #0f172a 0%, rgba(30, 58, 95, 0.3) 100%)',
              border: '1px solid #1e3a5f',
              borderRadius: '3px',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '3px',
                height: '100%',
                background: selectedRole === 'worker' 
                  ? 'linear-gradient(180deg, #dc2626, #991b1b)'
                  : 'linear-gradient(180deg, #2563eb, #1e40af)',
              },
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Box sx={{ textAlign: 'center', mb: { xs: 2.5, sm: 3 } }}>
                {selectedRole === 'worker' ? (
                  <RecordVoiceOver sx={{ fontSize: { xs: 28, sm: 32 }, color: '#fca5a5' }} />
                ) : (
                  <Security sx={{ fontSize: { xs: 28, sm: 32 }, color: '#93c5fd' }} />
                )}
                <Typography sx={{ 
                  mt: 1.5, 
                  fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 600, 
                  color: '#e2e8f0', 
                  fontSize: { xs: '0.85rem', sm: '0.9rem' },
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  {isNewUser ? 'Register' : 'Authenticate'} as {selectedRole === 'worker' ? 'Field Agent' : 'Commander'}
                </Typography>
                <Typography sx={{ 
                  mt: 0.5, 
                  fontSize: '0.65rem', 
                  color: '#64748b',
                  fontFamily: '"JetBrains Mono", monospace',
                  letterSpacing: '0.1em',
                }}>
                  SECURE ACCESS REQUIRED
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  {error}
                </Alert>
              )}

              <TextField
                fullWidth
                label="Badge ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                sx={{ mb: 2 }}
                size="small"
                disabled={isNewUser}
                placeholder="Enter your badge number"
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
                    label="Assignment Location"
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    sx={{ mb: 2 }}
                    size="small"
                    placeholder="e.g., Sector 7, Downtown Division"
                  />
                  {selectedRole === 'worker' && (
                    <TextField
                      fullWidth
                      label="Specialization"
                      value={workerRole}
                      size="small"
                      onChange={(e) => setWorkerRole(e.target.value)}
                      sx={{ mb: 2 }}
                      placeholder="e.g., Surveillance, Patrol, Investigation"
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
                  py: { xs: 1.25, sm: 1.5 },
                  fontSize: { xs: '0.75rem', sm: '0.8rem' },
                  fontFamily: '"JetBrains Mono", monospace',
                  letterSpacing: '0.08em',
                  background: selectedRole === 'worker'
                    ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
                    : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                  '&:hover': {
                    background: selectedRole === 'worker'
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    boxShadow: selectedRole === 'worker'
                      ? '0 0 25px rgba(220, 38, 38, 0.4)'
                      : '0 0 25px rgba(37, 99, 235, 0.4)',
                  },
                }}
              >
                {isLoading ? 'Authenticating...' : isNewUser ? 'Register' : 'Access System'}
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
                sx={{ 
                  mt: 2, 
                  color: '#64748b', 
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  fontFamily: '"JetBrains Mono", monospace',
                  '&:hover': {
                    color: '#94a3b8',
                    background: 'transparent',
                  },
                }}
              >
                {isNewUser ? '← Back to Login' : '← Select Different Role'}
              </Button>
            </CardContent>
          </Card>
        </Fade>
      )}
    </Box>
  );
};

export default RoleSelector;
