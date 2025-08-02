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

    this.setupRecognitionHandlers();
    console.log('[SpeechManager] Initialized successfully');
    return true;
  }

  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;

    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;

    this.recognition.onstart = () => {
      console.log('[SpeechManager] Recognition started');
      this.setState(SpeechState.LISTENING);
      this.isManuallyStoppedRef = false;
    };

    this.recognition.onresult = (event) => {
      let transcript = '';
      let interim = '';
      let maxConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0];
        const confidence = result.confidence || 0;

        if (event.results[i].isFinal) {
          transcript += result.transcript;
          maxConfidence = Math.max(maxConfidence, confidence);
        } else {
          interim += result.transcript;
        }
      }

      // Emit results for both final and interim
      if (transcript) {
        this.emitResult({ transcript, confidence: maxConfidence, isFinal: true });
      }
      if (interim) {
        this.emitResult({ transcript: interim, confidence: 0, isFinal: false });
      }
    };

    this.recognition.onerror = (event) => {
      console.log('[SpeechManager] Recognition error:', event.error);

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