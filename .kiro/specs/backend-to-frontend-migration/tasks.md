# Implementation Plan

- [x] 1. Set up project structure and install dependencies
  - Create new directory structure under frontend/src for services, utils, and types
  - Install required NPM packages (fuse.js, axios, lodash) - Note: unicode-normalize is built into JavaScript via String.prototype.normalize()
  - Update package.json with new dependencies
  - _Requirements: 1.1, 3.1_

- [x] 2. Create TypeScript type definitions
  - Create SearchTypes.ts with interfaces for SearchResult, TranscriptionData, SGGSIndex, and SGGSLineMap
  - Define API response types for BaniDB integration
  - Create error handling types and enums
  - _Requirements: 1.1, 3.2_

- [x] 3. Implement text processing utilities
  - Create TextProcessingUtils.ts with strip_gurmukhi_matras function converted from Python
  - Implement get_first_letters_search function in TypeScript
  - Add Unicode normalization functions using built-in String.prototype.normalize() method
  - Write unit tests for all text processing functions
  - _Requirements: 2.2, 4.2_

- [x] 4. Implement fuzzy search functionality
  - Create FuzzySearchUtils.ts using fuse.js library to replace rapidfuzz
  - Port fuzzy search logic from Python fuzzy_search_sggs function
  - Implement scoring and threshold matching
  - Write unit tests for fuzzy search functionality
  - _Requirements: 2.2, 4.2_

- [x] 5. Create SGGS data service
  - Create SGGSService.tsx to handle SGGS text loading and processing
  - Implement data loading from public/data directory
  - Port SGGS line processing and caching logic from Python
  - Add error handling for missing or corrupted data files
  - Write unit tests for SGGS service functionality
  - _Requirements: 1.1, 2.2, 4.3_

- [x] 6. Implement BaniDB API service
  - Create BaniDBService.tsx to replace FastAPI BaniDB integration
  - Port search_banidb_api function to TypeScript using axios
  - Implement caching and debouncing logic from Python version
  - Add error handling for API failures and network issues
  - Write unit tests for BaniDB service with mocked API responses
  - _Requirements: 2.1, 2.3, 4.3_

- [x] 7. Create transcription service
  - Create TranscriptionService.tsx to replace WebSocket transcription handling
  - Implement connection management and message handling logic
  - Port transcription processing logic from Python WebSocket endpoint
  - Add fallback mechanisms for real-time transcription
  - Write unit tests for transcription service functionality
  - _Requirements: 2.1, 2.3, 4.3_

- [ ] 8. Migrate SGGS index building functionality
  - Create SGGSIndexBuilder.ts to replace build_sggs_index.py
  - Port clean_line function and inverted index building logic to TypeScript
  - Implement file reading and JSON generation using browser APIs
  - Add functionality to rebuild indexes when needed
  - Write unit tests for index building functionality
  - _Requirements: 1.1, 2.2, 4.2_

- [x] 9. Move data files to frontend structure
  - Create frontend/public/data directory
  - Move SGGS.txt from backend/uploads to frontend/public/data
  - Move sggs_inverted_index.json from backend/uploads to frontend/public/data
  - Move sggs_line_map.json from backend/uploads to frontend/public/data
  - Update file paths in all service files to reference new locations
  - _Requirements: 1.1, 4.1, 4.3_

- [x] 10. Update existing React components to use new services
  - Modify existing components to import and use new TypeScript services
  - Replace backend API calls with frontend service calls
  - Update WebSocket usage to use new TranscriptionService
  - Update search functionality to use new BaniDBService and SGGSService
  - _Requirements: 2.1, 2.3, 4.2_

- [x] 11. Implement error handling and user feedback
  - Add error boundaries for service failures
  - Implement user-friendly error messages for API failures
  - Add loading states for data loading operations
  - Implement retry mechanisms for failed operations
  - _Requirements: 4.3_

- [x] 12. Add integration tests for migrated functionality
  - Write integration tests for BaniDB API integration
  - Test SGGS data loading and search workflows
  - Test transcription service integration with components
  - Verify search result accuracy compared to original backend
  - _Requirements: 2.1, 2.2, 2.3, 4.3_

- [ ] 13. Remove backend dependencies and clean up
  - Remove proxy configuration from frontend package.json
  - Delete backend directory and all Python files
  - Update start scripts to only run frontend
  - Clean up any remaining backend references in configuration files
  - _Requirements: 1.2, 3.2_

- [ ] 14. Performance optimization and final testing
  - Implement client-side caching for improved performance
  - Add lazy loading for large SGGS data files
  - Optimize fuzzy search performance for browser environment
  - Conduct end-to-end testing to ensure all functionality works correctly
  - _Requirements: 4.3_