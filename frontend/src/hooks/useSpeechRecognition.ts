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

  // Initialize sacred word detection hook
  const { detectInTranscript } = useSacredWordDetection();

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

    speechRecognitionManager.on('result', (result: SpeechRecognitionResult) => {
      if (result.isFinal) {
        // For final results, apply filtering to the complete context
        setTranscribedText(prev => {
          const combinedText = (prev + ' ' + interimTranscript + ' ' + result.transcript).trim();
          const detection = detectInTranscript(combinedText, 'general');
          
          console.log('[SpeechRecognition] Original final transcript:', result.transcript);
          console.log('[SpeechRecognition] Combined text:', combinedText);
          console.log('[SpeechRecognition] Filtered final transcript:', detection.filteredTranscript);
          
          // Return the completely filtered transcript
          return detection.filteredTranscript;
        });
        setInterimTranscript(''); // Clear interim when we get final result
      } else {
        // For interim results, apply filtering to combined text
        const combinedText = (transcribedText + ' ' + result.transcript).trim();
        const detection = detectInTranscript(combinedText, 'general');
        
        // Extract only the new interim part (everything after the existing transcribed text)
        let filteredInterim = detection.filteredTranscript;
        if (transcribedText && filteredInterim.startsWith(transcribedText)) {
          filteredInterim = filteredInterim.substring(transcribedText.length).trim();
        }
        
        setInterimTranscript(filteredInterim);
      }
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
  }, []);

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