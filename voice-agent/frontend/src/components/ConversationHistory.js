import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import ApiService from '../services/ApiService';

const ConversationHistory = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apiService = new ApiService();

  useEffect(() => {
    let isMounted = true;

    const loadConversations = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await apiService.getConversations(25);
        if (!isMounted) return;

        setConversations(data?.conversations || []);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load conversation history');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Conversation History
        </Typography>

        {conversations.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No conversations yet. Start a conversation to see history here.
          </Typography>
        ) : (
          <List>
            {conversations.map((conversation, index) => (
              <React.Fragment key={conversation.id}>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                    {formatTimestamp(conversation.timestamp)}
                  </Typography>

                  <Box sx={{ width: '100%', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      You:
                    </Typography>
                    <Typography variant="body2" sx={{ pl: 1 }}>
                      {conversation.user_input}
                    </Typography>
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>
                      Assistant:
                    </Typography>
                    <Typography variant="body2" sx={{ pl: 1 }}>
                      {conversation.assistant_response}
                    </Typography>
                  </Box>
                </ListItem>

                {index < conversations.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default ConversationHistory;
