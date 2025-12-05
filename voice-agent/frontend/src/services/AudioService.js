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
    this.chunks = [];
    this.stream = null;
  }

  // Get supported mime type for MediaRecorder
  getSupportedMimeType() {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav',
      ''  // Empty string uses browser default
    ];

    for (const mimeType of mimeTypes) {
      if (mimeType === '' || MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`Using mime type: ${mimeType || 'browser default'}`);
        return mimeType;
      }
    }
    return '';
  }

  async startRecording(onRecorded, onLevel, onAnalysis) {
    try {
      this.onAudioRecorded = onRecorded;
      this.onAudioLevel = onLevel;
      this.onAnalysis = onAnalysis;
      this.chunks = [];

      console.log('Requesting microphone access...');
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        }
      });

      console.log('Microphone access granted, setting up MediaRecorder...');

      // Get supported mime type
      const mimeType = this.getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      console.log('MediaRecorder created:', {
        mimeType: this.mediaRecorder.mimeType,
        state: this.mediaRecorder.state,
        audioBitsPerSecond: this.mediaRecorder.audioBitsPerSecond
      });

      this.mediaRecorder.ondataavailable = (event) => {
        console.log('Data available event:', {
          size: event.data.size,
          type: event.data.type
        });
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
      };

      this.mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, processing chunks:', {
          chunkCount: this.chunks.length,
          totalSize: this.chunks.reduce((sum, chunk) => sum + chunk.size, 0)
        });

        if (this.chunks.length === 0) {
          console.error('No audio chunks recorded!');
          if (this.onAudioRecorded) {
            this.onAudioRecorded(new Blob([], { type: 'audio/webm' }));
          }
          this.cleanup();
          return;
        }

        // Create blob from recorded chunks
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        
        console.log('Recording stopped, created blob:', {
          size: blob.size,
          type: blob.type,
          chunks: this.chunks.length
        });

        if (this.onAudioRecorded) {
          this.onAudioRecorded(blob);
        }
        this.cleanup();
      };

      // Set up audio analysis for visual feedback
      if (onLevel || onAnalysis) {
        this.setupAudioAnalysis(this.stream);
      }

      console.log('Starting MediaRecorder with timeslice...');
      // Use timeslice to get data periodically (every 250ms)
      // This ensures we get data even for short recordings
      this.mediaRecorder.start(250);
      console.log('MediaRecorder started, state:', this.mediaRecorder.state);

      // Stop recording after max duration
      const maxDuration = parseInt(process.env.REACT_APP_MAX_AUDIO_DURATION || '30') * 1000;
      this.recordingTimeout = setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          console.log('Max duration reached, stopping recording...');
          this.stopRecording();
        }
      }, maxDuration);

    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording() {
    console.log('stopRecording called, current state:', this.mediaRecorder?.state);
    
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // Request any remaining data before stopping
      this.mediaRecorder.requestData();
      
      // Small delay to ensure data is collected
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.mediaRecorder.stop();
      console.log('MediaRecorder stop() called');
    }

    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped:', track.kind);
      });
    }
  }

  setupAudioAnalysis(stream) {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

      // Calculate audio level using waveform amplitude (gives more motion than frequency average)
      let level = 0;
      if (this.timeDomainArray && this.timeDomainArray.length) {
        let sum = 0;
        for (let i = 0; i < this.timeDomainArray.length; i++) {
          const sample = this.timeDomainArray[i] - 128;
          sum += Math.abs(sample);
        }
        const avgAmplitude = sum / this.timeDomainArray.length;
        level = Math.min(1, (avgAmplitude / 128) * 1.5); // normalize and scale for visual punch
      } else if (this.frequencyArray && this.frequencyArray.length) {
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
    console.log('Cleaning up AudioService resources...');
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.frequencyArray = null;
    this.timeDomainArray = null;
    this.mediaRecorder = null;
    this.onAnalysis = null;
    this.chunks = [];
    this.stream = null;
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
