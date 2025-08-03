import { useCallback } from 'react';
import { detectSacredMatches } from '../services/sacredWordDetector';
import { SpeechRecognitionResult } from '../types/speechRecognition';

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
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const detectInTranscript = useCallback((
    combinedText: string, 
    context: 'general' | 'shabad' = 'general'
  ): DetectionResult => {
    const trimmedText = combinedText.trim();
    
    // Process the combined text (same as subtitle logic)
    const matches = detectSacredMatches(trimmedText, context);
    
    if (matches.length === 0) {
      return {
        match: null,
        filteredTranscript: trimmedText
      };
    }

    // Get the match with highest confidence score
    const bestMatch = matches.reduce((prev, current) => 
      current.score > prev.score ? current : prev
    );

    console.log('[SacredWordDetection] Matched word:', bestMatch.match);

    // Remove the matched phrase from the transcript using multiple strategies
    let filteredTranscript = trimmedText;
    const matchWords = bestMatch.match.split(/\s+/);
    
    // Strategy 1: Try exact phrase removal first
    const escapedMatch = escapeRegExp(bestMatch.match);
    const exactRemoval = filteredTranscript.replace(new RegExp(`\\b${escapedMatch}\\b`, 'gi'), '');
    
    if (exactRemoval !== filteredTranscript && exactRemoval.trim().length < filteredTranscript.length) {
      filteredTranscript = exactRemoval;
    } else {
      // Strategy 2: Remove individual words from the match
      const inputWords = trimmedText.split(/\s+/);
      const filteredWords = inputWords.filter(inputWord => 
        !matchWords.some(matchWord => 
          inputWord.toLowerCase().trim() === matchWord.toLowerCase().trim()
        )
      );
      filteredTranscript = filteredWords.join(' ');
    }
    
    // Strategy 3: If still contains sacred words, try more aggressive removal
    if (matchWords.some(word => filteredTranscript.toLowerCase().includes(word.toLowerCase()))) {
      matchWords.forEach(word => {
        const escapedWord = escapeRegExp(word);
        filteredTranscript = filteredTranscript.replace(new RegExp(`\\b${escapedWord}\\b`, 'gi'), '');
      });
    }
    
    // Clean up extra whitespace
    filteredTranscript = filteredTranscript.replace(/\s+/g, ' ').trim();
    
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