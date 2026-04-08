import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import FullShabadDisplay from './FullShabadDisplay';
import LoadingOverlay from './LoadingOverlay';
import StickyButtons from './StickyButtons';
import MetadataPills from './MetadataPills';
import SacredWordOverlay from './SacredWordOverlay';
import { transcriptionService } from '../services/transcriptionService';
import { banidbService } from '../services/banidbService';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface BaniCoreProps {
    mode: 'kirtan' | 'paath';
}

function BaniCore({ mode }: BaniCoreProps) {
    const navigate = useNavigate();
    const [shabads, setShabads] = useState<any[]>([]);
    const searchTriggered = false;
    const [lastSggsMatchFound, setLastSggsMatchFound] = useState<boolean | null>(null);
    const [lastBestSggsMatch, setLastBestSggsMatch] = useState<string | null>(null);
    const [showLoader, setShowLoader] = useState(true);
    const [userMessage, setUserMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const shabadsBeingFetched = useRef<Set<number>>(new Set());
    const shabadsLoadedRef = useRef(false);
    const transcriptionSentRef = useRef(false);
    const wordCountTriggeredRef = useRef(false);
    const [subtitleText, setSubtitleText] = useState('');
    const [showMatchedSubtitle, setShowMatchedSubtitle] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const MATCH_DISPLAY_DELAY = 1800;

    const {
        isListening,
        transcribedText,
        interimTranscript,
        error,
        noSpeechCount,
        volume,
        start: startSpeechRecognition,
        returnToLoadingOverlay,
        resetTranscription,
        sacredWordOverlay
    } = useSpeechRecognition(shabads.length > 0);

    const sendTranscription = useCallback(async (text: string, confidence: number) => {
        if (noSpeechCount >= 3) return;
        if (transcriptionSentRef.current) return;
        if (isProcessing) return;
        if (shabadsLoadedRef.current || searchTriggered) return;

        try {
            setIsProcessing(true);
            transcriptionSentRef.current = true;

            const response = await transcriptionService.transcribeAndSearch(text, confidence);

            if (response.results && response.results.length > 0) {
                setLastSggsMatchFound(response.sggs_match_found);
                setLastBestSggsMatch(response.best_sggs_match);

                const newShabadId = response.results[0].shabad_id;
                if (!shabads.some(s => s.shabad_id === newShabadId) && !shabadsBeingFetched.current.has(newShabadId)) {
                    shabadsBeingFetched.current.add(newShabadId);
                    try {
                        const shabadData = await banidbService.getFullShabad(newShabadId);
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
            if (err instanceof Error && err.message.includes('No results found - page will refresh')) {
                setUserMessage('No results found. Refreshing...');
            } else {
                setUserMessage('Failed to process transcription');
                transcriptionSentRef.current = false;
                wordCountTriggeredRef.current = false;
            }
        } finally {
            setIsProcessing(false);
        }
    }, [shabads, searchTriggered, isProcessing, noSpeechCount]);

    useEffect(() => {
        if (noSpeechCount >= 3) return;
        if (isFiltering) return;

        const combinedText = (transcribedText + ' ' + interimTranscript).trim();
        if (!combinedText) return;

        setIsFiltering(true);

        try {
            const wordCount = combinedText.split(/\s+/).filter(word => word.length > 0).length;

            console.log('[BaniCore] Pre-filtered combined text:', combinedText);
            console.log('[BaniCore] Word count:', wordCount);

            if (wordCount >= 8 && !wordCountTriggeredRef.current && !shabadsLoadedRef.current && !transcriptionSentRef.current) {
                wordCountTriggeredRef.current = true;
                console.log('[BaniCore] Triggering API call with pre-filtered text');
                sendTranscription(combinedText, 0.8);
            }
        } finally {
            setIsFiltering(false);
        }
    }, [transcribedText, interimTranscript, sendTranscription, noSpeechCount, isFiltering]);

    useEffect(() => {
        if (error) {
            setUserMessage(`Speech error: ${error}`);
        } else if (!isProcessing) {
            setUserMessage('');
        }
    }, [error, isProcessing]);

    useEffect(() => {
        if (noSpeechCount >= 3 && shabads.length > 0) {
            setShowLoader(true);
            setShabads([]);
            resetTranscription();
            transcriptionSentRef.current = false;
            wordCountTriggeredRef.current = false;
            shabadsLoadedRef.current = false;
            setSubtitleText('');
            setShowMatchedSubtitle(false);
            setLastSggsMatchFound(null);
            setLastBestSggsMatch(null);
            setTimeout(() => {
                setSubtitleText('');
                resetTranscription();
            }, 10);
        }
    }, [noSpeechCount, shabads.length, resetTranscription]);

    useEffect(() => {
        if (shabads.length > 0) {
            setShowLoader(false);
            shabadsLoadedRef.current = true;
        }
    }, [shabads]);

    useEffect(() => {
        if (noSpeechCount >= 3) {
            setSubtitleText('');
            return;
        }
        if (showLoader && !showMatchedSubtitle && !shabadsLoadedRef.current && noSpeechCount < 3) {
            const subtitle = (transcribedText + ' ' + interimTranscript).trim();
            setSubtitleText(subtitle);
        }
    }, [transcribedText, interimTranscript, showLoader, showMatchedSubtitle, noSpeechCount]);

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

    const resetTranscriptionState = useCallback(() => {
        setShabads([]);
        resetTranscription();
        setLastSggsMatchFound(null);
        setLastBestSggsMatch(null);
        setShowLoader(true);
        shabadsLoadedRef.current = false;
        transcriptionSentRef.current = false;
        wordCountTriggeredRef.current = false;
    }, [resetTranscription]);

    useEffect(() => {
        startSpeechRecognition();
    }, [startSpeechRecognition]);

    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            (window as any).resetBaniAI = resetTranscriptionState;
            (window as any).returnToLoading = () => {
                setShowLoader(true);
                returnToLoadingOverlay();
            };
        }
    }, [resetTranscriptionState, returnToLoadingOverlay]);

    const handleNeedNextShabad = useCallback(async () => {
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
    }, [shabads]);

    return (
        <>
            <button
                className="back-button"
                onClick={() => navigate('/')}
            >
                ← Back
            </button>
            <LoadingOverlay
                className={showLoader ? '' : 'fade-out'}
                volume={volume}
                subtitle={showLoader ? subtitleText : undefined}
            />
            <SacredWordOverlay
                key={sacredWordOverlay.key}
                isVisible={sacredWordOverlay.isVisible}
                sacredWord={sacredWordOverlay.sacredWord}
                overlayKey={sacredWordOverlay.key}
            />
            <div style={{ display: showLoader ? 'none' : 'block' }}>
                <div className="App">
                    <header className="App-header">
                        <h1>ੴ Bani AI - {mode === 'kirtan' ? 'Kirtan Mode' : 'Paath Mode'}</h1>
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
                                {isProcessing ? 'Processing...' : error ? `Error: ${error}` : isListening ? 'Listening...' : 'Ready for transcription'}
                            </span>
                        </div>
                    </header>

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

export default BaniCore;