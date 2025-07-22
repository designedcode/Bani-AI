import React, { useEffect, useRef, useState } from 'react';

interface FullShabadDisplayProps {
  shabads: any[];
  transcribedText: string;
  onNeedNextShabad: () => void;
}

// Progressive search configuration
const PHRASE_MATCH_THRESHOLD = 60; // High precision for first match
const SEQUENTIAL_MATCH_THRESHOLD = 40; // High recall for sequential matches
const PHRASE_LENGTHS = [2, 3, 4]; // Try phrases of 2-4 words
const CONTEXT_WINDOW_SIZE = 2; // Current + next verse for sequential search

// Utility to remove diacritics and normalize for comparison
function normalizeGurmukhi(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove common Unicode diacritics
    .replace(/[\u0A3C\u0A3E-\u0A4C\u0A70\u0A71]/g, '') // Remove Gurmukhi diacritics
    .toLowerCase();
}

// Simple similarity function (Levenshtein distance based percentage)
function similarity(a: string, b: string): number {
  a = normalizeGurmukhi(a);
  b = normalizeGurmukhi(b);
  console.log('[DEBUG] similarity input:', { a, b });
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  const lev = matrix[a.length][b.length];
  const result = 1 - lev / Math.max(a.length, b.length);
  console.log('[DEBUG] similarity result:', result, 'levenshtein:', lev, 'maxLength:', Math.max(a.length, b.length));
  return result;
}

// Create phrases of different lengths from text
function createPhrases(text: string, lengths: number[]): string[] {
  const words = text.trim().split(/\s+/);
  const phrases: string[] = [];
  for (const length of lengths) {
    for (let i = 0; i <= words.length - length; i++) {
      const phrase = words.slice(i, i + length).join(' ');
      phrases.push(phrase);
    }
  }
  return phrases;
}

// Calculate contextual score considering word sequence and position
function calculateContextualScore(phrase: string, line: string, positionWeight: number = 0.3): number {
  const phraseWords = phrase.split(/\s+/);
  const lineWords = line.split(/\s+/);
  
  if (!phraseWords.length || !lineWords.length) {
    return 0.0;
  }
  
  // Find the best matching position in the line
  let bestScore = 0.0;
  for (let i = 0; i <= lineWords.length - phraseWords.length; i++) {
    // Check if phrase words appear in sequence
    let sequenceMatch = 0;
    for (let j = 0; j < phraseWords.length; j++) {
      if (i + j < lineWords.length) {
        const wordSimilarity = similarity(phraseWords[j], lineWords[i + j]);
        if (wordSimilarity > 0.7) { // Word-level threshold
          sequenceMatch += wordSimilarity;
        }
      }
    }
    
    if (sequenceMatch > 0) {
      // Calculate position weight (words at beginning get higher weight)
      const positionScore = 1.0 - (i / lineWords.length) * positionWeight;
      const currentScore = (sequenceMatch / phraseWords.length) * positionScore;
      bestScore = Math.max(bestScore, currentScore);
    }
  }
  
  return bestScore * 100; // Convert to percentage
}

// Progressive context-aware fuzzy search
// NOTE: This implementation assumes users read line by line sequentially and sometimes repeat verses.
// This behavior assumption needs to be revisited in later versions for more complex user patterns.
function progressiveFuzzySearch(
  query: string, 
  lines: string[], 
  highlightedLineIndex: number | null = null
): { bestLineIndex: number; bestScore: number } | null {
  if (!query.trim() || !lines.length) {
    return null;
  }
  
  // Create phrases from the query
  const phrases = createPhrases(query, PHRASE_LENGTHS);
  console.log('[DEBUG] Created phrases:', phrases);
  
  let bestScore = -1;
  let bestLineIndex = -1;
  
  // Determine search context
  let searchLines: string[];
  let searchIndices: number[];
  let threshold: number;
  
  if (highlightedLineIndex !== null) {
    // Sequential search: current + next verse
    const startIndex = Math.max(0, highlightedLineIndex);
    const endIndex = Math.min(lines.length, highlightedLineIndex + CONTEXT_WINDOW_SIZE + 1);
    searchLines = lines.slice(startIndex, endIndex);
    searchIndices = Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i);
    threshold = SEQUENTIAL_MATCH_THRESHOLD;
    console.log('[DEBUG] Sequential search:', { startIndex, endIndex, threshold });
  } else {
    // Full shabad search
    searchLines = lines;
    searchIndices = Array.from({ length: lines.length }, (_, i) => i);
    threshold = PHRASE_MATCH_THRESHOLD;
    console.log('[DEBUG] Full shabad search:', { threshold });
  }
  
  // Search through the determined context
  for (const phrase of phrases) {
    for (let i = 0; i < searchLines.length; i++) {
      const line = searchLines[i];
      
      // Calculate contextual score
      const contextualScore = calculateContextualScore(phrase, line);
      
      // Also try direct similarity as fallback
      const directScore = similarity(phrase, line) * 100;
      
      // Use the better score
      const score = Math.max(contextualScore, directScore);
      
      if (score > bestScore) {
        bestScore = score;
        bestLineIndex = searchIndices[i];
      }
    }
  }
  
  console.log('[DEBUG] Best match:', { bestLineIndex, bestScore, threshold });
  
  if (bestScore >= threshold) {
    return { bestLineIndex, bestScore };
  } else {
    // If sequential search failed, try full shabad search as fallback
    if (highlightedLineIndex !== null) {
      console.log('[DEBUG] Sequential search failed, trying full shabad search as fallback');
      return progressiveFuzzySearch(query, lines, null);
    } else {
      return bestScore > 0 ? { bestLineIndex, bestScore } : null;
    }
  }
}

const HIGHLIGHT_THRESHOLD = 0.6; // 60% - Back to original threshold

const FullShabadDisplay: React.FC<FullShabadDisplayProps> = ({ shabads, transcribedText, onNeedNextShabad }) => {
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [highlightedLineIndex, setHighlightedLineIndex] = useState<number | null>(null);

  // Flatten all lines from all shabads
  const allLines: { line: any; shabadIndex: number; lineIndex: number }[] = [];
  shabads.forEach((shabad, sIdx) => {
    (shabad.lines_highlighted || []).forEach((line: any, lIdx: number) => {
      allLines.push({ line, shabadIndex: sIdx, lineIndex: lIdx });
    });
  });

  // Progressive search over all lines
  useEffect(() => {
    if (!shabads.length || !transcribedText) return;
    const gurmukhiLines = allLines.map(({ line }) =>
      line.gurmukhi_original || (line.gurmukhi_highlighted ? line.gurmukhi_highlighted.replace(/<[^>]+>/g, '') : '') || ''
    );
    const result = progressiveFuzzySearch(transcribedText, gurmukhiLines, highlightedLineIndex);
    if (result) {
      setHighlightedLineIndex(result.bestLineIndex);
      // If at second last or last line of last shabad, trigger fetch for next shabad
      const lastShabad = shabads[shabads.length - 1];
      const lastShabadStartIdx = allLines.findIndex(l => l.shabadIndex === shabads.length - 1 && l.lineIndex === 0);
      const lastShabadLines = (lastShabad?.lines_highlighted || []).length;
      if (
        (result.bestLineIndex === lastShabadStartIdx + lastShabadLines - 2 ||
         result.bestLineIndex === lastShabadStartIdx + lastShabadLines - 1) &&
        lastShabad.shabad_id
      ) {
        onNeedNextShabad();
      }
    }
  }, [shabads, transcribedText]);

  // Auto-scroll to highlighted verse
  useEffect(() => {
    if (highlightedLineIndex !== null && lineRefs.current[highlightedLineIndex]) {
      lineRefs.current[highlightedLineIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedLineIndex]);

  // Render all shabads with divider
  let currentShabadIdx = -1;
  return (
    <div className="full-shabad-display">
      {allLines.map(({ line, shabadIndex, lineIndex }, idx) => {
        let divider = null;
        let shabadHeader = null;
        if (shabadIndex !== currentShabadIdx) {
          currentShabadIdx = shabadIndex;
          const shabad = shabads[shabadIndex];
          if (shabadIndex > 0) {
            divider = <div style={{ borderTop: '2px solid #ccc', margin: '2rem 0' }} />;
          }
          shabadHeader = (
            <div className="shabad-header">
              {shabad.raag && <div className="shabad-raag"><b>Raag:</b> {shabad.raag}</div>}
              {shabad.writer && <div className="shabad-writer"><b>Writer:</b> {shabad.writer}</div>}
              {shabad.shabad_name && <div className="shabad-title"><b>Title:</b> {shabad.shabad_name}</div>}
              {shabad.page_no && <div className="shabad-page"><b>Page:</b> {shabad.page_no}</div>}
              {shabad.source && <div className="shabad-source"><b>Source:</b> {shabad.source}</div>}
            </div>
          );
        }
        const isHighlighted = idx === highlightedLineIndex;
        let lineClass = 'shabad-line';
        if (isHighlighted) lineClass += ' highlighted highlighted-green';
        // Optionally add 'matched-green' if you have a match state
        return (
          <React.Fragment key={`shabad${shabadIndex}-line${lineIndex}`}>
            {divider}
            {shabadHeader}
            <div
              ref={el => (lineRefs.current[idx] = el)}
              className={lineClass}
            >
              <div className="gurmukhi-text">
                {line.gurmukhi_highlighted || line.gurmukhi_original}
              </div>
              {line.transliteration && (
                <div className="transliteration">
                  {line.transliteration}
                </div>
              )}
              {line.translation && (
                <div className="translation">
                  {line.translation}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default FullShabadDisplay; 