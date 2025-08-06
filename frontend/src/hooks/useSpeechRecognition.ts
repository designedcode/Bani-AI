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
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [noSpeechCount, setNoSpeechCount] = useState(0);
  const [speechState, setSpeechState] = useState<SpeechState>(SpeechState.IDLE);
  const [volume, setVolume] = useState(0);

  const volumeUpdateRef = useRef<number | null>(null);
  
  // Use refs to track current state values for the callback
  const transcribedTextRef = useRef('');
  const interimTranscriptRef = useRef('');

  // Initialize sacred word detection hook
  const { detectInTranscript } = useSacredWordDetection();

  // Update refs when state changes
  useEffect(() => {
    transcribedTextRef.current = transcribedText;
  }, [transcribedText]);

  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  // Create stable callback for result handling
  const handleResult = useCallback((result: SpeechRecognitionResult) => {
    console.log('[SpeechRecognition] Processing result:', { 
      transcript: result.transcript, 
      isFinal: result.isFinal,
      currentTranscribed: transcribedTextRef.current,
      currentInterim: interimTranscriptRef.current
    });

    if (result.isFinal) {
      // For final results, only combine previous transcribed text with the final transcript
      // Don't include interim transcript as it's already part of the final transcript
      const combinedText = (transcribedTextRef.current + ' ' + result.transcript).trim();
      const detection = detectInTranscript(combinedText, 'general');

      console.log('[SpeechRecognition] Final - Original transcript:', result.transcript);
      console.log('[SpeechRecognition] Final - Combined text:', combinedText);
      console.log('[SpeechRecognition] Final - Filtered transcript:', detection.filteredTranscript);

      setTranscribedText(detection.filteredTranscript);
      setInterimTranscript('');
    } else {
      // Handle interim results separately
      const combinedText = (transcribedTextRef.current + ' ' + result.transcript).trim();
      const detection = detectInTranscript(combinedText, 'general');

      const filteredInterim = detection.filteredTranscript.substring(transcribedTextRef.current.length).trim();
      
      console.log('[SpeechRecognition] Interim - Original transcript:', result.transcript);
      console.log('[SpeechRecognition] Interim - Combined text:', combinedText);
      console.log('[SpeechRecognition] Interim - Filtered interim:', filteredInterim);
      
      setInterimTranscript(filteredInterim);
    }
  }, [detectInTranscript]);

  // Initialize speech recognition manager
  useEffect(() => {
    const initialized = speechRecognitionManager.initialize();
    if (!initialized) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    // Set up event listeners
    speechRecognitionManager.on('stateChange', (state) => {
      setSpeechState(state);
      setIsListening(state === SpeechState.LISTENING);

      // Clear error when successfully listening
      if (state === SpeechState.LISTENING) {
        setError('');
      }
    });

    speechRecognitionManager.on('result', handleResult);

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
      setError('');

      // Force a synchronous clear by using a timeout to ensure state updates
      setTimeout(() => {
        setTranscribedText('');
        setInterimTranscript('');
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
  }, [handleResult]);

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
    setError('');
    setNoSpeechCount(0);
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
    resetTranscription
  };
}