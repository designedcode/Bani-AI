import Fuse from 'fuse.js'

// Define your detection rules
interface DetectionRule {
  patterns: string[]
  displayText: string
  confidence: number
  context: 'general' | 'shabad' | 'both'
}

const detectionRules: DetectionRule[] = [
  {
    patterns: ['ੴ', 'ਇਕ ਓਕਾਰ', 'ਇ ਓਕਾਰ', 'ਇਕ ਓਂਕਾਰ'],
    displayText: '',
    confidence: 70,
    context: 'general'
  },
  {
    patterns: ['ਵਾਹਿਗੁਰੂ', 'ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ'],
    displayText: 'ਵਾਹਿਗੁਰੂ',
    confidence: 70,
    context: 'both'
  },
  {
    patterns: ['ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ'],
    displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
    confidence: 70,
    context: 'both'
  },
  {
    patterns: ['ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ'],
    displayText: 'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ',
    confidence: 70,
    context: 'general'
  },
  {
    patterns: ['ਬੋਲੇ ਸੋ ਨਿਹਾਲ', 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ'],
    displayText: 'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
    confidence: 70,
    context: 'both'
  },
  {
    patterns: [
      'ਜੀ ਕਾ ਖਾਲਸਾ', 'ਜੀ ਕੀ ਫਤਿਹ'
    ],
    displayText: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
    confidence: 70,
    context: 'both'
  }
]

// Prepare list of matchable patterns
const matchList = detectionRules.flatMap(rule =>
  rule.patterns.map(p => ({ pattern: p, rule }))
)

const fuse = new Fuse(matchList, {
  keys: ['pattern'],
  includeScore: true,
  threshold: 0.6,  // More lenient: 40% match confidence required
  ignoreLocation: true,
  minMatchCharLength: 3,  // Minimum 3 characters must match
  findAllMatches: false   // Stop at first good match
})

// Function you will call in your app
export function detectSacredMatches(
  text: string,
  context: 'general' | 'shabad'
) {
  const normalized = text.normalize('NFC').trim()

  // Use fuzzy search for all matches
  const rawResults = fuse.search(normalized)

  const matches = rawResults
    .filter(r => {
      const rule = r.item.rule
      const pattern = r.item.pattern

      // Context filter
      if (!(rule.context === context || rule.context === 'both')) {
        return false
      }

      // Threshold for fuzzy matches (40% similarity)
      if (r.score! > 0.6) {
        return false
      }

      // Token set matching logic (similar to rapidfuzz)
      const inputTokens = normalized.split(/\s+/).filter(token => token.length > 0)
      const patternTokens = pattern.split(/\s+/).filter(token => token.length > 0)



      // Dynamic matching logic based on transcript length
      const inputLength = inputTokens.length
      const patternLength = patternTokens.length

      // Calculate dynamic overlap threshold based on input length
      let requiredOverlapRatio: number

      if (inputLength === 1) {
        // Single word: only match single word patterns
        if (patternLength > 1) {
          return false
        }
        requiredOverlapRatio = 1.0 // 100% match for single words
      } else if (inputLength <= 3) {
        // Short phrases (2-3 words): require high overlap
        requiredOverlapRatio = 0.8 // 80% overlap
      } else if (inputLength <= 6) {
        // Medium phrases (4-6 words): moderate overlap
        requiredOverlapRatio = 0.6 // 60% overlap
      } else {
        // Long phrases (7+ words): lower overlap requirement
        requiredOverlapRatio = 0.4 // 40% overlap
      }

      // For multi-word inputs, check token overlap
      if (inputLength > 1 && patternLength > 1) {
        // Length ratio check: prevent very short inputs from matching long patterns
        const lengthRatio = inputLength / patternLength

        // Dynamic length ratio based on input length
        let minLengthRatio: number
        if (inputLength <= 2) {
          minLengthRatio = 0.8 // Very strict for 1-2 words
        } else if (inputLength <= 4) {
          minLengthRatio = 0.6 // Moderate for 3-4 words
        } else {
          minLengthRatio = 0.5 // More lenient for 5+ words
        }

        if (lengthRatio < minLengthRatio) {
          return false
        }

        // Calculate token overlap ratio
        const commonTokens = inputTokens.filter(inputToken =>
          patternTokens.some(patternToken =>
            inputToken.toLowerCase() === patternToken.toLowerCase()
          )
        )

        const overlapRatio = commonTokens.length / Math.min(inputLength, patternLength)

        // Apply dynamic threshold
        if (overlapRatio < requiredOverlapRatio) {
          return false
        }
      }

      return true
    })
    .map(r => ({
      match: r.item.pattern,
      displayText: r.item.rule.displayText,
      rule: r.item.rule,
      score: 1 - r.score!
    }))

  return matches
}
