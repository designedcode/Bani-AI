import { useCallback, useState, useRef, useEffect } from 'react';
import { detectAndRemoveSacredWords } from '../services/sacredWordDetector';

interface SacredWordDetectionResult {
  match: string;
  displayText: string;
  rule: any;
  score: number;
}

interface DetectionResult {
  match: SacredWordDetectionResult | null;
  filteredTranscript: string;
}

interface UseSacredWordDetectionReturn {
  detectInTranscript: (combinedText: string, context?: 'general' | 'shabad', isDisplayingResults?: boolean) => DetectionResult;
  overlayState: {
    isVisible: boolean;
    sacredWord: string;
  };
  clearTrackingData: () => void;
  shouldResetSearch: boolean;
  clearResetFlag: () => void;
}

// Sacred word pattern categories with their overlay display text
const SACRED_WORD_CATEGORIES = {
  // Category 1: Lines 4-5, 16-17, 25-28 - Khalsa Fateh
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

  // Category 2: Lines 7-14 - Mool Mantar
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

  // Category 3: Lines 19-22 - Dhan Guru Nanak
  DHAN_GURU_NANAK: {
    patterns: [
      'ਧੰਨ ਗੁਰੂ ਨਾਨਕ',
      'ਧਨ ਗੁਰੂ ਨਾਨਕ',
      'ਧੰਨ ਗੁਰ ਨਾਨਕ',
      'ਧਨ ਗੁਰ ਨਾਨਕ'
    ],
    displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ'
  },

  // Category 4: Lines 29-30 - Bole So Nihal
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

  // Category 5: Lines 33, 50 - Waheguru
  WAHEGURU: {
    patterns: [
      'ਵਾਹਿਗੁਰੂ',
      'ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ'
    ],
    displayText: 'ਵਾਹਿਗੁਰੂ'
  },

  // Category 6: Lines 35-37, 51-52 - Ik Onkar
  IK_ONKAR: {
    patterns: [
      'ੴ',
      'ਇਕ ਓਕਾਰ',
      'ਇ ਓਕਾਰ',
      'ਇਕ ਓਂਕਾਰ',
      'ਇਓਕਾਰ'
    ],
    displayText: 'ੴ'
  },

  WJKK_WJKF_RESET: {
    patterns: [
      'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
      'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
      'waheguru ji ka khalsa waheguru ji ki fateh',
      'waheguru ji ka khalsha waheguru ji ki fatheh',
      'waheguru ji ka khlsa whaeguru ji fatheh',
      'waheguru ji ka khalsa waheguru ji fatheh',
      'waheguru ji ka khlsa whaeguru ji ki fateh',
      'wjkk wjkf',
      'WJKK WJKF'
    ],
    displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
    triggerReset: true
  }
};

// Mool Mantar patterns that should not trigger overlay during search results
const MOOL_MANTAR_PATTERNS = SACRED_WORD_CATEGORIES.MOOL_MANTAR.patterns;

export function useSacredWordDetection(): UseSacredWordDetectionReturn {
  const [overlayState, setOverlayState] = useState({
    isVisible: false,
    sacredWord: ''
  });
  const [shouldResetSearch, setShouldResetSearch] = useState(false);

  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMatchRef = useRef<string>('');
  const shownTextsRef = useRef<Set<string>>(new Set()); // Track texts that have already shown overlay
  const timerResetCountRef = useRef<Map<string, number>>(new Map()); // Track timer reset count per text

  // Helper function to check if a match is Mool Mantar
  const isMoolMantar = useCallback((matchText: string): boolean => {
    const normalized = matchText.normalize('NFC');
    return MOOL_MANTAR_PATTERNS.some(pattern =>
      normalized.includes(pattern) || pattern.includes(normalized)
    );
  }, []);

  // Helper function to check if a match is WJKK WJKF reset phrase - HIGHLY LENIENT
  const isResetTrigger = useCallback((matchText: string): boolean => {
    const normalized = matchText.normalize('NFC').toLowerCase();
    
    // Gurmukhi patterns - check for substring containment
    const gur_full_pattern = 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ'.normalize('NFC').toLowerCase();
    const gur_alt_pattern = 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ'.normalize('NFC').toLowerCase();
    const gur_partial1 = 'ਖ਼ਾਲਸਾ'.normalize('NFC').toLowerCase();
    const gur_partial2 = 'ਖਾਲਸਾ'.normalize('NFC').toLowerCase();
    const gur_fateh1 = 'ਫ਼ਤਿਹ'.normalize('NFC').toLowerCase();
    const gur_fateh2 = 'ਫਤਿਹ'.normalize('NFC').toLowerCase();
    
    // Check for full or partial Gurmukhi matches
    if (normalized.includes(gur_full_pattern) || 
        normalized.includes(gur_alt_pattern) ||
        (normalized.includes(gur_partial1) && (normalized.includes(gur_fateh1) || normalized.includes(gur_fateh2))) ||
        (normalized.includes(gur_partial2) && (normalized.includes(gur_fateh1) || normalized.includes(gur_fateh2)))) {
      console.log('[isResetTrigger] Gurmukhi WJKK WJKF detected');
      return true;
    }
    
    // English variations - including common misspellings
    const englishResetPatterns = [
      'waheguru ji ka khalsa',
      'waheguru ji ki fateh',
      'waheguru ji ka khalsa waheguru ji ki fateh',
      'waheguru ji ka khalsha waheguru ji ki fatheh'   ];
    
    // Remove extra spaces and punctuation
    const cleanedText = normalized.replace(/\s+/g, ' ').trim().replace(/[.,!?;:]/g, '');
    const withoutSpaces = cleanedText.replace(/\s/g, '');
    
    for (const pattern of englishResetPatterns) {
      const cleanedPattern = pattern.replace(/\s+/g, ' ').trim();
      const patternWithoutSpaces = cleanedPattern.replace(/\s/g, '');
      
      // Check for substring match with flexible spacing
      if (cleanedText.includes(cleanedPattern) || withoutSpaces.includes(patternWithoutSpaces)) {
        console.log(`[isResetTrigger] English WJKK WJKF pattern detected: "${pattern}"`);
        return true;
      }
    }
    
    return false;
  }, []);

  // Helper function to get the display text for a matched pattern
  const getDisplayTextForPattern = useCallback((matchText: string): string => {
    const normalized = matchText.normalize('NFC').toLowerCase();

    // Check for exact pattern match (case-insensitive for English)
    for (const category of Object.values(SACRED_WORD_CATEGORIES)) {
      if (category.patterns.some(p => p.normalize('NFC').toLowerCase() === normalized)) {
        return category.displayText;
      }
    }

    // Fallback to original match if no category found
    return matchText;
  }, []);

  // Function to show overlay with auto-dismiss
  const showOverlay = useCallback((sacredWord: string) => {
    // Clear any existing timeout
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }

    // Update overlay state
    setOverlayState({
      isVisible: true,
      sacredWord
    });

    // Auto-dismiss after 3 seconds
    overlayTimeoutRef.current = setTimeout(() => {
      setOverlayState(prev => ({
        ...prev,
        isVisible: false
      }));

      // Clear the word after fade out animation
      setTimeout(() => {
        setOverlayState({
          isVisible: false,
          sacredWord: ''
        });
      }, 300); // Match CSS transition duration
    }, 3000);
  }, []);

  // Function to reset timer for duplicate matches (limited to 3 resets max)
  const resetOverlayTimer = useCallback((sacredWord: string) => {
    const currentResetCount = timerResetCountRef.current.get(sacredWord) || 0;

    // Only allow timer reset if we haven't exceeded the limit of 3 resets
    if (currentResetCount < 3) {
      // Clear existing timeout
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }

      // Increment reset count
      timerResetCountRef.current.set(sacredWord, currentResetCount + 1);

      // Keep the overlay visible and reset the 3-second timer
      overlayTimeoutRef.current = setTimeout(() => {
        setOverlayState(prev => ({
          ...prev,
          isVisible: false
        }));

        // Clear the word after fade out animation
        setTimeout(() => {
          setOverlayState({
            isVisible: false,
            sacredWord: ''
          });
        }, 300); // Match CSS transition duration
      }, 3000);

      console.log(`[SacredWordDetection] Timer reset for "${sacredWord}" (${currentResetCount + 1}/3)`);
    } else {
      console.log(`[SacredWordDetection] Timer reset limit reached for "${sacredWord}"`);
    }
  }, []);

  const detectInTranscript = useCallback((
    combinedText: string,
    context: 'general' | 'shabad' = 'general',
    isDisplayingResults: boolean = false
  ): DetectionResult => {
    const trimmedText = combinedText.trim();

    if (!trimmedText) {
      return {
        match: null,
        filteredTranscript: ''
      };
    }

    // Single pass detection and removal
    const { matches, filteredText } = detectAndRemoveSacredWords(trimmedText, context);

    if (matches.length === 0) {
      return {
        match: null,
        filteredTranscript: trimmedText
      };
    }

    // Get the first match (they're already sorted by priority)
    const bestMatch = matches[0];

    console.log('[SacredWordDetection] Sacred word detected:', bestMatch.pattern);

    // CRITICAL: Always check for reset trigger FIRST, even when displaying results
    // This must happen BEFORE the overlay logic and outside shouldShowOverlay condition
    if (isResetTrigger(bestMatch.pattern)) {
      console.log('[SacredWordDetection] WJKK WJKF detected - triggering reset (works during results display)');
      setShouldResetSearch(true);
    }

    // Show overlay logic - only after sacred word has been detected AND removed from filteredText
    const shouldShowOverlay = !isDisplayingResults || !isMoolMantar(bestMatch.pattern);

    if (shouldShowOverlay) {
      // Get the categorized display text for this match
      const displayText = getDisplayTextForPattern(bestMatch.pattern);

      // Use setTimeout to ensure overlay shows after the text processing is complete
      setTimeout(() => {
        // Check if we've already shown overlay for this exact text
        if (shownTextsRef.current.has(displayText)) {
          // Text already shown - check if overlay is currently visible for timer reset
          if (overlayState.isVisible && overlayState.sacredWord === displayText) {
            resetOverlayTimer(displayText);
          }
          // If overlay not visible, don't show again for same text
          return;
        }

        // New text - show overlay and mark as shown
        console.log('[SacredWordDetection] Sacred word overlay shown after removal:', displayText);
        shownTextsRef.current.add(displayText);
        timerResetCountRef.current.set(displayText, 0); // Initialize reset count
        lastMatchRef.current = bestMatch.pattern;
        showOverlay(displayText);
      }, 0); // Use setTimeout with 0 delay to ensure it runs after current execution context
    }

    return {
      match: bestMatch,
      filteredTranscript: filteredText
    };
  }, [isMoolMantar, showOverlay, getDisplayTextForPattern, resetOverlayTimer, isResetTrigger, overlayState.isVisible, overlayState.sacredWord]);

  // Function to clear tracking data (can be called externally if needed)
  const clearTrackingData = useCallback(() => {
    shownTextsRef.current.clear();
    timerResetCountRef.current.clear();
    lastMatchRef.current = '';
    console.log('[SacredWordDetection] Tracking data cleared');
  }, []);

  // Function to clear the reset flag after it's been consumed
  const clearResetFlag = useCallback(() => {
    setShouldResetSearch(false);
    console.log('[SacredWordDetection] Reset flag cleared');
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, []);

  return {
    detectInTranscript,
    overlayState,
    clearTrackingData,
    shouldResetSearch,
    clearResetFlag
  };
} 