class AudioService {
  constructor() {
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.frequencyArray = null;
    this.timeDomainArray = null;
    this.animationFrame = null;
    this.onAudioRecorded = null;
    this.onAudioLevel = null;
    this.onAnalysis = null;
  }

  async startRecording(onRecorded, onLevel, onAnalysis) {
    try {
      this.onAudioRecorded = onRecorded;
      this.onAudioLevel = onLevel;
      this.onAnalysis = onAnalysis;

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
      if (onLevel || onAnalysis) {
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

      this.analyser.fftSize = 512;
      this.frequencyArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeDomainArray = new Uint8Array(this.analyser.fftSize);

      source.connect(this.analyser);

      this.startAudioLevelMonitoring();
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
    }
  }

  startAudioLevelMonitoring() {
    if (!this.analyser) return;

    const monitorLevel = () => {
      if (!this.analyser) return;

      if (this.frequencyArray) {
        this.analyser.getByteFrequencyData(this.frequencyArray);
      }
      if (this.timeDomainArray) {
        this.analyser.getByteTimeDomainData(this.timeDomainArray);
      }

      // Calculate average level
      let level = 0;
      if (this.frequencyArray && this.frequencyArray.length) {
        let sum = 0;
        for (let i = 0; i < this.frequencyArray.length; i++) {
          sum += this.frequencyArray[i];
        }
        const average = sum / this.frequencyArray.length;
        level = average / 255; // Normalize to 0-1
      }

      if (this.onAudioLevel && typeof level === 'number') {
        this.onAudioLevel(level);
      }

      if (this.onAnalysis && this.timeDomainArray && this.frequencyArray) {
        const waveformPoints = [];
        const samplePoints = 64;
        const step = Math.max(1, Math.floor(this.timeDomainArray.length / samplePoints));
        let maxAmplitude = 0;

        for (let i = 0; i < samplePoints; i++) {
          const sample = (this.timeDomainArray[i * step] - 128) / 128;
          waveformPoints.push(sample);
          maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
        }

        let peakIndex = 0;
        let peakValue = 0;
        for (let i = 0; i < this.frequencyArray.length; i++) {
          if (this.frequencyArray[i] > peakValue) {
            peakValue = this.frequencyArray[i];
            peakIndex = i;
          }
        }

        const nyquist = (this.audioContext?.sampleRate || 44100) / 2;
        const peakFrequency = peakIndex ? (peakIndex / this.frequencyArray.length) * nyquist : 0;
        const wavelength = peakFrequency > 0 ? 343 / peakFrequency : 0;

        this.onAnalysis({
          wavePoints: waveformPoints,
          amplitude: maxAmplitude,
          frequency: Math.round(peakFrequency),
          wavelength,
          level,
        });
      }

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
    this.frequencyArray = null;
    this.timeDomainArray = null;
    this.mediaRecorder = null;
    this.onAnalysis = null;
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
