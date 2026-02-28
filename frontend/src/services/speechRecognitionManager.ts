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
  private autoRestartEnabled = true;
  private restartTimeoutId: NodeJS.Timeout | null = null;

  private config: SpeechRecognitionConfig = {
    language: 'pa-IN',
    continuous: true,
    interimResults: true,
    maxNoSpeechErrors: 3,
    restartDelay: 800,
    voiceThreshold: 0.15  // Increased from 0.1 to 0.15 for better voice detection
  };

  constructor() {
    this.initializeAudioDetection();
  }

  private async ensureAudioDetectionInitialized(): Promise<void> {
    try {
      await audioDetectionService.initialize();
      audioDetectionService.setThreshold(this.config.voiceThreshold);
      await audioDetectionService.resume();
    } catch (error) {
      console.error('[SpeechManager] Failed to ensure audio detection:', error);
    }
  }

  private async initializeAudioDetection(): Promise<void> {
    await this.ensureAudioDetectionInitialized();
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

    if (!this.autoRestartEnabled) {
      console.log('[SpeechManager] Auto-restart disabled, not handling no-speech error');
      return;
    }

    if (this.noSpeechErrorCount >= this.config.maxNoSpeechErrors) {
      console.log('[SpeechManager] Max no-speech errors reached, waiting for voice');
      // Stop recognition immediately to prevent any more results
      if (this.recognition) {
        this.recognition.abort();
      }
      this.emitMaxEndsReached();
      this.startWaitingForVoice();
    } else {
      console.log('[SpeechManager] No-speech error, scheduling restart');
      this.setState(SpeechState.WAITING_FOR_VOICE);
      this.scheduleRestart();
    }
  }

  private handleOtherError(): void {
    // Reset no-speech counter for other types of errors
    this.noSpeechErrorCount = 0;
    this.emitNoSpeechCount(this.noSpeechErrorCount);

    if (!this.isManuallyStoppedRef && this.autoRestartEnabled) {
      console.log('[SpeechManager] Handling other error, scheduling restart');
      this.setState(SpeechState.WAITING_FOR_VOICE);
      this.scheduleRestart();
    } else {
      console.log('[SpeechManager] Other error ignored - manually stopped or auto-restart disabled');
    }
  }

  private handleNaturalEnd(): void {
    if (!this.isManuallyStoppedRef && this.autoRestartEnabled) {
      console.log('[SpeechManager] Handling natural end, scheduling restart');
      this.setState(SpeechState.WAITING_FOR_VOICE);
      this.scheduleRestart();
    } else {
      console.log('[SpeechManager] Natural end ignored - manually stopped or auto-restart disabled');
    }
  }

  private scheduleRestart(): void {
    // Clear any existing restart timeout
    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }

    // Only schedule restart if auto-restart is enabled
    if (!this.autoRestartEnabled) {
      console.log('[SpeechManager] Auto-restart disabled, not scheduling restart');
      return;
    }

    this.restartTimeoutId = setTimeout(() => {
      if (!this.isManuallyStoppedRef && this.currentState === SpeechState.WAITING_FOR_VOICE && this.autoRestartEnabled) {
        console.log('[SpeechManager] Scheduled restart executing');
        this.start();
      } else {
        console.log('[SpeechManager] Scheduled restart cancelled - manually stopped, state changed, or auto-restart disabled');
      }
      this.restartTimeoutId = null;
    }, this.config.restartDelay);
  }

  private startWaitingForVoice(): void {
    this.setState(SpeechState.WAITING_FOR_VOICE);

    // Only start voice detection if auto-restart is enabled
    if (!this.autoRestartEnabled) {
      console.log('[SpeechManager] Auto-restart disabled, not starting voice detection');
      return;
    }

    audioDetectionService.startDetection(() => {
      console.log('[SpeechManager] Voice detected, restarting recognition');
      audioDetectionService.stopDetection();
      this.noSpeechErrorCount = 0; // Reset counter when voice is detected
      this.emitNoSpeechCount(this.noSpeechErrorCount);

      // Only restart if auto-restart is still enabled
      if (this.autoRestartEnabled) {
        this.start();
      }
    });
  }

  start(): void {
    // Enable auto-restart when starting
    this.autoRestartEnabled = true;

    // Always create a fresh recognition instance to avoid state issues
    if (!this.initialize()) return;

    try {
      this.ensureAudioDetectionInitialized(); // Fire and forget re-initialization
      this.recognition!.start();
      console.log('[SpeechManager] Starting recognition');
    } catch (error) {
      console.log('[SpeechManager] Recognition already running or error starting');
      // If start fails, try again after a short delay with a fresh instance
      if (this.autoRestartEnabled) {
        setTimeout(() => {
          if (!this.isManuallyStoppedRef && this.autoRestartEnabled) {
            this.initialize();
            try {
              this.recognition!.start();
            } catch (retryError) {
              console.log('[SpeechManager] Retry failed, will try again later');
              // Schedule another restart attempt if auto-restart is enabled
              if (this.autoRestartEnabled) {
                this.setState(SpeechState.WAITING_FOR_VOICE);
                this.scheduleRestart();
              }
            }
          }
        }, 500);
      }
    }
  }

  stop(): void {
    this.isManuallyStoppedRef = true;
    this.autoRestartEnabled = false; // Disable auto-restart when manually stopped

    // Clear any pending restart timeouts
    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }

    audioDetectionService.stopDetection();

    if (this.recognition) {
      this.recognition.abort();
    }

    this.setState(SpeechState.STOPPED);
    console.log('[SpeechManager] Manually stopped recognition');
  }

  returnToLoadingOverlay(): void {
    console.log('[SpeechManager] Returning to loading overlay');
    // Don't call stop() as it disables auto-restart
    this.isManuallyStoppedRef = false;
    this.autoRestartEnabled = true;

    // Clear any pending restart timeouts
    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }

    audioDetectionService.stopDetection();

    if (this.recognition) {
      this.recognition.abort();
    }

    this.ensureAudioDetectionInitialized();
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

  // Method to control auto-restart behavior
  setAutoRestart(enabled: boolean): void {
    this.autoRestartEnabled = enabled;
    console.log('[SpeechManager] Auto-restart', enabled ? 'enabled' : 'disabled');

    if (!enabled) {
      // Clear any pending restart timeouts
      if (this.restartTimeoutId) {
        clearTimeout(this.restartTimeoutId);
        this.restartTimeoutId = null;
      }
      audioDetectionService.stopDetection();
    }
  }

  // Method to check if auto-restart is enabled
  isAutoRestartEnabled(): boolean {
    return this.autoRestartEnabled;
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
    this.autoRestartEnabled = false;

    // Clear any pending restart timeouts
    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }

    this.stop();
    audioDetectionService.cleanup();
    this.eventListeners = {};
    console.log('[SpeechManager] Cleaned up');
  }
}

export const speechRecognitionManager = new SpeechRecognitionManager();