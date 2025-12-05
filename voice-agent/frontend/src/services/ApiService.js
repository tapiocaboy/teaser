import axios from 'axios';

class ApiService {
  constructor() {
    this.baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
  }

  async processAudio(audioBlob) {
    // Validate blob
    if (!audioBlob || audioBlob.size === 0) {
      console.error('ApiService: Empty audio blob received');
      throw new Error('No audio data recorded');
    }

    console.log('ApiService: Preparing to send audio blob:', {
      size: audioBlob.size,
      type: audioBlob.type,
    });

    // Get first bytes for debugging
    try {
      const firstBytes = await audioBlob.slice(0, 20).arrayBuffer();
      console.log('ApiService: First bytes:', Array.from(new Uint8Array(firstBytes)));
    } catch (e) {
      console.warn('Could not read first bytes:', e);
    }

    // Determine file extension based on mime type
    let filename = 'audio.webm';
    if (audioBlob.type.includes('ogg')) {
      filename = 'audio.ogg';
    } else if (audioBlob.type.includes('mp4')) {
      filename = 'audio.mp4';
    } else if (audioBlob.type.includes('wav')) {
      filename = 'audio.wav';
    }

    const formData = new FormData();
    formData.append('file', audioBlob, filename);

    console.log(`ApiService: Sending ${filename} (${audioBlob.size} bytes) to ${this.baseUrl}/api/voice/process`);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/voice/process`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 seconds (increased for longer processing)
        }
      );

      console.log('ApiService: Backend response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error processing audio:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        throw new Error(error.response.data?.detail || 'Failed to process audio');
      }
      throw new Error('Failed to process audio - check if backend is running');
    }
  }

  async getConversations(limit = 10, offset = 0) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/conversations`,
        {
          params: { limit, offset },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw new Error('Failed to load conversation history');
    }
  }

  async getHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      return response.data;
    } catch (error) {
      console.error('Error checking health:', error);
      throw new Error('Backend service unavailable');
    }
  }

  // WebSocket connection for real-time communication
  createWebSocketConnection() {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/voice';
    return new WebSocket(wsUrl);
  }
}

export default ApiService;
