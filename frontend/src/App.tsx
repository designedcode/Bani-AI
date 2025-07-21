import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import TranscriptionPanel from './components/TranscriptionPanel';
import SearchResults from './components/SearchResults';
import AudioVisualizer from './components/AudioVisualizer';
import FullShabadDisplay from './components/FullShabadDisplay';
import LoadingOverlay from './components/LoadingOverlay';

interface SearchResult {
  gurmukhi_text: string;
  english_translation: string;
  line_number: number;
  page_number: number;
  source?: string;
  writer?: string;
  raag?: string;
  shabad_id: string;
}

interface TranscriptionData {
  text: string;
  confidence: number;
}

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
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string>('');
  const [sggsMatchFound, setSggsMatchFound] = useState<boolean | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState<boolean | null>(null);
  const [bestSggsMatch, setBestSggsMatch] = useState<string | null>(null);
  const [bestSggsScore, setBestSggsScore] = useState<number | null>(null);
  const [shabads, setShabads] = useState<any[]>([]);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [lastSearchResults, setLastSearchResults] = useState<SearchResult[]>([]);
  const [lastSggsMatchFound, setLastSggsMatchFound] = useState<boolean | null>(null);
  const [lastFallbackUsed, setLastFallbackUsed] = useState<boolean | null>(null);
  const [lastBestSggsMatch, setLastBestSggsMatch] = useState<string | null>(null);
  const [lastBestSggsScore, setLastBestSggsScore] = useState<number | null>(null);
  const [showLoader, setShowLoader] = useState(true);
  const [noSpeechCount, setNoSpeechCount] = useState(0);
  const [userMessage, setUserMessage] = useState('');
  const MAX_NO_SPEECH_RETRIES = 3;
  
  const websocketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentTextRef = useRef<string>('');
  const shabadsBeingFetched = useRef<Set<number>>(new Set());
  const [subtitleText, setSubtitleText] = useState('');
  const [showMatchedSubtitle, setShowMatchedSubtitle] = useState(false);
  const MATCH_DISPLAY_DELAY = 1800; // ms
  const recognitionManuallyStoppedRef = useRef(false);

  // Debounced function to send transcription data
  const debouncedSendTranscription = useCallback((text: string, confidence: number) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Don't send if it's the same as last sent text
    if (text === lastSentTextRef.current) {
      return;
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      if (shabads.length > 0 || searchTriggered) return;
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        const transcriptionData: TranscriptionData = {
          text: text,
          confidence: confidence
        };
        websocketRef.current.send(JSON.stringify(transcriptionData));
        lastSentTextRef.current = text;
      }
    }, 300); // 300ms debounce delay
  }, [shabads, searchTriggered]);

  // Fix: Clear debounce timer when fullShabad is set
  useEffect(() => {
    if (shabads.length > 0 && debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, [shabads]);

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      setConnectionStatus('connecting');
      
      const ws = new WebSocket('ws://localhost:8000/ws/transcription');
      
      ws.onopen = () => {
        setConnectionStatus('connected');
        setError('');
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'search_result') {
            setSearchResults(data.results);
            setSggsMatchFound(data.sggs_match_found ?? null);
            setFallbackUsed(data.fallback_used ?? null);
            setBestSggsMatch(data.best_sggs_match ?? null);
            setBestSggsScore(data.best_sggs_score ?? null);
            // Only update last* states if results are present (i.e., a search actually happened)
            if (data.results && data.results.length > 0) {
              setLastSearchQuery(data.transcribed_text);
              setLastSearchResults(data.results);
              setLastSggsMatchFound(data.sggs_match_found ?? null);
              setLastFallbackUsed(data.fallback_used ?? null);
              setLastBestSggsMatch(data.best_sggs_match ?? null);
              setLastBestSggsScore(data.best_sggs_score ?? null);
            }
            // Only fetch full shabad if not already loaded
            if (data.results && data.results.length > 0 && data.results[0].shabad_id) {
              const newShabadId = data.results[0].shabad_id;
              if (!shabads.some(s => s.shabad_id === newShabadId) && !shabadsBeingFetched.current.has(newShabadId)) {
                shabadsBeingFetched.current.add(newShabadId);
                fetch(`/api/full-shabad?shabadId=${newShabadId}`)
                  .then(res => res.json())
                  .then(data => {
                    setShabads(prev => [...prev, data]);
                  })
                  .finally(() => {
                    shabadsBeingFetched.current.delete(newShabadId);
                  });
              }
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
      
      ws.onclose = () => {
        setConnectionStatus('disconnected');
        console.log('WebSocket disconnected');
      };
      
      ws.onerror = (error) => {
        setConnectionStatus('disconnected');
        setError('WebSocket connection failed');
        console.error('WebSocket error:', error);
      };
      
      websocketRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

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
          const fullTranscript = (updated + interim).trim();
          const wordCount = fullTranscript.split(/\s+/).length;
          
          // Backend: Only send when word count >= 8, and send the full transcription
          if (wordCount >= 8) {
            debouncedSendTranscription(fullTranscript, maxConfidence);
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
              } catch (e) {}
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
              } catch (e) {}
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
            } catch (e) {}
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
  }, []);

  // Hide loader as soon as a shabad is found
  useEffect(() => {
    if (shabads.length > 0) {
      setShowLoader(false);
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

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setError('Failed to start speech recognition');
      }
    }
  };

  const pauseListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    setIsListening(false);
    recognitionManuallyStoppedRef.current = true;
  };

  const stopListeningAndClear = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    setIsListening(false);
    recognitionManuallyStoppedRef.current = true;
    setTranscribedText('');
    setInterimTranscript('');
    setSearchResults([]);
    setShabads([]);
    setSearchTriggered(false);
  };

  // Callback to fetch next shabad
  const handleNeedNextShabad = () => {
    const lastShabad = shabads[shabads.length - 1];
    const nextShabadId = lastShabad?.navigation?.next;
    if (
      nextShabadId &&
      !shabads.some(s => s.shabad_id === nextShabadId) &&
      !shabadsBeingFetched.current.has(nextShabadId)
    ) {
      shabadsBeingFetched.current.add(nextShabadId);
      fetch(`/api/full-shabad?shabadId=${nextShabadId}`)
        .then(res => res.json())
        .then(data => {
          setShabads(prev => [...prev, data]);
        })
        .finally(() => {
          shabadsBeingFetched.current.delete(nextShabadId);
        });
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
              <span className={`status-indicator ${connectionStatus}`}>
                {connectionStatus === 'connected' ? '🟢' : 
                 connectionStatus === 'connecting' ? '🟡' : '🔴'}
              </span>
              <span className="status-text">
                {connectionStatus === 'connected' ? 'Connected to BaniDB API' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
          </header>

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
            <div className="controls">
              <div className="control-group">
                <button 
                  className={`listen-button ${isListening ? 'listening' : ''}`}
                  onClick={isListening ? pauseListening : startListening}
                  disabled={connectionStatus !== 'connected'}
                >
                  {isListening ? '⏸️ Pause Listening' : '🎤 Start Listening'}
                </button>
              </div>
              
              <button 
                className="clear-button"
                onClick={stopListeningAndClear}
                disabled={!transcribedText && searchResults.length === 0}
              >
                🗑️ Clear
              </button>
            </div>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            <div className="content-grid">
              <div className="left-panel">
                {/* Only show TranscriptionPanel in main app if loader is hidden */}
                {!showLoader && (
                  <TranscriptionPanel 
                    transcribedText={transcribedText + interimTranscript}
                    isListening={isListening}
                  />
                )}
                <AudioVisualizer isListening={isListening} />
              </div>
              
              <div className="right-panel">
                {/* Only show SearchResults in main app if loader is hidden */}
                {!showLoader && (
                  <SearchResults 
                    results={lastSearchResults}
                    transcribedText={lastSearchQuery}
                    sggsMatchFound={lastSggsMatchFound}
                    fallbackUsed={lastFallbackUsed}
                    bestSggsMatch={lastBestSggsMatch}
                    bestSggsScore={lastBestSggsScore}
                  />
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

export default App; 