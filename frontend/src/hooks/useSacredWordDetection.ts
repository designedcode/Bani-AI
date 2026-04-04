import { useCallback, useState, useRef, useEffect } from 'react';
import { removeSacredWords } from '../services/sacredWordDetector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SacredPhrase {
  pattern: string;
  displayText: string;
  priority: number;
  overlayMs: number;
  /**
   * While THIS phrase's overlay is visible, these patterns are suppressed so
   * they can't fire concurrently — e.g. Khalsa Fateh suppresses Waheguru
   * because ਵਾਹਿਗੁਰੂ is a substring of the full Fateh greeting.
   */
  suppressPatterns?: string[];
}

interface UseSacredWordDetectionReturn {
  processSpeech: (rawText: string, isFinal: boolean) => string;
  overlayState: { isVisible: boolean; sacredWord: string; key: number };
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Phrase list  (priority 0 = highest)
// ---------------------------------------------------------------------------

const SACRED_PHRASES: SacredPhrase[] = [
  // ── Mool Mantar (priority 0) ────────────────────────────────────────────
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ', pattern: 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ', pattern: 'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰੁ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', pattern: 'ਸਤਿ ਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ' },
  { priority: 0, overlayMs: 4000, displayText: 'ੴ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',                          pattern: 'ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ' },

  // ── Khalsa Fateh (priority 1) ────────────────────────────────────────────
  { priority: 1, overlayMs: 3000, displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ', pattern: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ', suppressPatterns: ['ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ', 'ਵਾਹਿਗੁਰੂ'] },
  { priority: 1, overlayMs: 3000, displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ', pattern: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ', suppressPatterns: ['ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ', 'ਵਾਹਿਗੁਰੂ'] },
  { priority: 1, overlayMs: 3000, displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ', pattern: 'ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',          suppressPatterns: ['ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ', 'ਵਾਹਿਗੁਰੂ'] },
  { priority: 1, overlayMs: 3000, displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ', pattern: 'ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',           suppressPatterns: ['ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ', 'ਵਾਹਿਗੁਰੂ'] },

  // ── Bole So Nihal (priority 2) ───────────────────────────────────────────
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਬੋਲੇ ਸੋ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', pattern: 'ਸੋ ਨਿਹਾਲ' },

  // ── Dhan Guru Nanak (priority 2) ────────────────────────────────────────
  { priority: 2, overlayMs: 2000, displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ', pattern: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ', pattern: 'ਧਨ ਗੁਰੂ ਨਾਨਕ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ', pattern: 'ਧੰਨ ਗੁਰ ਨਾਨਕ' },
  { priority: 2, overlayMs: 2000, displayText: 'ਧੰਨ ਗੁਰੂ ਨਾਨਕ', pattern: 'ਧਨ ਗੁਰ ਨਾਨਕ' },

  // ── Ik Onkar (priority 2) ────────────────────────────────────────────────
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ੴ' },
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ਇਕ ਓਕਾਰ' },
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ਇਕ ਓਂਕਾਰ' },
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ਇ ਓਕਾਰ' },
  { priority: 2, overlayMs: 1500, displayText: 'ੴ', pattern: 'ਇਓਕਾਰ' },

  // ── Waheguru (priority 3 — lowest) ──────────────────────────────────────
  { priority: 3, overlayMs: 1500, displayText: 'ਵਾਹਿਗੁਰੂ', pattern: 'ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ' },
  { priority: 3, overlayMs: 1500, displayText: 'ਵਾਹਿਗੁਰੂ', pattern: 'ਵਾਹਿਗੁਰੂ' },
].map(p => ({ ...p, pattern: p.pattern.normalize('NFC') }));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Min ms between interim scans — rate-limits the rapid rewrite events */
const INTERIM_SCAN_INTERVAL_MS = 200;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSacredWordDetection(
  isDisplayingResults: boolean = false
): UseSacredWordDetectionReturn {

  const [overlayState, setOverlayState] = useState<{
    isVisible: boolean;
    sacredWord: string;
    key: number;
  }>({ isVisible: false, sacredWord: '', key: 0 });

  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  /**
   * Per-displayText fire timestamps.  Keyed by displayText (not pattern) so ALL
   * variant patterns that produce the same word share one expiry entry.
   * e.g. Fateh with/without nuqtas, Waheguru single/double — all keyed as one.
   *
   * A word can fire again only once Date.now() >= firedAt + overlayMs.
   */
  const firedAtRef = useRef<Map<string, number>>(new Map()); // displayText → timestamp

  /**
   * Per-utterance consumed set for INTERIM scans.  Keyed by displayText
   * so ALL variant patterns for the same word are blocked together.
   * e.g. once "ਵਾਹਿਗੁਰੂ" fires, both single and double patterns are consumed.
   *
   * Cleared at the start of every final so each new utterance scans fresh.
   */
  const utteranceConsumedRef = useRef<Set<string>>(new Set()); // displayText

  /**
   * Patterns suppressed while a higher-priority overlay is visible.
   * Cleared when that overlay's timeout fires.
   */
  const suppressedRef = useRef<Set<string>>(new Set());

  /** Rate-limit timestamp for interim scans */
  const lastInterimScanRef = useRef<number>(0);

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Returns true if this word's overlay has expired and it can fire again. */
  const canFire = useCallback((phrase: SacredPhrase): boolean => {
    const firedAt = firedAtRef.current.get(phrase.displayText) ?? 0;
    return Date.now() >= firedAt + phrase.overlayMs;
  }, []);

  /**
   * Scan text for the highest-priority sacred phrase that:
   *  1. is present in the text
   *  2. is not suppressed  
   *  3. can fire (firedAt expiry — keyed by displayText)
   *  4. displayText is not in the optional utteranceConsumed set
   */
  const scanText = useCallback((
    text: string,
    utteranceConsumed?: Set<string>
  ): SacredPhrase | null => {
    let best: SacredPhrase | null = null;

    for (const phrase of SACRED_PHRASES) {
      if (!text.includes(phrase.pattern)) continue;
      if (suppressedRef.current.has(phrase.pattern)) continue;
      if (!canFire(phrase)) continue;                          // displayText-keyed expiry
      if (utteranceConsumed?.has(phrase.displayText)) continue; // displayText-keyed consumed

      if (!best || phrase.priority < best.priority) {
        best = phrase;
      }
      if (best.priority === 0) break; // can't do better
    }

    return best;
  }, [canFire]);

  /** Render the overlay immediately. */
  const showOverlay = useCallback((phrase: SacredPhrase) => {
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);

    // Record suppression set (prevents Waheguru while Fateh is showing)
    suppressedRef.current = new Set(phrase.suppressPatterns ?? []);

    // Stamp fire time keyed by displayText — blocks ALL variant patterns of this word
    firedAtRef.current.set(phrase.displayText, Date.now());

    // Increment key → React remounts the component → animation restarts instantly
    keyRef.current += 1;
    setOverlayState({ isVisible: true, sacredWord: phrase.displayText, key: keyRef.current });

    console.log(
      `[Overlay] ▶ Show: "${phrase.displayText}"  priority=${phrase.priority}  dur=${phrase.overlayMs}ms`
    );

    overlayTimeoutRef.current = setTimeout(() => {
      suppressedRef.current = new Set();
      setOverlayState(prev => ({ ...prev, isVisible: false }));
    }, phrase.overlayMs);
  }, []);

  // ── Main processing function ──────────────────────────────────────────────

  const processSpeech = useCallback((rawText: string, isFinal: boolean): string => {
    if (!rawText.trim()) return rawText;

    // Normalise only the CURRENT utterance text.
    // We do NOT use an accumulated buffer — sacred words are always spoken
    // within a single recognition segment so scanning the current text alone
    // is sufficient and avoids cross-utterance noise entirely.
    const text = rawText.trim().normalize('NFC').replace(/\s+/g, ' ');

    if (isFinal) {
      // Reset utterance consumed so the next interim stream starts fresh
      utteranceConsumedRef.current.clear();
      lastInterimScanRef.current = 0;

      // Final scan — uses only firedAtRef (expiry-based), no utterance consumed
      const match = scanText(text);
      if (match) {
        const isMoolMantar = match.priority === 0;
        if (!(isDisplayingResults && isMoolMantar)) {
          showOverlay(match);
        }
      }
    } else {
      // Rate-limit interim scans
      const now = Date.now();
      if (now - lastInterimScanRef.current < INTERIM_SCAN_INTERVAL_MS) {
        return removeSacredWords(rawText);
      }
      lastInterimScanRef.current = now;

      // Interim scan — utteranceConsumed (keyed by displayText) ensures each
      // WORD fires at most once per utterance regardless of which pattern variant
      // the speech recogniser happens to produce.
      const match = scanText(text, utteranceConsumedRef.current);
      if (match) {
        utteranceConsumedRef.current.add(match.displayText); // block all variants
        const isMoolMantar = match.priority === 0;
        if (!(isDisplayingResults && isMoolMantar)) {
          showOverlay(match);
        }
      }
    }

    return removeSacredWords(rawText);
  }, [isDisplayingResults, scanText, showOverlay]);

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    firedAtRef.current.clear();
    utteranceConsumedRef.current.clear();
    suppressedRef.current.clear();
    lastInterimScanRef.current = 0;
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    setOverlayState({ isVisible: false, sacredWord: '', key: keyRef.current });
  }, []);

  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, []);

  return { processSpeech, overlayState, reset };
}