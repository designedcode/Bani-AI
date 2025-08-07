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
  }
};

// Mool Mantar patterns that should not trigger overlay during search results
const MOOL_MANTAR_PATTERNS = SACRED_WORD_CATEGORIES.MOOL_MANTAR.patterns;

export function useSacredWordDetection(): UseSacredWordDetectionReturn {
  const [overlayState, setOverlayState] = useState({
    isVisible: false,
    sacredWord: ''
  });
  
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMatchRef = useRef<string>('');

  // Helper function to check if a match is Mool Mantar
  const isMoolMantar = useCallback((matchText: string): boolean => {
    const normalized = matchText.normalize('NFC');
    return MOOL_MANTAR_PATTERNS.some(pattern => 
      normalized.includes(pattern) || pattern.includes(normalized)
    );
  }, []);

  // Helper function to get the display text for a matched pattern
  const getDisplayTextForPattern = useCallback((matchText: string): string => {
    const normalized = matchText.normalize('NFC');
    
    // Check for exact pattern match first - this is the key fix
    for (const category of Object.values(SACRED_WORD_CATEGORIES)) {
      if (category.patterns.includes(normalized)) {
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

  // Function to reset timer for duplicate matches
  const resetOverlayTimer = useCallback((sacredWord: string) => {
    // Clear existing timeout
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }

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

    console.log('[SacredWordDetection] Sacred word detected:', bestMatch.match);

    // Show overlay logic
    const shouldShowOverlay = !isDisplayingResults || !isMoolMantar(bestMatch.match);
    
    if (shouldShowOverlay) {
      // Get the categorized display text for this match
      const displayText = getDisplayTextForPattern(bestMatch.match);
      
      // Check if this is the same category as the last match
      const lastDisplayText = lastMatchRef.current ? getDisplayTextForPattern(lastMatchRef.current) : '';
      
      if (displayText === lastDisplayText && overlayState.isVisible) {
        // Same sacred word category detected again - reset the timer
        resetOverlayTimer(displayText);
      } else if (displayText !== lastDisplayText) {
        // Different sacred word category - show new overlay
        console.log('[SacredWordDetection] Sacred word overlay shown:', displayText);
        lastMatchRef.current = bestMatch.match;
        showOverlay(displayText);
      }
      // If same category but overlay not visible, treat as new match
      else if (!overlayState.isVisible) {
        lastMatchRef.current = bestMatch.match;
        showOverlay(displayText);
      }
    }

    return {
      match: bestMatch,
      filteredTranscript: filteredText
    };
  }, [isMoolMantar, showOverlay, getDisplayTextForPattern, resetOverlayTimer, overlayState.isVisible]);

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
    overlayState
  };
} 