from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import os
from pathlib import Path
import time
import unicodedata
from rapidfuzz import fuzz

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models for REST API
class TranscriptionRequest(BaseModel):
    text: str
    confidence: float
    session_id: Optional[str] = None

class TranscriptionResponse(BaseModel):
    transcribed_text: str
    confidence: float
    sggs_match_found: bool
    best_sggs_match: Optional[str]
    best_sggs_score: Optional[float]
    timestamp: float

app = FastAPI(title="Bani AI Transcription", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Removed BaniDB API configuration - now handled by frontend

# --- SGGSO.txt Fuzzy Search Setup ---
from functools import lru_cache
import json

SGGS_PATH = Path(__file__).parent / "uploads" / "SGGSO.txt"
INVERTED_INDEX_PATH = Path(__file__).parent / "uploads" / "sggso_inverted_index.json"
SGGS_LINES = []
INVERTED_INDEX = {}
SGGS_LOADED = False
INVERTED_INDEX_LOADED = False
FUZZY_THRESHOLD = float(os.getenv("FUZZY_MATCH_THRESHOLD", "40"))

# Async loading of SGGSO.txt
async def load_sggs_data():
    """Asynchronously load SGGSO.txt data"""
    global SGGS_LINES, SGGS_LOADED
    
    if SGGS_PATH.exists():
        try:
            with open(SGGS_PATH, 'r', encoding="utf-8") as f:
                SGGS_LINES = [unicodedata.normalize('NFC', line.strip()) for line in f if line.strip()]
            SGGS_LOADED = True
            logger.info(f"Loaded {len(SGGS_LINES)} lines from SGGSO.txt for fuzzy search.")
        except Exception as e:
            logger.error(f"Error loading SGGSO.txt: {e}")
            SGGS_LOADED = False
    else:
        logger.warning(f"SGGSO.txt not found at {SGGS_PATH}. Fuzzy search will be disabled.")

# Async loading of inverted index
async def load_inverted_index():
    """Asynchronously load inverted index data"""
    global INVERTED_INDEX, INVERTED_INDEX_LOADED
    
    if INVERTED_INDEX_PATH.exists():
        try:
            with open(INVERTED_INDEX_PATH, 'r', encoding="utf-8") as f:
                INVERTED_INDEX = json.load(f)
            INVERTED_INDEX_LOADED = True
            logger.info(f"Loaded inverted index with {len(INVERTED_INDEX)} words for fuzzy search optimization.")
        except Exception as e:
            logger.error(f"Error loading inverted index: {e}")
            INVERTED_INDEX_LOADED = False
    else:
        logger.warning(f"Inverted index not found at {INVERTED_INDEX_PATH}. Using fallback fuzzy search.")

# rapidfuzz already imported above

@lru_cache(maxsize=500)
def get_candidate_lines_from_index(query: str) -> set:
    """Get candidate line numbers from inverted index based on query words"""
    if not INVERTED_INDEX_LOADED or not query.strip():
        return set()
    
    # Normalize and split query into words
    normalized_query = unicodedata.normalize('NFC', query.strip())
    words = normalized_query.split()
    
    if not words:
        return set()
    
    candidate_lines = set()
    words_found = 0
    
    # For each word in query, find matching lines in inverted index
    for word in words:
        if word in INVERTED_INDEX:
            candidate_lines.update(INVERTED_INDEX[word])
            words_found += 1
    
    logger.info(f"Inverted index: Found {words_found}/{len(words)} words, {len(candidate_lines)} candidate lines")
    return candidate_lines

@lru_cache(maxsize=1000)
def fuzzy_search_sggs(query: str, threshold: float = FUZZY_THRESHOLD):
    """Two-stage fuzzy search: inverted index filtering + fuzzy matching"""
    print(f"DEBUG: SGGS_LOADED={SGGS_LOADED}, INVERTED_INDEX_LOADED={INVERTED_INDEX_LOADED}, query='{query}'")
    if not SGGS_LOADED or not query.strip():
        print("DEBUG: Not loaded or empty query")
        return []
    
    # Stage 1: Try inverted index approach (PRIMARY)
    if INVERTED_INDEX_LOADED:
        candidate_line_numbers = get_candidate_lines_from_index(query)
        
        if candidate_line_numbers:
            print(f"DEBUG: Using inverted index with {len(candidate_line_numbers)} candidates")
            
            # Convert line numbers to actual lines (1-indexed to 0-indexed)
            candidate_lines = []
            for line_num in candidate_line_numbers:
                if 1 <= line_num <= len(SGGS_LINES):
                    candidate_lines.append(SGGS_LINES[line_num - 1])
            
            print(f"DEBUG: Processing {len(candidate_lines)} candidate lines")
            
            # Fuzzy search on candidates only
            best_score = -1
            best_line = None
            
            for line in candidate_lines:
                score = fuzz.ratio(query, line)
                if score >= 95:  # Early termination for excellent matches
                    print(f"DEBUG: Early termination! Score={score}, Line='{line}'")
                    return [(line, score)]
                if score > best_score:
                    best_score = score
                    best_line = line
            
            # Return best candidate match if above threshold
            if best_score >= threshold:
                print(f"DEBUG: Best candidate score={best_score}, Line='{best_line}'")
                return [(best_line, best_score)]
            elif best_score >= 55:  # Still return decent matches
                print(f"DEBUG: Decent candidate score={best_score}, Line='{best_line}'")
                return [(best_line, best_score)]
    
    # Stage 2: Fallback to full-scan approach (FALLBACK)
    print("DEBUG: Using fallback full-scan approach")
    best_score = -1
    best_line = None
    
    for line in SGGS_LINES:
        score = fuzz.ratio(query, line)
        if score >= 95:  # Early termination for excellent matches
            print(f"DEBUG: Fallback early termination! Score={score}, Line='{line}'")
            return [(line, score)]
        if score > best_score:
            best_score = score
            best_line = line
    
    # Return best fallback match
    print(f"DEBUG: Fallback best score={best_score}, Best line='{best_line}'")
    if best_score >= threshold:
        return [(best_line, best_score)]
    elif best_score >= 55:  # Still return decent matches
        return [(best_line, best_score)]
    else:
        print("DEBUG: No matches found above threshold")
        return []

# Removed session management - not needed for simplified backend

# Removed matra stripping functions - now handled by frontend



# Removed cache cleanup - no longer needed since BaniDB calls moved to frontend

@app.get("/")
async def root():
    return {"message": "Bani AI Transcription API"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Bani AI Transcription"}

@app.post("/api/transcribe")
async def transcribe_and_search(request: TranscriptionRequest) -> TranscriptionResponse:
    """Process transcription and return SGGS fuzzy search results"""
    transcribed_text = request.text
    confidence = request.confidence
    
    logger.info(f"Received transcription: {transcribed_text} (confidence: {confidence})")

    # Fuzzy search SGGS.txt
    fuzzy_matches = fuzzy_search_sggs(transcribed_text, FUZZY_THRESHOLD)
    logger.info(f"Fuzzy search threshold: {FUZZY_THRESHOLD}")
    sggs_match_found = False
    best_sggs_match = None
    best_sggs_score = None
    
    if fuzzy_matches:
        matched_line, score = fuzzy_matches[0]
        best_sggs_match = matched_line
        best_sggs_score = score
        logger.info(f"Best fuzzy match: Score={score}, Line='{matched_line}'")
        logger.info(f"Transcription: '{transcribed_text}' | Best SGGS line: '{matched_line}'")
        
        if score >= FUZZY_THRESHOLD:
            sggs_match_found = True
        else:
            logger.info(f"Best match below threshold ({FUZZY_THRESHOLD}). No match used.")
    else:
        logger.info("No fuzzy matches found at all.")

    return TranscriptionResponse(
        transcribed_text=transcribed_text,
        confidence=confidence,
        sggs_match_found=sggs_match_found,
        best_sggs_match=best_sggs_match,
        best_sggs_score=best_sggs_score,
        timestamp=time.time()
    )



# Removed BaniDB sources endpoint - now handled by frontend

# Removed matra stripping test endpoint - functionality moved to frontend

@app.get("/api/test-inverted-index")
async def test_inverted_index_endpoint(query: str):
    """Test endpoint to check inverted index functionality"""
    candidate_lines = get_candidate_lines_from_index(query) if INVERTED_INDEX_LOADED else set()
    fuzzy_results = fuzzy_search_sggs(query)
    
    return {
        "query": query,
        "inverted_index_loaded": INVERTED_INDEX_LOADED,
        "sggs_loaded": SGGS_LOADED,
        "total_words_in_index": len(INVERTED_INDEX) if INVERTED_INDEX_LOADED else 0,
        "candidate_line_count": len(candidate_lines),
        "candidate_lines_sample": list(candidate_lines)[:10] if candidate_lines else [],
        "fuzzy_results": fuzzy_results,
        "total_sggs_lines": len(SGGS_LINES)
    }



@app.on_event("startup")
async def startup_event():
    """Initialize async tasks on startup"""
    # Load SGGS data and inverted index asynchronously
    await load_sggs_data()
    await load_inverted_index()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 