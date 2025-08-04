// Fast exact matching for sacred words - no fuzzy search needed for performance
const SACRED_PATTERNS = [
  // Longer phrases first (for better matching priority)
  // 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',
  'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
  'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
  'ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
  'ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
  'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
  'ਧੰਨ ਗੁਰੂ ਨਾਨਕ',
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
  'ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ',
  'ਇਕ ਓਕਾਰ',
  'ਇ ਓਕਾਰ',
  'ਇਕ ਓਂਕਾਰ',
  'ਬੋਲੇ ਸੋ',
  'ਸੋ ਨਿਹਾਲ',
  'ਸਤਿ ਸ੍ਰੀ',
  'ਸ੍ਰੀ ਅਕਾਲ',
  'ਜੀ ਕਾ',
  'ਕਾ ਖਾਲਸਾ',
  'ਕਾ ਖ਼ਾਲਸਾ',
  'ਜੀ ਕੀ',
  'ਕੀ ਫਤਿਹ',
  'ਕੀ ਫ਼ਤਿਹ',

  // Single words
  'ਵਾਹਿਗੁਰੂ',
  'ਖਾਲਸਾ',
  'ਖ਼ਾਲਸਾ',
  'ਫਤਿਹ',
  'ਫ਼ਤਿਹ',
  'ੴ'
]

// Create a Set for O(1) lookup performance
const PATTERN_SET = new Set(SACRED_PATTERNS.map(p => p.toLowerCase()))

// Fast exact matching function - much faster than fuzzy search
export function detectSacredMatches(
  text: string,
  context: 'general' | 'shabad'
) {
  if (!text || text.trim().length === 0) {
    return []
  }

  const normalized = text.normalize('NFC').trim().toLowerCase()

  // Check each pattern for exact substring matches (longest first)
  for (const pattern of SACRED_PATTERNS) {
    const lowerPattern = pattern.toLowerCase()

    // Fast substring check
    if (normalized.includes(lowerPattern)) {
      return [{
        match: pattern,
        displayText: pattern,
        rule: { context: 'both' },
        score: 1.0 // Perfect score for exact matches
      }]
    }
  }

  return []
}

// Additional fast check function for the comprehensive filter
export function containsSacredWords(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false
  }

  const normalized = text.normalize('NFC').trim().toLowerCase()

  // Fast check using Set lookup
  for (const pattern of SACRED_PATTERNS) {
    if (normalized.includes(pattern.toLowerCase())) {
      return true
    }
  }

  return false
}

// Fast removal function
export function removeSacredWords(text: string): string {
  if (!text || text.trim().length === 0) {
    return text
  }

  let result = text.normalize('NFC').trim()

  // Remove patterns (longest first to avoid partial removal issues)
  for (const pattern of SACRED_PATTERNS) {
    if (result.toLowerCase().includes(pattern.toLowerCase())) {
      // Use global case-insensitive replacement
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      result = result.replace(regex, '').replace(/\s+/g, ' ').trim()
    }
  }

  return result
}