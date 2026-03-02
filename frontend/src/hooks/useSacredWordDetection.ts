import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { sacredTrie } from '../services/sacredWordDetector';
import { StreamingTrieDetector } from '../services/sacredWordTrie';

interface SacredWordDetectionResult {
  match: string;
  displayText: string;
}

interface DetectionResult {
  filteredFinalTranscript: string;
  filteredInterimTranscript: string;
}

interface UseSacredWordDetectionReturn {
  detectNewSegment: (segment: string, isFinal: boolean, isDisplayingResults?: boolean) => DetectionResult;
  overlayState: {
    isVisible: boolean;
    sacredWord: string;
    id: number;
  };
  clearTrackingData: () => void;
}

// Sacred word pattern categories with their overlay display text
const SACRED_WORD_CATEGORIES = {
  KHALSA_FATEH: {
    patterns: [
      'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
      'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
      'ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
      'ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
      'ਜੀ ਕਾ ਖਾਲਸਾ',
      'ਜੀ ਕਾ ਖ਼ਾਲਸਾ',
      'ਜੀ ਕੀ ਫਤਿਹ',
      'ਜੀ ਕੀ ਫ਼ਤਿਹ'
    ],
    displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ'
  },
  MOOL_MANTAR: {
    patterns: [
      'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',
      'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',
      'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ',
      'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ',
      'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰੁ',
      'ਸਤਿਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ',
      'ਸਤਿ ਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ',
      'ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ'
    ],
    displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ'
  },
  DHAN_GURU_NANAK: {
    patterns: [
      'ਧੰਨ ਗੁਰੂ ਨਾਨਕ',
      'ਧਨ ਗੁਰੂ ਨਾਨਕ',
      'ਧੰਨ ਗੁਰ ਨਾਨਕ',
      'ਧਨ ਗੁਰ ਨਾਨਕ'
    ],
    displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ'
  },
  BOLE_SO_NIHAL: {
    patterns: [
      'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
      'ਬੋਲੇ ਸੋ ਨਿਹਾਲ',
      'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
      'ਬੋਲੇ ਸੋ',
      'ਸੋ ਨਿਹਾਲ'
    ],
    displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ'
  },
  WAHEGURU: {
    patterns: [
      'ਵਾਹਿਗੁਰੂ',
      'ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ'
    ],
    displayText: 'ਵਾਹਿਗੁਰੂ'
  },
  IK_ONKAR: {
    patterns: [
      'ੴ',
      'ਇਕ ਓਕਾਰ',
      'ਇ ਓਕਾਰ',
      'ਇਕ ਓਂਕਾਰ',
      'ਇਓਕਾਰ'
    ],
    displayText: 'ੴ'
  }
};

const MOOL_MANTAR_PATTERNS = SACRED_WORD_CATEGORIES.MOOL_MANTAR.patterns;

export function useSacredWordDetection(): UseSacredWordDetectionReturn {
  const [overlayState, setOverlayState] = useState({
    isVisible: false,
    sacredWord: '',
    id: 0
  });

  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const overlayCounterRef = useRef(0);
  const lastTriggerTimeRef = useRef<number>(0);
  const lastTriggeredWordRef = useRef<string>('');

  // Streaming state tracking
  const filteredWordsRef = useRef<string[]>([]);
  const detectorRef = useRef(new StreamingTrieDetector(sacredTrie));

  const isMoolMantar = useCallback((matchText: string): boolean => {
    const normalized = matchText.normalize('NFC');
    return MOOL_MANTAR_PATTERNS.some(pattern =>
      normalized.includes(pattern) || pattern.includes(normalized)
    );
  }, []);

  const getDisplayTextForPattern = useCallback((matchText: string): string => {
    const normalized = matchText.normalize('NFC');
    for (const category of Object.values(SACRED_WORD_CATEGORIES)) {
      if (category.patterns.includes(normalized)) {
        return category.displayText;
      }
    }
    return matchText;
  }, []);

  const showOverlay = useCallback((sacredWord: string) => {
    const now = Date.now();
    const isSameWord = lastTriggeredWordRef.current === sacredWord;
    const timeSinceLastTrigger = now - lastTriggerTimeRef.current;

    // Strict debounce: For interim results, prevent rapid-fire identical triggers
    const isWithinDebounce = timeSinceLastTrigger < 3000;

    // If it's a distinct word but triggered rapidly during the identical stream context, treat it as an upgrade.
    const isUpgrade = !isSameWord && timeSinceLastTrigger < 1500;

    if (isSameWord && isWithinDebounce) {
      // Skip redundant overlay updates entirely
      return;
    }

    lastTriggerTimeRef.current = now;
    lastTriggeredWordRef.current = sacredWord;

    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    if (fadeOutTimeoutRef.current) clearTimeout(fadeOutTimeoutRef.current);

    if (isUpgrade) {
      // Smooth upgrade: update text but keep the same ID to prevent React remount flash
      flushSync(() => {
        setOverlayState(prev => ({
          ...prev,
          isVisible: true,
          sacredWord
        }));
      });
    } else {
      // New distinct overlay trigger
      flushSync(() => {
        setOverlayState({
          isVisible: true,
          sacredWord,
          id: overlayCounterRef.current++
        });
      });
    }

    overlayTimeoutRef.current = setTimeout(() => {
      setOverlayState(prev => ({ ...prev, isVisible: false }));
      fadeOutTimeoutRef.current = setTimeout(() => {
        setOverlayState(prev => ({ ...prev, sacredWord: '' }));
      }, 300);
    }, 4000);
  }, []);

  /**
   * Finalized architecture: Process only the new segment.
   * Manage transcript state internally to avoid full rescans.
   */
  const detectNewSegment = useCallback((
    segment: string,
    isFinal: boolean,
    isDisplayingResults: boolean = false
  ): DetectionResult => {
    if (!segment.trim()) {
      return {
        filteredFinalTranscript: filteredWordsRef.current.join(' '),
        filteredInterimTranscript: ''
      };
    }

    // For final results, we permanently advance the detector and update filteredWords
    if (isFinal) {
      const words = segment.trim().split(/\s+/);

      words.forEach(word => {
        const normalized = word.normalize('NFC');
        filteredWordsRef.current.push(normalized);

        const result = detectorRef.current.processWord(normalized);
        if (result.fullMatch) {
          // STEP 3: Remove the words that made up the match from the filtered list
          if (result.consumedWordCount > 0) {
            filteredWordsRef.current.splice(
              filteredWordsRef.current.length - result.consumedWordCount,
              result.consumedWordCount
            );
          }

          console.log("SACRED DETECTED (Streaming):", result.fullMatch);

          // Trigger overlay
          if (!isDisplayingResults || !isMoolMantar(result.fullMatch)) {
            showOverlay(getDisplayTextForPattern(result.fullMatch));
          }
        }
      });

      return {
        filteredFinalTranscript: filteredWordsRef.current.join(' '),
        filteredInterimTranscript: ''
      };
    } else {
      /**
       * For interim segments, we need a preview of the filtered transcript.
       * We don't advance the global StreamingDetector because interim speech is unstable.
       * Instead, we filter the interim segment statelessly using the Trie.
       */
      const interimWords = segment.trim().split(/\s+/).map(w => w.normalize('NFC'));

      // Use the Trie to find all matches in the interim segment alone
      const interimMatches = sacredTrie.findAllMatches(segment);

      // Filter out matched words from a copy of the interim segment
      let filteredInterim = [...interimWords];

      // Dedup matches to avoid processing identically matched subsets redundantly
      const processedMatches = new Set<string>();

      // We process matches in reverse order to keep indices valid after splice
      [...interimMatches].reverse().forEach(match => {
        const count = match.phrase.split(/\s+/).length;
        filteredInterim.splice(match.startIndex, count);

        // Trigger overlay for interim match if it's new
        if (!processedMatches.has(match.phrase)) {
          processedMatches.add(match.phrase);
          if (!isDisplayingResults || !isMoolMantar(match.phrase)) {
            showOverlay(getDisplayTextForPattern(match.phrase));
          }
        }
      });

      const finalTranscript = filteredWordsRef.current.join(' ');
      const interimPart = filteredInterim.join(' ');

      return {
        filteredFinalTranscript: finalTranscript,
        filteredInterimTranscript: interimPart
      };
    }
  }, [isMoolMantar, showOverlay, getDisplayTextForPattern]);

  const clearTrackingData = useCallback(() => {
    filteredWordsRef.current = [];
    detectorRef.current.reset();
    setOverlayState({ isVisible: false, sacredWord: '', id: 0 });
    lastTriggeredWordRef.current = '';
    lastTriggerTimeRef.current = 0;
    console.log('[SacredWordDetection] Tracking data cleared');
  }, []);

  return {
    detectNewSegment,
    overlayState,
    clearTrackingData
  };
}
