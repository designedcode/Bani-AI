export enum SpeechState {
  IDLE = 'idle',
  LISTENING = 'listening',
  STOPPED = 'stopped',
  WAITING_FOR_VOICE = 'waiting_for_voice'
}

export enum SpeechEndReason {
  NO_SPEECH = 'no-speech',
  ERROR = 'error',
  MANUAL_STOP = 'manual-stop',
  NATURAL_END = 'natural-end'
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxNoSpeechErrors: number;
  restartDelay: number;
  voiceThreshold: number;
}

export interface SpeechRecognitionEvents {
  stateChange: (state: SpeechState) => void;
  result: (result: SpeechRecognitionResult) => void;
  error: (error: string) => void;
  noSpeechCount: (count: number) => void;
  maxEndsReached: () => void;
}