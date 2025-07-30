// Gurmukhi text processing utilities
// Ported from backend Python implementation

/**
 * Strip matras (vowel signs) from Gurmukhi text, keeping only the main letters.
 * This helps with search as BaniDB expects simplified Gurmukhi.
 * Also removes common non-distinctive phrases/symbols (e.g., Ik Onkar variants).
 */
export function stripGurmukhiMatras(text: string): string {
    if (!text) {
        return "";
    }

    // Normalize text
    text = text.normalize('NFC');

    // Remove ੴ (Ik Onkar) and common phrases explicitly
    const ignorePatterns = [
        '\u0A74',  // ੴ symbol (Ik Onkar)
        'ੴ',       // ੴ symbol (Ik Onkar, literal)
        'ਇਕ ਓਕਾਰ',  // Ek Onkar phrase
        'ਇ ਓਕਾਰ',   // I Okaar phrase
        'ਇਕ ਓਂਕਾਰ', // Ek Omkaar phrase
    ];

    for (const pattern of ignorePatterns) {
        text = text.replace(new RegExp(pattern, 'g'), '');
    }

    // First, convert problematic characters to their base forms
    const charMappings: Record<string, string> = {
        'ਆ': 'ਅ',  // aa -> base a
        'ਇ': 'ੲ',  // i -> base i
        'ਈ': 'ੲ',  // ii -> base i  
        'ਉ': 'ੳ',  // u -> base u
        'ਊ': 'ੳ',  // uu -> base u
        'ਏ': 'ੲ',  // e -> base i
        'ਐ': 'ੲ',  // ai -> base i
        //'ਓ': 'ੳ',  // o -> base u Since, o is already in it's base form
        'ਔ': 'ਅ',  // au -> base u
    };

    for (const [oldChar, newChar] of Object.entries(charMappings)) {
        text = text.replace(new RegExp(oldChar, 'g'), newChar);
    }

    // NFD normalize to decompose characters
    let normalizedText = text.normalize('NFD');

    // Remove conjunct 'ਰ' (subjoined ra) BEFORE matra/diacritic removal
    // [consonant][halant][ਰ] -> [consonant]
    normalizedText = normalizedText.replace(/([\u0A15-\u0A39])\u0A4D\u0A30/g, '$1');

    // Remove common matras and diacritics
    const matrasToRemove = [
        '\u0A3E',  // ਾ (aa)
        '\u0A3F',  // ਿ (i)
        '\u0A40',  // ੀ (ii)
        '\u0A41',  // ੁ (u)
        '\u0A42',  // ੂ (uu)
        '\u0A47',  // ੇ (e)
        '\u0A48',  // ੈ (ai)
        '\u0A4B',  // ੋ (o)
        '\u0A4C',  // ੌ (au)
        '\u0A4D',  // ੍ (halant/virama)
        '\u0A70',  // ੰ (tippi)
        '\u0A71',  // ੱ (addak)
        '\u0A02',  // ਂ (bindi)
        '\u0A01',  // ਁ (candrabindu)
    ];

    for (const matra of matrasToRemove) {
        normalizedText = normalizedText.replace(new RegExp(matra, 'g'), '');
    }

    // Remove any remaining combining marks
    let cleanedText = "";
    for (const char of normalizedText) {
        // Check if character is not a combining mark
        if (char.normalize('NFD').length === 1) {
            cleanedText += char;
        }
    }

    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    cleanedText = cleanedText.normalize('NFC');
    return cleanedText;
}

/**
 * Get first letters of each word concatenated for searchtype=1 search.
 * Example: 'ਧੰਨ ਧੰਨ ਰਾਮਦਾਸ ਗੁਰ ਜਿਨ ਸਿਰਿਆ ਤਿਨੈ ਸਵਾਰਿਆ' -> 'ਧਧਰਗਜਸਤਸ'
 */
export function getFirstLettersSearch(text: string): string {
    if (!text) {
        return "";
    }

    // Strip matras and ignore patterns first
    const strippedText = stripGurmukhiMatras(text);

    // If nothing left after removing patterns, return empty
    if (!strippedText.trim()) {
        return "";
    }

    // Split into words and get first letter of each
    const words = strippedText.split(/\s+/);
    const firstLetters: string[] = [];

    for (const word of words) {
        if (word) { // Ensure word is not empty
            // Get the first character (first letter)
            firstLetters.push(word[0]);
        }
    }

    // Concatenate all first letters
    return firstLetters.join('');
}