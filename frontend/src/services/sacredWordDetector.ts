// Fast exact matching for sacred words - no fuzzy search needed for performance
const SACRED_PATTERNS = [
  // Longer phrases first (for better matching priority)
  'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
  'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
  // Mool Mantar starts
  'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',
  'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',
  'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ',
  'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ',
  'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰੁ',
  'ਸਤਿਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ',
  'ਸਤਿ ਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ',
  'ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',
  //Mool Mantar Ends
  'ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
  'ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
  'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
  'ਧੰਨ ਗੁਰੂ ਨਾਨਕ',
  'ਧਨ ਗੁਰੂ ਨਾਨਕ',
  'ਧੰਨ ਗੁਰ ਨਾਨਕ',
  'ਧਨ ਗੁਰ ਨਾਨਕ',

  // Three word phrases
  'ਜੀ ਕਾ ਖਾਲਸਾ',
  'ਜੀ ਕਾ ਖ਼ਾਲਸਾ',
  'ਜੀ ਕੀ ਫਤਿਹ',
  'ਜੀ ਕੀ ਫ਼ਤਿਹ',
  'ਬੋਲੇ ਸੋ ਨਿਹਾਲ',
  'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',

  // Two word phrases
  'ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ',
  // 'ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ', as it's searchable
  'ਇਕ ਓਕਾਰ',
  'ਇ ਓਕਾਰ',
  'ਇਕ ਓਂਕਾਰ',
  'ਬੋਲੇ ਸੋ',
  'ਸੋ ਨਿਹਾਲ',

  // Single words
  'ਵਾਹਿਗੁਰੂ',
  'ਇਓਕਾਰ',
  'ੴ',
]

// Pre-normalize patterns for consistent comparison and performance
const NORMALIZED_PATTERNS = SACRED_PATTERNS.map(p => p.normalize('NFC'))

// Combined function that detects and removes sacred words in one pass.
//
// KEY FIX: The original implementation had a `break` after removing the first
// matched pattern. This caused two problems:
//   1. Multiple sacred words in the same segment (e.g. "Waheguru ... Bole So Nihal")
//      would only have the first one removed.
//   2. On the next speech segment, residual unremoved patterns caused false
//      re-detections even though the detection hook thought the text was clean.
//
// We now continue iterating all patterns so every sacred phrase in the segment
// is fully stripped. The `matches` array still only records the first match
// (highest-priority hit) for overlay display purposes.
export function detectAndRemoveSacredWords(
  text: string,
  context: 'general' | 'shabad' = 'general'
): { matches: any[], filteredText: string } {
  if (!text || text.trim().length === 0) {
    return { matches: [], filteredText: text }
  }

  const normalized = text.normalize('NFC').replace(/\s+/g, ' ').trim()
  let filteredText = normalized
  const matches = []

  for (const pattern of NORMALIZED_PATTERNS) {
    if (normalized.includes(pattern)) {
      // Record only the highest-priority (first) match for overlay display
      if (matches.length === 0) {
        matches.push({
          match: pattern,
          displayText: pattern,
          rule: { context: 'both' },
          score: 1.0,
        })
      }

      // Always attempt removal even if this isn't the first match
      // (removed the `break` that was here — was preventing full cleanup)
      if (filteredText.includes(pattern)) {
        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        filteredText = filteredText.replace(regex, '').replace(/\s+/g, ' ').trim()
      }
    }
  }

  return { matches, filteredText }
}

// Keep original function for backward compatibility
export function detectSacredMatches(
  text: string,
  context: 'general' | 'shabad'
) {
  const result = detectAndRemoveSacredWords(text, context)
  return result.matches
}

// Fast removal function using optimized approach
export function removeSacredWords(text: string): string {
  if (!text || text.trim().length === 0) {
    return text
  }

  let result = text.normalize('NFC').replace(/\s+/g, ' ').trim()

  for (const pattern of NORMALIZED_PATTERNS) {
    if (result.includes(pattern)) {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      result = result.replace(regex, '').replace(/\s+/g, ' ').trim()
      // NOTE: no break here — continue to remove all matching patterns
    }
  }

  return result
}