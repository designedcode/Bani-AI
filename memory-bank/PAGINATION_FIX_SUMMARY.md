# Pagination Race Condition Fix

## Problem Identified
The issue was a race condition where both the transcription service and pagination logic were trying to fetch shabads simultaneously:

1. User reaches second-to-last line of shabad 6
2. `handleNeedNextShabad` correctly fetches shabad 7 ✅
3. **BUT** transcription service was still running and processing new speech
4. This triggered `debouncedSendTranscription` which found shabad 6 again and tried to fetch it ❌
5. Result: Redundant API calls and potential conflicts

## Root Cause
- Speech recognition continued to process transcriptions even after shabads were loaded
- The `debouncedSendTranscription` function was using stale closure values for `shabads.length`
- No proper mechanism to prevent transcription processing once content was already displayed

## Solution Implemented

### 1. Added State Tracking Ref
```typescript
const shabadsLoadedRef = useRef(false); // Track if shabads are loaded
```

### 2. Updated Shabad Loading Logic
```typescript
useEffect(() => {
  if (shabads.length > 0) {
    setShowLoader(false);
    shabadsLoadedRef.current = true; // Update ref when shabads are loaded
  }
}, [shabads]);
```

### 3. Enhanced Transcription Guards
```typescript
// In speech recognition result handler
if (wordCount >= 8 && !shabadsLoadedRef.current) {
  debouncedSendTranscription(fullTranscript, maxConfidence);
}

// In debouncedSendTranscription function
if (shabadsLoadedRef.current || searchTriggered) {
  console.log('Skipping transcription - shabads already loaded');
  return;
}
```

### 4. Added Debugging Logs
- Added console logs to track pagination behavior
- Added logs to show when transcription is being skipped
- Better visibility into the flow

### 5. Added Reset Function (Future Use)
```typescript
const resetTranscriptionState = useCallback(() => {
  // Reset all state when starting new search
  shabadsLoadedRef.current = false;
  // ... other resets
}, []);
```

## Expected Behavior After Fix

### ✅ Correct Flow:
1. User speaks → Transcription processes → Shabad 6 fetched
2. `shabadsLoadedRef.current = true` 
3. User reaches second-to-last line → `handleNeedNextShabad` fetches Shabad 7
4. **New speech is ignored** → No redundant API calls
5. Only pagination logic controls subsequent fetches

### 🚫 Prevented Issues:
- No more duplicate shabad fetches from transcription service
- No race conditions between transcription and pagination
- Cleaner network request patterns
- Better performance and user experience

## Testing Recommendations

1. **Test Pagination Flow:**
   - Speak to get initial shabad
   - Navigate to second-to-last line
   - Verify only next shabad is fetched (no duplicates)

2. **Test Transcription Stopping:**
   - Verify transcription API calls stop after first shabad loads
   - Check console logs for "Skipping transcription" messages

3. **Test Network Tab:**
   - Should see clean pattern: 1 transcribe call → 1 shabad call → 1 next shabad call
   - No duplicate or redundant requests

## Files Modified
- `frontend/src/App.tsx` - Main logic fixes
- `PAGINATION_FIX_SUMMARY.md` - This documentation

The fix ensures that once content is loaded, the transcription service steps back and lets the pagination logic handle subsequent shabad fetching cleanly.