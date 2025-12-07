# Active Context

## Current work focus
- Refining fuzzy search scoring algorithm for better accuracy
- Improving real-time transcription matching stability
- Optimizing phrase detection and line highlighting

## Recent changes (November 2025)

### Fuzzy Search Scoring Improvements
- **Threshold Adjustments**: Reduced phrase match threshold from 60 to 50, increased sequential threshold from 40 to 45
- **Phrase Prioritization**: Changed to prioritize longer phrases (4-word, then 3-word, then 2-word) for better context matching
- **Sequence Matching**: Implemented token-level sequence matching to detect phrases where words appear in order
- **Last Word Weighting**: Added 10% weightage for exact match of the last word in transcription
- **Candidate Persistence**: Reduced from 3 to 2 tokens before switching highlighted line to reduce flickering
- **Backward Phrases**: Limited phrase generation to backward phrases only (ending at last word)

### Dependency Updates
- Changed Python dependency installation from `pip` to `pip3` in `start.sh`
- Removed outdated `websockets` dependency from `backend/requirements.txt`
- Updated `compression`, `form-data`, and `on-headers` packages in `package-lock.json`

### Code Refactoring
- Simplified contextual score calculation to use sequence matching
- Improved integration of multiple scoring methods (contextual, direct, last-word)
- Added logging for highlight changes with associated scores

## Previous major changes
- Initial MVP completed: real-time transcription, BaniDB integration, fuzzy search
- UI improvements and bug fixes
- Added matra stripping and local SGGS.txt search
- Migrated from SGGSO.txt to SQLite database with batch-optimized fuzzy search

## Next steps
- Fine-tune scoring weights and thresholds based on user feedback
- Consider dynamic thresholds based on transcription confidence
- Add user settings and preferences for displaying Shabads and metadata
- Improve accessibility and cross-browser support
- Prepare for deployment and update documentation 