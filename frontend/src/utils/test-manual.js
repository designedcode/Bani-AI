// Quick manual test of the text processing functions
const { stripGurmukhiMatras, getFirstLettersSearch, normalizeUnicode, cleanLine } = require('./TextProcessingUtils.ts');

const testText = 'ਧੰਨ ਧੰਨ ਰਾਮਦਾਸ ਗੁਰ ਜਿਨ ਸਿਰਿਆ ਤਿਨੈ ਸਵਾਰਿਆ ॥';

console.log('Original text:', testText);
console.log('Cleaned line:', cleanLine(testText));
console.log('Stripped matras:', stripGurmukhiMatras(testText));
console.log('First letters:', getFirstLettersSearch(testText));
console.log('Normalized (NFC):', normalizeUnicode(testText, 'NFC'));