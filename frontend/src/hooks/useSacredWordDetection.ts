import { useCallback } from 'react';
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

    console.log('[SacredWordDetection] Matched word:', bestMatch.match);
    console.log('[SacredWordDetection] Filtered transcript:', filteredText);

    return {
      match: bestMatch,
      filteredTranscript: filteredText
    };
  }, []);

  return {
    detectInTranscript
  };
} 