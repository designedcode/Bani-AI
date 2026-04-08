import { useState, useEffect, useCallback, useRef } from 'react';
import { speechRecognitionManager } from '../services/speechRecognitionManager';
import { SpeechState, SpeechRecognitionResult } from '../types/speechRecognition';
import { useSacredWordDetection } from './useSacredWordDetection';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcribedText: string;
  interimTranscript: string;
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
  sacredWordOverlay: { isVisible: boolean; sacredWord: string; key: number };
}

export function useSpeechRecognition(isDisplayingResults: boolean = false): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [noSpeechCount, setNoSpeechCount] = useState(0);
  const [speechState, setSpeechState] = useState<SpeechState>(SpeechState.IDLE);
  const [volume, setVolume] = useState(0);
  const [isAutoRestartEnabled, setIsAutoRestartEnabledState] = useState(true);
  const volumeUpdateRef = useRef<number | null>(null);

  // Accumulate clean Bani text in a ref — synchronous, never stale
  const accumulatedTextRef = useRef('');

  const { processSpeech, overlayState, reset: resetDetection } = useSacredWordDetection(isDisplayingResults);
  const processSpeechRef = useRef(processSpeech);
  useEffect(() => { processSpeechRef.current = processSpeech; }, [processSpeech]);

  const handleResult = useCallback((result: SpeechRecognitionResult) => {
    if (result.isFinal) {
      // Filter sacred words + trigger overlay detection
      const filtered = processSpeechRef.current(result.transcript.trim(), true);

      console.log('[SR] Final:', result.transcript.trim());
      console.log('[SR] Filtered:', filtered);

      if (filtered.trim()) {
        const prev = accumulatedTextRef.current;
        const combined = prev ? (prev + ' ' + filtered).trim() : filtered.trim();
        // Cap at last 30 words — BaniCore uses last 4 for display, 8 for search
        const words = combined.split(/\s+/).filter(Boolean);
        const capped = words.slice(-30).join(' ');
        accumulatedTextRef.current = capped;
        setTranscribedText(capped);
      }
      setInterimTranscript('');
    } else {
      // Filter sacred words + trigger overlay detection for interim
      const filtered = processSpeechRef.current(result.transcript.trim(), false);
      setInterimTranscript(filtered);
    }
  }, []);

  const handleResultRef = useRef(handleResult);
  useEffect(() => { handleResultRef.current = handleResult; }, [handleResult]);

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

    speechRecognitionManager.on('error', (msg) => setError(msg));
    speechRecognitionManager.on('noSpeechCount', (count) => setNoSpeechCount(count));

    speechRecognitionManager.on('maxEndsReached', () => {
      accumulatedTextRef.current = '';
      setTranscribedText('');
      setInterimTranscript('');
      setError('');
      setTimeout(() => {
        accumulatedTextRef.current = '';
        setTranscribedText('');
        setInterimTranscript('');
      }, 0);
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
  }, []);

  const start = useCallback(() => speechRecognitionManager.start(), []);
  const stop = useCallback(() => speechRecognitionManager.stop(), []);
  const returnToLoadingOverlay = useCallback(() => speechRecognitionManager.returnToLoadingOverlay(), []);

  const resetTranscription = useCallback(() => {
    accumulatedTextRef.current = '';
    setTranscribedText('');
    setInterimTranscript('');
    setError('');
    setNoSpeechCount(0);
    resetDetection();
  }, [resetDetection]);

  const setAutoRestart = useCallback((enabled: boolean) => {
    speechRecognitionManager.setAutoRestart(enabled);
    setIsAutoRestartEnabledState(enabled);
  }, []);

  useEffect(() => {
    const check = () => setIsAutoRestartEnabledState(speechRecognitionManager.isAutoRestartEnabled());
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    isListening,
    transcribedText,
    interimTranscript,
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