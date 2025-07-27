# Design Document

## Overview

This design outlines the migration of Python backend functionality to TypeScript/React frontend, consolidating the application into a single frontend-based architecture. The migration involves converting FastAPI endpoints to frontend services, moving data processing logic to TypeScript, and reorganizing file structure.

## Architecture

### Current Architecture
- **Backend**: Python FastAPI server with WebSocket support, BaniDB API integration, SGGS text processing
- **Frontend**: React TypeScript application with proxy to backend
- **Data**: SGGS text files and indexes stored in backend/uploads

### Target Architecture
- **Frontend-Only**: React TypeScript application with integrated services
- **WebSocket Alternative**: Use Web APIs or polling for real-time features
- **Data Processing**: TypeScript equivalents of Python text processing
- **File Organization**: All functionality consolidated under frontend directory

## Components and Interfaces

### 1. Service Layer Migration
Convert Python FastAPI services to TypeScript service classes:

**BaniDBService.tsx**
- Replaces BaniDB API integration from main.py
- Uses fetch/axios for HTTP requests
- Implements caching and debouncing logic
- Handles search functionality with different search types

**SGGSService.tsx**
- Replaces SGGS text processing from main.py
- Implements fuzzy search using JavaScript fuzzy matching libraries
- Handles text normalization and matra stripping
- Manages SGGS data loading and indexing

**TranscriptionService.tsx**
- Replaces WebSocket transcription handling
- Uses Web Speech API or alternative for real-time transcription
- Implements connection management and message handling

### 2. Data Processing Migration
Convert Python text processing to TypeScript:

**TextProcessingUtils.ts**
- Port `strip_gurmukhi_matras()` function to TypeScript
- Port `get_first_letters_search()` function to TypeScript
- Implement Unicode normalization using JavaScript APIs
- Handle Gurmukhi text cleaning and processing

**FuzzySearchUtils.ts**
- Replace rapidfuzz with JavaScript fuzzy matching library (fuse.js or similar)
- Implement fuzzy search logic for SGGS text
- Handle scoring and threshold matching

### 3. Index Building Migration
Convert build_sggs_index.py to TypeScript:

**SGGSIndexBuilder.ts**
- Port inverted index building logic
- Handle file reading and JSON generation
- Implement clean_line function in TypeScript
- Generate index and line map files

### 4. Data Structure Migration
Move backend data files to frontend structure:

**frontend/public/data/**
- SGGS.txt → frontend/public/data/SGGS.txt
- sggs_inverted_index.json → frontend/public/data/sggs_inverted_index.json
- sggs_line_map.json → frontend/public/data/sggs_line_map.json

## Data Models

### Search Result Interface
```typescript
interface SearchResult {
  gurmukhi_text: string;
  english_translation: string;
  verse_id: number;
  shabad_id: number;
  source: string;
  writer: string;
  raag: string;
}
```

### Transcription Data Interface
```typescript
interface TranscriptionData {
  text: string;
  confidence: number;
  timestamp: number;
  sggs_match_found: boolean;
  fallback_used: boolean;
  best_sggs_match: string | null;
  best_sggs_score: number | null;
}
```

### SGGS Index Interfaces
```typescript
interface SGGSIndex {
  [token: string]: number[];
}

interface SGGSLineMap {
  [lineId: string]: string;
}
```

## Error Handling

### API Error Handling
- Implement try-catch blocks for all API calls
- Provide fallback mechanisms for BaniDB API failures
- Handle network connectivity issues gracefully
- Log errors appropriately for debugging

### Data Loading Error Handling
- Handle missing SGGS data files gracefully
- Provide user feedback for data loading failures
- Implement retry mechanisms for failed data loads
- Validate data integrity after loading

### Search Error Handling
- Handle empty search queries appropriately
- Provide meaningful error messages for search failures
- Implement fallback search strategies
- Handle fuzzy search threshold adjustments

## Testing Strategy

### Unit Testing
- Test all converted utility functions (text processing, fuzzy search)
- Test service classes with mocked API responses
- Test data processing and index building logic
- Verify TypeScript type safety and interfaces

### Integration Testing
- Test BaniDB API integration with real API calls
- Test SGGS data loading and search functionality
- Test transcription service integration
- Verify end-to-end search workflows

### Migration Testing
- Compare outputs between Python and TypeScript implementations
- Verify data integrity after file migration
- Test performance of converted algorithms
- Validate search result accuracy

## Implementation Dependencies

### Required NPM Packages
- **fuse.js** or **fuzzy** - For fuzzy text matching (replaces rapidfuzz)
- **axios** - For HTTP requests (replaces httpx)
- **lodash** - For utility functions and debouncing
- **unicode-normalize** - For Unicode text normalization

### File Structure Changes
```
frontend/
├── src/
│   ├── services/
│   │   ├── BaniDBService.tsx
│   │   ├── SGGSService.tsx
│   │   └── TranscriptionService.tsx
│   ├── utils/
│   │   ├── TextProcessingUtils.ts
│   │   ├── FuzzySearchUtils.ts
│   │   └── SGGSIndexBuilder.ts
│   └── types/
│       └── SearchTypes.ts
├── public/
│   └── data/
│       ├── SGGS.txt
│       ├── sggs_inverted_index.json
│       └── sggs_line_map.json
└── package.json (updated with new dependencies)
```

## Performance Considerations

### Data Loading Optimization
- Load SGGS data asynchronously on application startup
- Implement lazy loading for large data files
- Use Web Workers for heavy text processing tasks
- Cache processed data in browser storage

### Search Performance
- Implement client-side caching for search results
- Use debouncing for real-time search queries
- Optimize fuzzy search algorithms for browser environment
- Consider indexing strategies for faster lookups

### Memory Management
- Efficiently manage large SGGS text data in memory
- Implement cleanup for unused cached data
- Monitor memory usage during text processing
- Use streaming for large file operations where possible