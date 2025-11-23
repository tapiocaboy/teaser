class AudioService {
  constructor() {
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.animationFrame = null;
    this.onAudioRecorded = null;
    this.onAudioLevel = null;
  }

  async startRecording(onRecorded, onLevel) {
    try {
      this.onAudioRecorded = onRecorded;
      this.onAudioLevel = onLevel;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: parseInt(process.env.REACT_APP_AUDIO_SAMPLE_RATE || '16000'),
          channelCount: parseInt(process.env.REACT_APP_AUDIO_CHANNELS || '1'),
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const chunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        console.log('Recording stopped, created blob:', {
          size: blob.size,
          type: blob.type,
          chunks: chunks.length
        });
        if (this.onAudioRecorded) {
          this.onAudioRecorded(blob);
        }
        this.cleanup();
      };

      // Set up audio analysis for visual feedback
      if (onLevel) {
        this.setupAudioAnalysis(stream);
      }

      console.log('Starting MediaRecorder...');
      this.mediaRecorder.start();

      // Stop recording after max duration
      const maxDuration = parseInt(process.env.REACT_APP_MAX_AUDIO_DURATION || '30') * 1000;
      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.stopRecording();
        }
      }, maxDuration);

    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  setupAudioAnalysis(stream) {
    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(stream);

      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      source.connect(this.analyser);

      this.startAudioLevelMonitoring();
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
    }
  }

  startAudioLevelMonitoring() {
    if (!this.analyser || !this.dataArray || !this.onAudioLevel) return;

    const monitorLevel = () => {
      if (!this.analyser || !this.dataArray) return;

      this.analyser.getByteFrequencyData(this.dataArray);

      // Calculate average level
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const average = sum / this.dataArray.length;
      const level = average / 255; // Normalize to 0-1

      this.onAudioLevel(level);

      this.animationFrame = requestAnimationFrame(monitorLevel);
    };

    monitorLevel();
  }

  cleanup() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;
    this.mediaRecorder = null;
  }

  // Convert audio blob to WAV format if needed
  static async convertToWav(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        // For now, return the blob as-is
        // In a production app, you might want to convert to WAV
        resolve(blob);
      };
      reader.readAsArrayBuffer(blob);
    });
  }
}

export default AudioService;
