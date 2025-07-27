# Utils Directory

This directory contains utility functions for text processing and other common operations.

## Unicode Normalization

Note: Unicode normalization is built into JavaScript/TypeScript via the String.prototype.normalize() method, so no additional package is needed for unicode-normalize functionality.

Example usage:
```typescript
const normalizedText = text.normalize('NFC'); // or 'NFD', 'NFKC', 'NFKD'
```