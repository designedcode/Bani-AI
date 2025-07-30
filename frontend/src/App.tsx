import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import FullShabadDisplay from './components/FullShabadDisplay';
import LoadingOverlay from './components/LoadingOverlay';
import StickyButtons from './components/StickyButtons';
import MetadataPills from './components/MetadataPills';
import { transcriptionService } from './services/transcriptionService';
import { banidbService } from './services/banidbService';

// Custom hook for real-time audio volume detection
function useMicVolume(autoStart: boolean) {
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!autoStart) return;
    let cancelled = false;

    async function setup() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return;
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        dataArrayRef.current = dataArray;
        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(analyser);

        const updateVolume = () => {
          if (!analyserRef.current || !dataArrayRef.current) return;
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
          // Calculate RMS (root mean square) volume
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            const val = (dataArrayRef.current[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArrayRef.current.length);
          setVolume(rms);
          rafRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (err) {
        setVolume(0);
      }
    }
    setup();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [autoStart]);
  return volume;
}

function App() {
  const [, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [error, setError] = useState<string>('');
  const [shabads, setShabads] = useState<any[]>([]);
  const [searchTriggered] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastSggsMatchFound, setLastSggsMatchFound] = useState<boolean | null>(null);
  const [lastBestSggsMatch, setLastBestSggsMatch] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(true);
  const [userMessage, setUserMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shabadsBeingFetched = useRef<Set<number>>(new Set());
  const shabadsLoadedRef = useRef(false); // Track if shabads are loaded
  const transcriptionSentRef = useRef(false); // Track if we've already sent a transcription
  const wordCountTriggeredRef = useRef(false); // Track if 8+ words have been reached
  const [subtitleText, setSubtitleText] = useState('');
  const [showMatchedSubtitle, setShowMatchedSubtitle] = useState(false);
  const MATCH_DISPLAY_DELAY = 1800; // ms
  const recognitionManuallyStoppedRef = useRef(false);

  // Simple function to send transcription data via HTTP (no debouncing)
  const sendTranscription = useCallback(async (text: string, confidence: number) => {
    // Don't send if we've already sent a transcription successfully
    if (transcriptionSentRef.current) {
      console.log('Skipping transcription - already sent one successfully');
      return;
    }

    // Don't send if already processing
    if (isProcessing) {
      console.log('Skipping transcription - already processing');
      return;
    }

    // IMPORTANT: Don't process transcription if we already have shabads loaded
    if (shabadsLoadedRef.current || searchTriggered) {
      console.log('Skipping transcription - shabads already loaded or search triggered');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      console.log(`[TRANSCRIPTION] Sending transcription: "${text.substring(0, 50)}..."`);

      // Mark that we're sending a transcription to prevent duplicates
      transcriptionSentRef.current = true;

      const response = await transcriptionService.transcribeAndSearch(text, confidence);

      // Update state with response - only keep what we actually use
      if (response.results && response.results.length > 0) {
        setLastSggsMatchFound(response.sggs_match_found);
        setLastBestSggsMatch(response.best_sggs_match);

        // Fetch full shabad if not already loaded
        const newShabadId = response.results[0].shabad_id;
        if (!shabads.some(s => s.shabad_id === newShabadId) && !shabadsBeingFetched.current.has(newShabadId)) {
          shabadsBeingFetched.current.add(newShabadId);
          try {
            const shabadData = await banidbService.getFullShabad(newShabadId, response.results[0].verse_id);
            setShabads(prev => [...prev, shabadData]);
          } catch (err) {
            console.error('Error fetching full shabad:', err);
          } finally {
            shabadsBeingFetched.current.delete(newShabadId);
          }
        }
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Failed to process transcription');
      // Reset the flag on error so user can try again
      transcriptionSentRef.current = false;
      wordCountTriggeredRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  }, [shabads, searchTriggered, isProcessing]);



  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pa-IN';
      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        setUserMessage('');
        recognitionManuallyStoppedRef.current = false;
      };
      recognition.onresult = (event) => {
        let newTranscript = '';
        let interim = '';
        let maxConfidence = 0;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;
          if (event.results[i].isFinal) {
            newTranscript += transcript;
            maxConfidence = Math.max(maxConfidence, confidence);
          } else {
            interim += transcript;
          }
        }
        setTranscribedText(prev => {
          const updated = prev + newTranscript;

          // Check word count on FINAL transcribed text only (not including interim)
          const finalWordCount = updated.trim().split(/\s+/).filter(word => word.length > 0).length;

          // Send transcription as soon as we have 8+ final words, but only once
          if (finalWordCount >= 8 && !wordCountTriggeredRef.current && !shabadsLoadedRef.current && !transcriptionSentRef.current) {
            console.log(`[SPEECH] Triggering transcription with ${finalWordCount} final words: "${updated.substring(0, 50)}..."`);
            wordCountTriggeredRef.current = true; // Mark that we've triggered the 8+ word condition
            sendTranscription(updated.trim(), maxConfidence);
          }

          return updated;
        });
        setInterimTranscript(interim);
      };
      recognition.onerror = (event) => {
        console.log('Speech recognition error:');
        if (event.error === 'no-speech') {
          setUserMessage('No speech detected. Please try speaking again.');
          // Always auto-restart unless manually stopped
          if (!recognitionManuallyStoppedRef.current) {
            setTimeout(() => {
              try {
                recognition.start();
              } catch (e) { }
            }, 800);
          }
        } else if (event.error === 'aborted') {
          recognitionManuallyStoppedRef.current = true;
        } else {
          setError(`Speech recognition error: ${event.error}`);
          // For other errors, auto-restart unless manually stopped
          if (!recognitionManuallyStoppedRef.current) {
            setTimeout(() => {
              try {
                recognition.start();
              } catch (e) { }
            }, 1200);
          }
        }
        setIsListening(false);
      };
      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
        // Always auto-restart unless manually stopped
        if (!recognitionManuallyStoppedRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) { }
          }, 800);
        }
      };
      recognitionRef.current = recognition;
    } else {
      setError('Speech recognition not supported in this browser');
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [sendTranscription]);

  // Hide loader as soon as a shabad is found
  useEffect(() => {
    if (shabads.length > 0) {
      setShowLoader(false);
      shabadsLoadedRef.current = true; // Update ref when shabads are loaded
    }
  }, [shabads]);

  // Show live transcription as subtitle during loading
  useEffect(() => {
    if (showLoader && !showMatchedSubtitle) {
      const subtitle = (transcribedText + ' ' + interimTranscript).trim();
      setSubtitleText(subtitle);
      console.log('[DEBUG] Subtitle update:', { transcribedText, interimTranscript, subtitle });
    }
  }, [transcribedText, interimTranscript, showLoader, showMatchedSubtitle]);

  // When SGGS match is found, show matched text as subtitle, then transition
  useEffect(() => {
    if (showLoader && lastSggsMatchFound && lastBestSggsMatch) {
      setShowMatchedSubtitle(true);
      setSubtitleText(lastBestSggsMatch);
      const timer = setTimeout(() => {
        setShowLoader(false);
        setShowMatchedSubtitle(false);
      }, MATCH_DISPLAY_DELAY);
      return () => clearTimeout(timer);
    }
  }, [showLoader, lastSggsMatchFound, lastBestSggsMatch]);

  // Start mic volume detection as soon as the app loads
  const micVolume = useMicVolume(true);

  // Function to reset transcription state (for future use)
  const resetTranscriptionState = useCallback(() => {
    setShabads([]);
    setTranscribedText('');
    setInterimTranscript('');
    setLastSggsMatchFound(null);
    setLastBestSggsMatch(null);
    setShowLoader(true);
    setError('');
    shabadsLoadedRef.current = false;
    transcriptionSentRef.current = false; // Reset transcription sent flag
    wordCountTriggeredRef.current = false; // Reset word count trigger flag
  }, []);

  // Automatically start speech recognition on mount
  useEffect(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        // Already started or error
      }
    }
  }, []);

  // Expose reset function for development/testing
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).resetBaniAI = resetTranscriptionState;
    }
  }, [resetTranscriptionState]);

  // Callback to fetch next shabad
  const handleNeedNextShabad = async () => {
    const lastShabad = shabads[shabads.length - 1];
    const nextShabadId = lastShabad?.navigation?.next;
    console.log(`[PAGINATION] Attempting to fetch next shabad. Current: ${lastShabad?.shabad_id}, Next: ${nextShabadId}`);

    if (
      nextShabadId &&
      !shabads.some(s => s.shabad_id === nextShabadId) &&
      !shabadsBeingFetched.current.has(nextShabadId)
    ) {
      console.log(`[PAGINATION] Fetching shabad ${nextShabadId}`);
      shabadsBeingFetched.current.add(nextShabadId);
      try {
        const data = await banidbService.getFullShabad(nextShabadId);
        setShabads(prev => {
          console.log(`[PAGINATION] Successfully fetched shabad ${nextShabadId}, total shabads: ${prev.length + 1}`);
          return [...prev, data];
        });
      } catch (err) {
        console.error('Error fetching next shabad:', err);
      } finally {
        shabadsBeingFetched.current.delete(nextShabadId);
      }
    } else {
      console.log(`[PAGINATION] Skipping fetch - nextShabadId: ${nextShabadId}, already exists: ${shabads.some(s => s.shabad_id === nextShabadId)}, being fetched: ${shabadsBeingFetched.current.has(nextShabadId)}`);
    }
  };

  return (
    <>
      <LoadingOverlay className={showLoader ? '' : 'fade-out'} volume={micVolume} subtitle={showLoader ? subtitleText : undefined} />
      <div style={{ display: showLoader ? 'none' : 'block' }}>
        <div className="App">
          <header className="App-header">
            <h1>ੴ Bani AI</h1>
            <p>Real-time Punjabi Audio Transcription & BaniDB Search</p>
            {userMessage && (
              <div className="user-message" style={{ color: '#ffb347', fontWeight: 600, margin: '1rem 0' }}>
                {userMessage}
              </div>
            )}
            <div className="connection-status">
              <span className={`status-indicator ${isProcessing ? 'connecting' : error ? 'disconnected' : 'connected'}`}>
                {isProcessing ? '🟡' : error ? '🔴' : '🟢'}
              </span>
              <span className="status-text">
                {isProcessing ? 'Processing...' : error ? `Error: ${error}` : 'Ready for transcription'}
              </span>
            </div>
          </header>

          {/* Sticky Pills + Buttons Row */}
          {shabads.length > 0 && (
            <div className="sticky-header-row">
              <div className="sticky-header-left">
                <MetadataPills
                  raag={shabads[0]?.raag}
                  writer={shabads[0]?.writer}
                  page={shabads[0]?.page_no}
                />
                <StickyButtons />
              </div>
            </div>
          )}

          <main className="App-main">
            {/* Show Full Shabad box if present */}
            {shabads.length > 0 && (
              <div className="panel-header search-results" style={{ marginBottom: '2rem' }}>
                <FullShabadDisplay
                  shabads={shabads}
                  transcribedText={(() => {
                    const combined = (transcribedText + ' ' + interimTranscript).trim();
                    const words = combined.split(/\s+/);
                    const last4Words = words.slice(-4).join(' ');
                    return last4Words;
                  })()}
                  onNeedNextShabad={handleNeedNextShabad}
                />
              </div>
            )}

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

export default App; 