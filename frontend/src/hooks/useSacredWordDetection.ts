import { useCallback, useState, useRef, useEffect } from 'react';
import { removeSacredWords } from '../services/sacredWordDetector';

interface SacredPhrase {
  pattern: string;
  displayText: string;
  priority: number;
  overlayMs: number;
}

interface UseSacredWordDetectionReturn {
  processSpeech: (rawText: string, isFinal: boolean) => string;
  overlayState: { isVisible: boolean; sacredWord: string };
  reset: () => void;
}

// Phrases ordered by priority then length — most specific first.
// Waheguru is LAST so it only matches when no longer phrase applies.
const SACRED_PHRASES: SacredPhrase[] = [
  // Mool Mantar (priority 0)
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ', pattern: 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ', pattern: 'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰੁ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿ ਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ', pattern: 'ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ' },

  // Khalsa Fateh (priority 1) — full phrases only, no partials
  // Partials like "ਜੀ ਕਾ ਖਾਲਸਾ" caused false triggers from regular Bani
  { priority: 1, overlayMs: 3000, displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ', pattern: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ' },
  { priority: 1, overlayMs: 3000, displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ', pattern: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ' },
  { priority: 1, overlayMs: 3000, displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ', pattern: 'ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ' },
  { priority: 1, overlayMs: 3000, displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ', pattern: 'ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ' },

  // Bole So Nihal (priority 2)
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਬੋਲੇ ਸੋ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਸੋ ਨਿਹਾਲ' },

  // Dhan Guru Nanak (priority 2)
  { priority: 2, overlayMs: 2000, displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ', pattern: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ', pattern: 'ਧਨ ਗੁਰੂ ਨਾਨਕ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ', pattern: 'ਧੰਨ ਗੁਰ ਨਾਨਕ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ', pattern: 'ਧਨ ਗੁਰ ਨਾਨਕ' },

  // Ik Onkar (priority 2)
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ੴ' },
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ਇਕ ਓਕਾਰ' },
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ਇਕ ਓਂਕਾਰ' },
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ਇ ਓਕਾਰ' },
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ਇਓਕਾਰ' },

  // Waheguru (priority 3 — lowest, always last)
  { priority: 3, overlayMs: 1500, displayText: 'ਵਾਹਿਗੁਰੂ', pattern: 'ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ' },
  { priority: 3, overlayMs: 1500, displayText: 'ਵਾਹਿਗੁਰੂ', pattern: 'ਵਾਹਿਗੁਰੂ' },
].map(p => ({ ...p, pattern: p.pattern.normalize('NFC') }));

const BUFFER_SIZE = 20;

export function useSacredWordDetection(
  isDisplayingResults: boolean = false
): UseSacredWordDetectionReturn {
  const [overlayState, setOverlayState] = useState({ isVisible: false, sacredWord: '' });
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentPriorityRef = useRef<number>(999);

  const wordBufferRef = useRef<string[]>([]);
  const consumedPatternsRef = useRef<Set<string>>(new Set());
  const skipNextScanRef = useRef<boolean>(false);
  // Debounce interim scans — Web Speech rewrites interim frequently,
  // scanning on every tick causes noise. Only scan if 300ms have passed.
  const lastInterimScanRef = useRef<number>(0);

  const showOverlay = useCallback((phrase: SacredPhrase) => {
    // Always show — never block based on current priority.
    // The consume mechanism already prevents re-triggers within an utterance.
    // Priority ordering is handled by scanBuffer picking the best match.
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    currentPriorityRef.current = phrase.priority;
    setOverlayState({ isVisible: true, sacredWord: phrase.displayText });
    console.log('[Overlay] Show:', phrase.displayText, `priority=${phrase.priority} duration=${phrase.overlayMs}ms`);

    overlayTimeoutRef.current = setTimeout(() => {
      currentPriorityRef.current = 999;
      setOverlayState({ isVisible: false, sacredWord: '' });
    }, phrase.overlayMs);
  }, []);

  const scanBuffer = useCallback((): SacredPhrase | null => {
    const bufferText = wordBufferRef.current.join(' ').normalize('NFC');
    let bestMatch: SacredPhrase | null = null;

    for (const phrase of SACRED_PHRASES) {
      if (consumedPatternsRef.current.has(phrase.pattern)) continue;
      if (bufferText.includes(phrase.pattern)) {
        if (!bestMatch || phrase.priority < bestMatch.priority) {
          bestMatch = phrase;
        }
        if (bestMatch.priority === 0) break;
      }
    }

    return bestMatch;
  }, []);

  const processSpeech = useCallback((rawText: string, isFinal: boolean): string => {
    if (!rawText.trim()) return rawText;

    const incomingWords = rawText.trim().normalize('NFC').split(/\s+/).filter(Boolean);

    if (isFinal) {
      wordBufferRef.current = incomingWords.slice(-BUFFER_SIZE);
      consumedPatternsRef.current.clear();
      lastInterimScanRef.current = 0; // reset debounce for next interim stream
      skipNextScanRef.current = true;

      // Scan final buffer
      skipNextScanRef.current = false;
      const match = scanBuffer();
      if (match) {
        consumedPatternsRef.current.add(match.pattern);
        const isMoolMantar = match.priority === 0;
        if (!(isDisplayingResults && isMoolMantar)) {
          showOverlay(match);
        }
      }
      skipNextScanRef.current = true;
    } else {
      wordBufferRef.current = [...wordBufferRef.current, ...incomingWords].slice(-BUFFER_SIZE);

      if (skipNextScanRef.current) {
        skipNextScanRef.current = false;
        return removeSacredWords(rawText);
      }

      // Debounce: only scan interim every 300ms to reduce API rewrite noise
      const now = Date.now();
      if (now - lastInterimScanRef.current < 300) {
        return removeSacredWords(rawText);
      }
      lastInterimScanRef.current = now;

      const match = scanBuffer();
      if (match) {
        consumedPatternsRef.current.add(match.pattern);
        const isMoolMantar = match.priority === 0;
        if (!(isDisplayingResults && isMoolMantar)) {
          showOverlay(match);
        }
      }
    }

    return removeSacredWords(rawText);
  }, [isDisplayingResults, scanBuffer, showOverlay]);

  const reset = useCallback(() => {
    wordBufferRef.current = [];
    consumedPatternsRef.current.clear();
    skipNextScanRef.current = false;
    lastInterimScanRef.current = 0;
    currentPriorityRef.current = 999;
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    setOverlayState({ isVisible: false, sacredWord: '' });
  }, []);

  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, []);

  return { processSpeech, overlayState, reset };
}