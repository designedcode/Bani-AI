class AudioDetectionService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private rafId: number | null = null;
  private stream: MediaStream | null = null;

  private isActive = false;
  private threshold = 0.1;
  private debounceTime = 300; // ms
  private lastVoiceTime = 0;
  private voiceDetectedCallback: (() => void) | null = null;

  async initialize(): Promise<void> {
    if (this.audioContext && this.analyser && this.stream) {
      console.log('[AudioDetection] Already initialized');
      return;
    }

    try {
      if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024;
        this.dataArray = new Uint8Array(this.analyser.fftSize);
      }

      if (!this.source && this.stream && this.analyser) {
        this.source = this.audioContext.createMediaStreamSource(this.stream);
        this.source.connect(this.analyser);
      }

      console.log('[AudioDetection] Initialized successfully');
    } catch (error) {
      console.error('[AudioDetection] Failed to initialize:', error);
      throw error;
    }
  }

  startDetection(onVoiceDetected: () => void): void {
    if (!this.analyser || !this.dataArray) {
      console.error('[AudioDetection] Not initialized');
      return;
    }

    this.isActive = true;
    this.voiceDetectedCallback = onVoiceDetected;
    this.detectVoiceActivity();
    console.log('[AudioDetection] Started voice activity detection');
  }

  stopDetection(): void {
    this.isActive = false;
    this.voiceDetectedCallback = null;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    console.log('[AudioDetection] Stopped voice activity detection');
  }

  private detectVoiceActivity = (): void => {
    if (!this.isActive || !this.analyser || !this.dataArray) return;

    (this.analyser as any).getByteTimeDomainData(this.dataArray);

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const val = (this.dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / this.dataArray.length);

    // Check if voice activity detected above threshold
    if (rms > this.threshold) {
      const now = Date.now();

      // Only trigger if enough time has passed since last detection
      if (now - this.lastVoiceTime > this.debounceTime) {
        this.lastVoiceTime = now;
        console.log('[AudioDetection] Voice activity detected, volume:', rms);
        if (this.voiceDetectedCallback) {
          this.voiceDetectedCallback();
        }
      }
    }

    this.rafId = requestAnimationFrame(this.detectVoiceActivity);
  };

  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[AudioDetection] AudioContext resumed');
    }
  }

  getCurrentVolume(): number {
    if (!this.analyser || !this.dataArray) return 0;

    (this.analyser as any).getByteTimeDomainData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const val = (this.dataArray[i] - 128) / 128;
      sum += val * val;
    }
    return Math.sqrt(sum / this.dataArray.length);
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
    console.log('[AudioDetection] Threshold set to:', threshold);
  }

  cleanup(): void {
    this.stopDetection();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.analyser = null;
    this.dataArray = null;
    this.source = null;

    console.log('[AudioDetection] Cleaned up');
  }
}

export const audioDetectionService = new AudioDetectionService();