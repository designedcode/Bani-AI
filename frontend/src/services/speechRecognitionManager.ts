import {
  SpeechState,
  SpeechRecognitionResult,
  SpeechRecognitionConfig,
  SpeechRecognitionEvents
} from '../types/speechRecognition';
import { audioDetectionService } from './audioDetectionService';

class SpeechRecognitionManager {
  private recognition: SpeechRecognition | null = null;
  private currentState: SpeechState = SpeechState.IDLE;
  private noSpeechErrorCount = 0;
  private isManuallyStoppedRef = false;
  private eventListeners: Partial<SpeechRecognitionEvents> = {};

  private config: SpeechRecognitionConfig = {
    language: 'pa-IN',
    continuous: true,
    interimResults: true,
    maxNoSpeechErrors: 3,
    restartDelay: 800,
    voiceThreshold: 0.1
  };

  // Mobile-specific config that matches working test page
  private getMobileConfig() {
    return {
      language: 'pa-IN', // Keep Punjabi since it's supported
      continuous: true,   // Match working test page
      interimResults: true,
      maxNoSpeechErrors: 1, // Lower threshold for mobile
      restartDelay: 1000,
      voiceThreshold: 0.1
    };
  }

  // Mobile-specific configuration
  private isMobileChrome(): boolean {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
    return isMobile && isChrome;
  }

  private checkHTTPS(): boolean {
    return window.location.protocol === 'https:';
  }

  // Mobile-specific initialization that waits for user interaction
  initializeForMobile(): boolean {
    if (!this.isMobileChrome()) {
      return this.initialize();
    }

    console.log('[SpeechManager] Mobile Chrome detected, using mobile initialization');
    
    // For mobile Chrome, we need to wait for user interaction
    if (!this.checkHTTPS()) {
      this.emitError('Web Speech API requires HTTPS on mobile devices');
      return false;
    }

    // Clean up existing recognition
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        // Ignore errors when aborting
      }
      this.recognition = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Mobile Chrome specific configuration - match working test page
    console.log('[SpeechManager] Mobile Chrome detected, applying mobile-specific config');
    const mobileConfig = this.getMobileConfig();
    this.config.continuous = mobileConfig.continuous;
    this.config.language = mobileConfig.language;
    this.config.maxNoSpeechErrors = mobileConfig.maxNoSpeechErrors;
    this.config.restartDelay = mobileConfig.restartDelay;

    this.setupRecognitionHandlers();
    console.log('[SpeechManager] Mobile initialization completed');
    return true;
  }

  // Mobile-specific start method that matches working test page exactly
  startForMobile(): void {
    if (!this.isMobileChrome()) {
      this.start();
      return;
    }

    console.log('[SpeechManager] Mobile Chrome start requested - using simplified approach');
    
    // Clean up existing recognition
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        // Ignore errors when aborting
      }
      this.recognition = null;
    }

    // Create fresh recognition instance like test page
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Set configuration exactly like working test page
    this.recognition.lang = 'pa-IN';
    this.recognition.interimResults = true;
    this.recognition.continuous = true;
    
    // Set up simple event handlers like test page
    this.recognition.onstart = () => {
      console.log('[SpeechManager] Mobile recognition started');
      this.setState(SpeechState.LISTENING);
      this.isManuallyStoppedRef = false;
    };
    
    this.recognition.onresult = (event) => {
      console.log('[SpeechManager] Mobile result received:', event.results.length, 'results');
      
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      
      if (transcript) {
        console.log('[SpeechManager] Mobile final transcript:', transcript);
        this.emitResult({ transcript, confidence: 0.8, isFinal: true });
      }
    };
    
    this.recognition.onend = () => {
      console.log('[SpeechManager] Mobile recognition ended');
      this.setState(SpeechState.STOPPED);
      this.recognition = null;
    };
    
    this.recognition.onerror = (event) => {
      console.log('[SpeechManager] Mobile recognition error:', event.error);
      this.emitError(`Speech recognition error: ${event.error}`);
      this.setState(SpeechState.STOPPED);
    };
    
    // Start recognition
    try {
      console.log('[SpeechManager] Starting mobile Chrome recognition');
      this.recognition.start();
    } catch (error) {
      console.log('[SpeechManager] Mobile Chrome start failed:', error);
      this.emitError('Failed to start speech recognition on mobile. Please check microphone permissions.');
    }
  }

  constructor() {
    this.initializeAudioDetection();
  }

  private async initializeAudioDetection(): Promise<void> {
    try {
      await audioDetectionService.initialize();
      audioDetectionService.setThreshold(this.config.voiceThreshold);
    } catch (error) {
      console.error('[SpeechManager] Failed to initialize audio detection:', error);
    }
  }

  initialize(): boolean {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      this.emitError('Speech recognition not supported in this browser');
      return false;
    }

    // Check HTTPS requirement for mobile
    if (this.isMobileChrome() && !this.checkHTTPS()) {
      this.emitError('Web Speech API requires HTTPS on mobile devices');
      return false;
    }

    // Clean up existing recognition
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        // Ignore errors when aborting
      }
      this.recognition = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Mobile Chrome specific configuration - match working test page
    if (this.isMobileChrome()) {
      console.log('[SpeechManager] Mobile Chrome detected, applying mobile-specific config');
      const mobileConfig = this.getMobileConfig();
      this.config.continuous = mobileConfig.continuous;
      this.config.language = mobileConfig.language;
      this.config.maxNoSpeechErrors = mobileConfig.maxNoSpeechErrors;
      this.config.restartDelay = mobileConfig.restartDelay;
    }

    this.setupRecognitionHandlers();
    console.log('[SpeechManager] Initialized successfully');
    return true;
  }

  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;

    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;

    // Mobile Chrome specific error handling
    this.recognition.onstart = () => {
      console.log('[SpeechManager] Recognition started - mobile Chrome:', this.isMobileChrome());
      this.setState(SpeechState.LISTENING);
      this.isManuallyStoppedRef = false;
    };

    this.recognition.onresult = (event) => {
      console.log('[SpeechManager] Result received:', event.results.length, 'results');
      
      let transcript = '';
      let interim = '';
      let maxConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0];
        const confidence = result.confidence || 0;
        console.log('[SpeechManager] Result:', result.transcript, 'confidence:', confidence, 'isFinal:', event.results[i].isFinal);

        if (event.results[i].isFinal) {
          transcript += result.transcript;
          maxConfidence = Math.max(maxConfidence, confidence);
        } else {
          interim += result.transcript;
        }
      }

      // Emit results for both final and interim
      if (transcript) {
        console.log('[SpeechManager] Emitting final transcript:', transcript);
        this.emitResult({ transcript, confidence: maxConfidence, isFinal: true });
      }
      if (interim) {
        console.log('[SpeechManager] Emitting interim transcript:', interim);
        this.emitResult({ transcript: interim, confidence: 0, isFinal: false });
      }
    };

    this.recognition.onerror = (event) => {
      console.log('[SpeechManager] Recognition error:', event.error, '- mobile Chrome:', this.isMobileChrome());

      // Mobile Chrome specific error handling - simplified like test page
      if (this.isMobileChrome()) {
        if (event.error === 'not-allowed') {
          this.emitError('Microphone permission denied. Please enable microphone access in browser settings.');
          this.setState(SpeechState.STOPPED);
          return;
        } else if (event.error === 'network') {
          this.emitError('Network error. Please check your internet connection.');
          this.setState(SpeechState.STOPPED);
          return;
        } else if (event.error === 'no-speech') {
          // For mobile, just stop on no-speech (like test page)
          console.log('[SpeechManager] Mobile Chrome no-speech error - stopping');
          this.setState(SpeechState.STOPPED);
          return;
        }
      }

      if (event.error === 'no-speech') {
        this.handleNoSpeechError();
      } else if (event.error === 'aborted') {
        this.isManuallyStoppedRef = true;
        this.setState(SpeechState.STOPPED);
      } else {
        this.emitError(`Speech recognition error: ${event.error}`);
        this.handleOtherError();
      }
    };

    this.recognition.onend = () => {
      console.log('[SpeechManager] Recognition ended - manually stopped:', this.isManuallyStoppedRef, 'current state:', this.currentState);

      if (!this.isManuallyStoppedRef) {
        if (this.currentState === SpeechState.LISTENING) {
          console.log('[SpeechManager] Natural end detected, scheduling restart');
          this.handleNaturalEnd();
        } else {
          console.log('[SpeechManager] Recognition ended but not in listening state, ignoring');
        }
      } else {
        console.log('[SpeechManager] Recognition ended due to manual stop');
        this.setState(SpeechState.STOPPED);
      }
    };
  }

  private handleNoSpeechError(): void {
    this.noSpeechErrorCount++;
    console.log(`[SpeechManager] No speech error #${this.noSpeechErrorCount}`);

    this.emitNoSpeechCount(this.noSpeechErrorCount);

    if (this.noSpeechErrorCount >= this.config.maxNoSpeechErrors) {
      console.log('[SpeechManager] Max no-speech errors reached, waiting for voice');
      // Stop recognition immediately to prevent any more results
      if (this.recognition) {
        this.recognition.abort();
      }
      this.emitMaxEndsReached();
      this.startWaitingForVoice();
    } else {
      this.setState(SpeechState.WAITING_FOR_VOICE);
      this.scheduleRestart();
    }
  }

  private handleOtherError(): void {
    // Reset no-speech counter for other types of errors
    this.noSpeechErrorCount = 0;
    this.emitNoSpeechCount(this.noSpeechErrorCount);

    if (!this.isManuallyStoppedRef) {
      this.setState(SpeechState.WAITING_FOR_VOICE);
      this.scheduleRestart();
    }
  }

  private handleNaturalEnd(): void {
    if (!this.isManuallyStoppedRef) {
      this.setState(SpeechState.WAITING_FOR_VOICE);
      this.scheduleRestart();
    }
  }

  private scheduleRestart(): void {
    setTimeout(() => {
      if (!this.isManuallyStoppedRef && this.currentState === SpeechState.WAITING_FOR_VOICE) {
        console.log('[SpeechManager] Scheduled restart executing');
        this.start();
      } else {
        console.log('[SpeechManager] Scheduled restart cancelled - manually stopped or state changed');
      }
    }, this.config.restartDelay);
  }

  private startWaitingForVoice(): void {
    this.setState(SpeechState.WAITING_FOR_VOICE);

    audioDetectionService.startDetection(() => {
      console.log('[SpeechManager] Voice detected, restarting recognition');
      audioDetectionService.stopDetection();
      this.noSpeechErrorCount = 0; // Reset counter when voice is detected
      this.emitNoSpeechCount(this.noSpeechErrorCount);
      this.start();
    });
  }

  start(): void {
    // Always create a fresh recognition instance to avoid state issues
    if (!this.initialize()) return;

    // Mobile Chrome specific startup sequence
    if (this.isMobileChrome()) {
      console.log('[SpeechManager] Mobile Chrome detected, using mobile startup sequence');
      // For mobile Chrome, we need to ensure proper initialization
      setTimeout(() => {
        if (!this.isManuallyStoppedRef) {
          try {
            this.recognition!.start();
            console.log('[SpeechManager] Mobile Chrome recognition started');
          } catch (error) {
            console.log('[SpeechManager] Mobile Chrome start failed:', error);
            this.emitError('Failed to start speech recognition on mobile. Please check microphone permissions.');
          }
        }
      }, 100);
      return;
    }

    try {
      this.recognition!.start();
      console.log('[SpeechManager] Starting recognition');
    } catch (error) {
      console.log('[SpeechManager] Recognition already running or error starting');
      // If start fails, try again after a short delay with a fresh instance
      setTimeout(() => {
        if (!this.isManuallyStoppedRef) {
          this.initialize();
          try {
            this.recognition!.start();
          } catch (retryError) {
            console.log('[SpeechManager] Retry failed, will try again later');
          }
        }
      }, 500);
    }
  }

  stop(): void {
    this.isManuallyStoppedRef = true;
    audioDetectionService.stopDetection();

    if (this.recognition) {
      this.recognition.abort();
    }

    this.setState(SpeechState.STOPPED);
    console.log('[SpeechManager] Manually stopped recognition');
  }

  returnToLoadingOverlay(): void {
    console.log('[SpeechManager] Returning to loading overlay');
    this.stop();
    this.startWaitingForVoice();
  }

  private setState(newState: SpeechState): void {
    if (this.currentState !== newState) {
      console.log(`[SpeechManager] State change: ${this.currentState} -> ${newState}`);
      this.currentState = newState;
      this.emitStateChange(newState);
    }
  }

  getState(): SpeechState {
    return this.currentState;
  }

  getCurrentVolume(): number {
    return audioDetectionService.getCurrentVolume();
  }

  // Event management
  on<K extends keyof SpeechRecognitionEvents>(
    event: K,
    listener: SpeechRecognitionEvents[K]
  ): void {
    this.eventListeners[event] = listener;
  }

  off<K extends keyof SpeechRecognitionEvents>(event: K): void {
    delete this.eventListeners[event];
  }

  private emitStateChange(state: SpeechState): void {
    this.eventListeners.stateChange?.(state);
  }

  private emitResult(result: SpeechRecognitionResult): void {
    // Don't emit results if we've reached max no-speech errors and are waiting for voice
    if (this.noSpeechErrorCount >= this.config.maxNoSpeechErrors) {
      return;
    }
    this.eventListeners.result?.(result);
  }

  private emitError(error: string): void {
    this.eventListeners.error?.(error);
  }

  private emitNoSpeechCount(count: number): void {
    this.eventListeners.noSpeechCount?.(count);
  }

  private emitMaxEndsReached(): void {
    this.eventListeners.maxEndsReached?.();
  }

  cleanup(): void {
    this.stop();
    audioDetectionService.cleanup();
    this.eventListeners = {};
    console.log('[SpeechManager] Cleaned up');
  }
}

export const speechRecognitionManager = new SpeechRecognitionManager();