/**
 * VisualizationService
 * Handles WebSocket connection and audio streaming for UMAP visualization
 */

class VisualizationService {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.isConnected = false;
    this.audioContext = null;
    this.mediaStream = null;
    this.source = null;
    this.processor = null;
    this.onFrameCallback = null;
    this.onStatusCallback = null;
    this.onErrorCallback = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.targetSampleRate = 16000;
    this.isCapturing = false;
  }

  /**
   * Connect to the visualization WebSocket
   */
  async connect(sessionId = null) {
    this.sessionId = sessionId || `viz_${Date.now()}`;
    
    // Use correct WebSocket URL based on environment
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const wsUrl = `ws://${wsHost}/api/visualization/ws/${this.sessionId}`;

    console.log('Connecting to WebSocket:', wsUrl);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('WebSocket connection timeout'));
            this.ws.close();
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('✓ Visualization WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve(this.sessionId);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', error);
          if (this.onErrorCallback) {
            this.onErrorCallback(new Error('WebSocket connection error'));
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          if (event.code !== 1000) {
            this.handleDisconnect();
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('✓ Visualization session started:', data.session_id);
        if (this.onStatusCallback) {
          this.onStatusCallback(data.status);
        }
        break;

      case 'frame':
        if (this.onFrameCallback) {
          this.onFrameCallback({
            coords: data.coords,
            rms: data.rms,
            centroid: data.centroid,
            isTrained: data.is_trained,
            trainingProgress: data.training_progress,
            timestamp: data.timestamp,
            spectralSpread: data.spectral_spread || 0.5,
            tonality: data.tonality || 0.5,
            zcr: data.zcr || 0,
            rolloff: data.rolloff || 0.5
          });
        }
        break;

      case 'status':
        if (this.onStatusCallback) {
          this.onStatusCallback(data.status);
        }
        break;

      case 'reset':
        console.log('Visualization reset');
        if (this.onStatusCallback) {
          this.onStatusCallback(data.status);
        }
        break;

      case 'train':
        console.log('UMAP training:', data.success ? 'started' : 'failed');
        if (this.onStatusCallback) {
          this.onStatusCallback(data.status);
        }
        break;

      case 'error':
        console.error('Server error:', data.message);
        if (this.onErrorCallback) {
          this.onErrorCallback(new Error(data.message));
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connect(this.sessionId), 2000);
    }
  }

  /**
   * Start capturing audio from microphone using ScriptProcessor
   * (More reliable than AnalyserNode for raw audio data)
   */
  async startAudioCapture() {
    try {
      console.log('Requesting microphone access...');
      
      // Request microphone access with minimal processing
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,  // Disable to preserve audio
          noiseSuppression: false,  // Disable to preserve audio
          autoGainControl: true     // Keep this for consistent levels
        }
      });

      console.log('✓ Microphone access granted');
      console.log('Audio tracks:', this.mediaStream.getAudioTracks().map(t => ({
        label: t.label,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      })));

      // Create audio context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      console.log('AudioContext sample rate:', this.audioContext.sampleRate);

      // Resume audio context (required for autoplay policy)
      if (this.audioContext.state === 'suspended') {
        console.log('Resuming audio context...');
        await this.audioContext.resume();
        console.log('✓ Audio context resumed, state:', this.audioContext.state);
      }

      // Create source from microphone
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Use ScriptProcessor for reliable raw audio access
      // Note: ScriptProcessor is deprecated but still widely supported
      // and more reliable for raw audio data than AnalyserNode
      const bufferSize = 4096;
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      // Calculate downsampling ratio
      const ratio = Math.round(this.audioContext.sampleRate / this.targetSampleRate);
      console.log('Downsampling ratio:', ratio, `(${this.audioContext.sampleRate} -> ${this.targetSampleRate})`);
      
      let frameCount = 0;
      
      this.processor.onaudioprocess = (event) => {
        if (!this.isConnected || !this.isCapturing) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Calculate RMS for debugging
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        
        // Log occasionally for debugging
        frameCount++;
        if (frameCount % 50 === 0) {
          console.log('Audio frame', frameCount, 'RMS:', rms.toFixed(4), 'samples:', inputData.length);
        }
        
        // Downsample to 16kHz
        const downsampledLength = Math.floor(inputData.length / ratio);
        const int16Data = new Int16Array(downsampledLength);
        
        for (let i = 0; i < downsampledLength; i++) {
          const sourceIndex = i * ratio;
          const sample = Math.max(-1, Math.min(1, inputData[sourceIndex]));
          int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        // Send to WebSocket
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(int16Data.buffer);
        }
      };

      // Connect: source -> processor -> destination
      // Must connect to destination for processor to work
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      this.isCapturing = true;
      
      console.log('✓ Audio capture started with ScriptProcessor');
      console.log('  - Buffer size:', bufferSize);
      console.log('  - Target sample rate:', this.targetSampleRate);
      
      return true;

    } catch (error) {
      console.error('Error starting audio capture:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      return false;
    }
  }

  /**
   * Send a command to the server
   */
  sendCommand(type, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  /**
   * Request UMAP training
   */
  requestTraining() {
    this.sendCommand('train');
  }

  /**
   * Reset visualization
   */
  reset(resetUmap = true) {
    this.sendCommand('reset', { reset_umap: resetUmap });
  }

  /**
   * Get current status
   */
  requestStatus() {
    this.sendCommand('status');
  }

  /**
   * Stop audio capture
   */
  stopAudioCapture() {
    console.log('Stopping audio capture...');
    
    this.isCapturing = false;

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch (e) {}
      this.processor = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log('✓ Audio track stopped:', track.label);
      });
      this.mediaStream = null;
    }

    console.log('✓ Audio capture stopped');
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.stopAudioCapture();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    console.log('✓ Visualization service disconnected');
  }

  /**
   * Set callback for visualization frames
   */
  onFrame(callback) {
    this.onFrameCallback = callback;
  }

  /**
   * Set callback for status updates
   */
  onStatus(callback) {
    this.onStatusCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback) {
    this.onErrorCallback = callback;
  }
}

export default VisualizationService;
