import { useState, useEffect, useCallback, useRef } from 'react';
import { speechRecognitionManager } from '../services/speechRecognitionManager';
import { SpeechState, SpeechRecognitionResult } from '../types/speechRecognition';
import { useSacredWordDetection } from './useSacredWordDetection';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcribedText: string; // Filtered
  interimTranscript: string; // Filtered
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
    id: number;
  };
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
  const rawTranscribedTextRef = useRef('');

  // Initialize sacred word detection hook
  const { detectNewSegment, clearTrackingData, overlayState } = useSacredWordDetection();

  // Create a stable ref for detectNewSegment to prevent recreating handleResult
  const detectNewSegmentRef = useRef(detectNewSegment);
  useEffect(() => {
    detectNewSegmentRef.current = detectNewSegment;
  }, [detectNewSegment]);

  // Update refs when state changes
  useEffect(() => {
    transcribedTextRef.current = transcribedText;
  }, [transcribedText]);

  useEffect(() => {
    rawTranscribedTextRef.current = rawTranscribedText;
  }, [rawTranscribedText]);

  // Create stable callback for result handling
  const handleResult = useCallback((result: SpeechRecognitionResult) => {
    const detection = detectNewSegmentRef.current(result.transcript, result.isFinal, isDisplayingResults);

    setTranscribedText(detection.filteredFinalTranscript);

    if (result.isFinal) {
      const fullRawTranscript = (rawTranscribedTextRef.current + ' ' + result.transcript).trim();
      setRawTranscribedText(fullRawTranscript);
      setInterimTranscript('');
      setRawInterimTranscript('');
    } else {
      // For interim raw display
      setRawInterimTranscript(result.transcript);
      setInterimTranscript(detection.filteredInterimTranscript);
    }
  }, [isDisplayingResults]);

  // Create a stable result handler ref
  const handleResultRef = useRef(handleResult);
  useEffect(() => {
    handleResultRef.current = handleResult;
  }, [handleResult]);

  const resetTranscription = useCallback(() => {
    setTranscribedText('');
    setInterimTranscript('');
    setRawTranscribedText('');
    setRawInterimTranscript('');
    setError('');
    setNoSpeechCount(0);
    clearTrackingData(); // Step 5: Reset detector
  }, [clearTrackingData]);

  // Initialize speech recognition manager - only run once on mount
  useEffect(() => {
    const initialized = speechRecognitionManager.initialize();
    if (!initialized) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    speechRecognitionManager.setAutoRestart(true);

    speechRecognitionManager.on('stateChange', (state) => {
      setSpeechState(state);
      setIsListening(state === SpeechState.LISTENING);
      if (state === SpeechState.LISTENING) setError('');
    });

    speechRecognitionManager.on('result', (result: SpeechRecognitionResult) => {
      handleResultRef.current(result);
    });

    speechRecognitionManager.on('error', (errorMessage) => setError(errorMessage));
    speechRecognitionManager.on('noSpeechCount', (count) => setNoSpeechCount(count));
    speechRecognitionManager.on('maxEndsReached', () => {
      resetTranscription();
    });

    const updateVolume = () => {
      setVolume(speechRecognitionManager.getCurrentVolume());
      volumeUpdateRef.current = requestAnimationFrame(updateVolume);
    };
    updateVolume();

    return () => {
      if (volumeUpdateRef.current) cancelAnimationFrame(volumeUpdateRef.current);
      speechRecognitionManager.cleanup();
    };
  }, [resetTranscription]);

  const start = useCallback(() => speechRecognitionManager.start(), []);
  const stop = useCallback(() => speechRecognitionManager.stop(), []);
  const returnToLoadingOverlay = useCallback(() => speechRecognitionManager.returnToLoadingOverlay(), []);

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
    sacredWordOverlay: overlayState
  };
}