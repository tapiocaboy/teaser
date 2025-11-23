import axios from 'axios';

class ApiService {
  constructor() {
    this.baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
  }

  async processAudio(audioBlob) {
    console.log('ApiService: Sending audio blob:', {
      size: audioBlob.size,
      type: audioBlob.type,
      firstBytes: Array.from(new Uint8Array(await audioBlob.slice(0, 20).arrayBuffer()))
    });

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/voice/process`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000, // 30 seconds
        }
      );

      console.log('ApiService: Backend response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error processing audio:', error);
      throw new Error('Failed to process audio');
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
