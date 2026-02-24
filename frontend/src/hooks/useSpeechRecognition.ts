import { useState, useEffect, useCallback, useRef } from 'react';
import { speechRecognitionManager } from '../services/speechRecognitionManager';
import { SpeechState, SpeechRecognitionResult } from '../types/speechRecognition';
import { useSacredWordDetection } from './useSacredWordDetection';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcribedText: string;
  interimTranscript: string;
  rawTranscribedText: string;
  rawInterimTranscript: string;
  error: string;
  noSpeechCount: number;
  speechState: SpeechState;
  volume: number;
  start: () => void;
  stop: () => void;
  returnToLoadingOverlay: () => void;
  resetTranscription: () => void;
  setAutoRestart: (enabled: boolean) => void;
  isAutoRestartEnabled: boolean;
  sacredWordOverlay: {
    isVisible: boolean;
    sacredWord: string;
  };
  shouldResetSearch: boolean;
  clearResetFlag: () => void;
  clearSacredWordTracking: () => void;
}

export function useSpeechRecognition(isDisplayingResults: boolean = false): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [rawTranscribedText, setRawTranscribedText] = useState('');
  const [rawInterimTranscript, setRawInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [noSpeechCount, setNoSpeechCount] = useState(0);
  const [speechState, setSpeechState] = useState<SpeechState>(SpeechState.IDLE);
  const [volume, setVolume] = useState(0);
  const [isAutoRestartEnabled, setIsAutoRestartEnabledState] = useState(true);

  const volumeUpdateRef = useRef<number | null>(null);

  // Use refs to track current state values for the callback
  const transcribedTextRef = useRef('');
  const interimTranscriptRef = useRef('');
  const rawTranscribedTextRef = useRef('');
  const rawInterimTranscriptRef = useRef('');

  // Initialize sacred word detection hook
  const { detectInTranscript, overlayState, shouldResetSearch, clearResetFlag, clearTrackingData } = useSacredWordDetection();

  // Create a stable ref for detectInTranscript to prevent recreating handleResult
  const detectInTranscriptRef = useRef(detectInTranscript);
  useEffect(() => {
    detectInTranscriptRef.current = detectInTranscript;
  }, [detectInTranscript]);

  // Update refs when state changes
  useEffect(() => {
    transcribedTextRef.current = transcribedText;
  }, [transcribedText]);

  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  useEffect(() => {
    rawTranscribedTextRef.current = rawTranscribedText;
  }, [rawTranscribedText]);

  useEffect(() => {
    rawInterimTranscriptRef.current = rawInterimTranscript;
  }, [rawInterimTranscript]);


  // Create stable callback for result handling using refs to avoid recreating
  const handleResult = useCallback((result: SpeechRecognitionResult) => {
    if (result.isFinal) {
      const combinedText = (rawTranscribedTextRef.current + ' ' + result.transcript).trim();
      const detection = detectInTranscriptRef.current(combinedText, 'general', isDisplayingResults);

      console.log('[SpeechRecognition] Final result processed, filtered transcript:', detection.filteredTranscript);

      setTranscribedText(detection.filteredTranscript);
      setRawTranscribedText(combinedText);
      setInterimTranscript('');
      setRawInterimTranscript('');
    } else {
      const combinedText = (rawTranscribedTextRef.current + ' ' + result.transcript).trim();
      const detection = detectInTranscriptRef.current(combinedText, 'general', isDisplayingResults);

      // Raw interim is just the current result transcript
      setRawInterimTranscript(result.transcript.trim());

      // Filtered interim calculation:
      // We take the full filtered text and subtract the already-filtered transcribed text
      const filteredInterim = detection.filteredTranscript.substring(transcribedTextRef.current.length).trim();
      setInterimTranscript(filteredInterim);
    }
  }, [isDisplayingResults]); // Only depend on isDisplayingResults, use ref for detectInTranscript

  // Create a stable result handler ref that gets updated
  const handleResultRef = useRef(handleResult);
  useEffect(() => {
    handleResultRef.current = handleResult;
  }, [handleResult]);

  // Initialize speech recognition manager - only run once on mount
  useEffect(() => {
    const initialized = speechRecognitionManager.initialize();
    if (!initialized) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    // Enable auto-restart by default
    speechRecognitionManager.setAutoRestart(true);

    // Set up event listeners with stable handlers
    speechRecognitionManager.on('stateChange', (state) => {
      setSpeechState(state);
      setIsListening(state === SpeechState.LISTENING);

      // Clear error when successfully listening
      if (state === SpeechState.LISTENING) {
        setError('');
      }
    });

    speechRecognitionManager.on('result', (result: SpeechRecognitionResult) => {
      handleResultRef.current(result);
    });

    speechRecognitionManager.on('error', (errorMessage) => {
      setError(errorMessage);
    });

    speechRecognitionManager.on('noSpeechCount', (count) => {
      setNoSpeechCount(count);
    });

    speechRecognitionManager.on('maxEndsReached', () => {
      // Immediately and aggressively clear all transcription when max ends reached
      setTranscribedText('');
      setInterimTranscript('');
      setRawTranscribedText('');
      setRawInterimTranscript('');
      setError('');

      // Force a synchronous clear by using a timeout to ensure state updates
      setTimeout(() => {
        setTranscribedText('');
        setInterimTranscript('');
        setRawTranscribedText('');
        setRawInterimTranscript('');
      }, 0);
    });

    // Start volume monitoring
    const updateVolume = () => {
      const currentVolume = speechRecognitionManager.getCurrentVolume();
      setVolume(currentVolume);
      volumeUpdateRef.current = requestAnimationFrame(updateVolume);
    };
    updateVolume();

    return () => {
      if (volumeUpdateRef.current) {
        cancelAnimationFrame(volumeUpdateRef.current);
      }
      speechRecognitionManager.cleanup();
    };
  }, []); // No dependencies to prevent re-initialization

  const start = useCallback(() => {
    speechRecognitionManager.start();
  }, []);

  const stop = useCallback(() => {
    speechRecognitionManager.stop();
  }, []);

  const returnToLoadingOverlay = useCallback(() => {
    speechRecognitionManager.returnToLoadingOverlay();
  }, []);

  const resetTranscription = useCallback(() => {
    setTranscribedText('');
    setInterimTranscript('');
    setRawTranscribedText('');
    setRawInterimTranscript('');
    setError('');
    setNoSpeechCount(0);
  }, []);

  const setAutoRestart = useCallback((enabled: boolean) => {
    speechRecognitionManager.setAutoRestart(enabled);
    setIsAutoRestartEnabledState(enabled);
  }, []);

  // Update auto-restart state when speech recognition manager changes
  useEffect(() => {
    const checkAutoRestart = () => {
      const enabled = speechRecognitionManager.isAutoRestartEnabled();
      setIsAutoRestartEnabledState(enabled);
    };

    // Check initially and set up periodic check
    checkAutoRestart();
    const interval = setInterval(checkAutoRestart, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    isListening,
    transcribedText,
    interimTranscript,
    rawTranscribedText,
    rawInterimTranscript,
    error,
    noSpeechCount,
    speechState,
    volume,
    start,
    stop,
    returnToLoadingOverlay,
    resetTranscription,
    setAutoRestart,
    isAutoRestartEnabled,
    sacredWordOverlay: overlayState,
    shouldResetSearch,
    clearResetFlag,
    clearSacredWordTracking: clearTrackingData
  };
}