import { useCallback } from 'react';
import { detectSacredMatches, removeSacredWords } from '../services/sacredWordDetector';

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
  detectInTranscript: (combinedText: string, context?: 'general' | 'shabad') => DetectionResult;
}

export function useSacredWordDetection(): UseSacredWordDetectionReturn {
  const detectInTranscript = useCallback((
    combinedText: string, 
    context: 'general' | 'shabad' = 'general'
  ): DetectionResult => {
    const trimmedText = combinedText.trim();
    
    if (!trimmedText) {
      return {
        match: null,
        filteredTranscript: ''
      };
    }

    // Fast detection using optimized function
    const matches = detectSacredMatches(trimmedText, context);
    
    // Fast removal using optimized function
    const filteredTranscript = removeSacredWords(trimmedText);
    
    if (matches.length === 0) {
      return {
        match: null,
        filteredTranscript: trimmedText
      };
    }

    // Get the first match (they're already sorted by priority)
    const bestMatch = matches[0];

    console.log('[SacredWordDetection] Matched word:', bestMatch.match);
    console.log('[SacredWordDetection] Filtered transcript:', filteredTranscript);

    return {
      match: bestMatch,
      filteredTranscript
    };
  }, []);

  return {
    detectInTranscript
  };
} 