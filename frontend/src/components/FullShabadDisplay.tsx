import React, { useEffect, useRef } from 'react';

interface FullShabadDisplayProps {
  fullShabad: any;
  lastWord: string;
}

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
  return 1 - lev / Math.max(a.length, b.length);
}

const HIGHLIGHT_THRESHOLD = 0.8; // 80%

const FullShabadDisplay: React.FC<FullShabadDisplayProps> = ({ fullShabad, lastWord }) => {
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Highlight logic
  function highlightLine(line: any): { html: string; matched: boolean } {
    // Use the correct property for the Gurmukhi text
    const gurmukhiRaw = line.gurmukhi_original || (line.gurmukhi_highlighted ? line.gurmukhi_highlighted.replace(/<[^>]+>/g, '') : '');
    if (!lastWord || !gurmukhiRaw) {
      console.log('[Highlight] Skipping line (no lastWord or no Gurmukhi text)', { lastWord, line });
      return { html: line.gurmukhi_highlighted || gurmukhiRaw, matched: false };
    }
    console.log('[Highlight] Using Gurmukhi text for matching:', gurmukhiRaw);
    const words = gurmukhiRaw.split(/\s+/);
    let matched = false;
    const highlighted = words.map((w: string) => {
      const sim = similarity(w, lastWord);
      if (sim >= HIGHLIGHT_THRESHOLD) {
        matched = true;
        console.log(`[Highlight] Matched word: '${w}' with lastWord: '${lastWord}' (similarity: ${sim})`);
        return `<mark>${w}</mark>`;
      } else {
        console.log(`[Highlight] No match: '${w}' with lastWord: '${lastWord}' (similarity: ${sim})`);
      }
      return w;
    });
    if (matched) {
      console.log(`[Highlight] Line matched for lastWord '${lastWord}':`, gurmukhiRaw);
    }
    return {
      html: highlighted.join(' '),
      matched,
    };
  }

  useEffect(() => {
    if (!fullShabad || !lastWord) return;
    // Find the first line with a <mark>
    const idx = fullShabad.lines_highlighted?.findIndex((line: any) =>
      line.gurmukhi_highlighted && line.gurmukhi_highlighted.includes('<mark>')
    );
    if (idx !== undefined && idx >= 0 && lineRefs.current[idx]) {
      lineRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [fullShabad, lastWord]);

  if (!fullShabad || fullShabad.error) return null;
  return (
    <div className="full-shabad-display">
      {/* Shabad Header */}
      <div className="shabad-header">
        {fullShabad.raag && (
          <div className="shabad-raag">{fullShabad.raag}</div>
        )}
        {fullShabad.writer && (
          <div className="shabad-writer">{fullShabad.writer}</div>
        )}
        {fullShabad.shabad_name && (
          <div className="shabad-title">{fullShabad.shabad_name}</div>
        )}
        {fullShabad.page_no && (
          <div className="shabad-page">Page {fullShabad.page_no}</div>
        )}
        {fullShabad.source && (
          <div className="shabad-source">{fullShabad.source}</div>
        )}
      </div>
      <div className="shabad-lines">
        {fullShabad.lines_highlighted && fullShabad.lines_highlighted.length > 0 ? (
          fullShabad.lines_highlighted.map((line: any, idx: number) => {
            // Use our highlight logic for all lines
            const { html, matched } = highlightLine(line);
            return (
              <div
                key={idx}
                className={`shabad-line${matched ? ' matched-green' : ''}`}
                ref={el => lineRefs.current[idx] = el}
              >
                <div className="gurmukhi-text" dangerouslySetInnerHTML={{ __html: html }} />
                {line.transliteration && <div className="transliteration">{line.transliteration}</div>}
                {line.translation && <div className="translation">{line.translation}</div>}
              </div>
            );
          })
        ) : (
          <div>No lines to display.</div>
        )}
      </div>
    </div>
  );
};

export default FullShabadDisplay; 