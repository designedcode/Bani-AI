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
FUZZY_THRESHOLD = float(os.getenv("FUZZY_MATCH_THRESHOLD", "70"))

# Enhanced fuzzy matching configuration
FUZZY_WORD_THRESHOLD = float(os.getenv("FUZZY_WORD_THRESHOLD", "80"))  # Threshold for fuzzy word matching
EXACT_WORD_INTERSECTION_MIN = int(os.getenv("EXACT_WORD_INTERSECTION_MIN", "5"))  # Min candidates for intersection
FUZZY_WORD_MAX_MATCHES = int(os.getenv("FUZZY_WORD_MAX_MATCHES", "3"))  # Max fuzzy matches per word

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

@lru_cache(maxsize=300)
def get_fuzzy_word_matches(query_word: str, threshold: float = None) -> set:
    """Get candidate lines for a single word using fuzzy matching against index"""
    if not INVERTED_INDEX_LOADED or len(query_word) < 2:
        return set()
    
    if threshold is None:
        threshold = FUZZY_WORD_THRESHOLD
    
    candidates = set()
    best_matches = []
    
    # Find top fuzzy matches for the word
    for index_word in INVERTED_INDEX.keys():
        if len(index_word) < 2:
            continue
            
        # Use multiple fuzzy matching methods for better accuracy
        partial_score = fuzz.partial_ratio(query_word, index_word)
        token_score = fuzz.token_set_ratio(query_word, index_word)
        
        # Weighted score favoring partial matches for word-level matching
        weighted_score = 0.7 * partial_score + 0.3 * token_score
        
        if weighted_score >= threshold:
            best_matches.append((index_word, weighted_score))
    
    # Sort by score and take top matches
    best_matches.sort(key=lambda x: x[1], reverse=True)
    
    # Take configurable number of top matches to avoid too much noise
    for index_word, score in best_matches[:FUZZY_WORD_MAX_MATCHES]:
        candidates.update(INVERTED_INDEX[index_word])
    
    return candidates

@lru_cache(maxsize=500)
def get_candidate_lines_from_index(query: str) -> set:
    """Get candidate line numbers from inverted index based on query words with fuzzy matching"""
    if not INVERTED_INDEX_LOADED or not query.strip():
        return set()
    
    # Normalize and split query into words
    normalized_query = unicodedata.normalize('NFC', query.strip())
    words = normalized_query.split()
    
    if not words:
        return set()
    
    candidate_lines = set()
    words_found = 0
    fuzzy_matches = 0
    
    # For each word in query, find matching lines in inverted index
    for word in words:
        word_candidates = set()
        
        # First try exact match (fastest)
        if word in INVERTED_INDEX:
            word_candidates.update(INVERTED_INDEX[word])
            words_found += 1
        else:
            # Try fuzzy matching against index words
            best_match_score = 0
            best_match_word = None
            
            # Only check fuzzy matching for words longer than 2 characters to avoid noise
            if len(word) > 2:
                for index_word in INVERTED_INDEX.keys():
                    # Skip very short index words to avoid false matches
                    if len(index_word) < 2:
                        continue
                        
                    # Use partial_ratio for better matching of word parts
                    score = fuzz.partial_ratio(word, index_word)
                    
                    # High threshold for fuzzy word matching to maintain precision
                    if score >= 85 and score > best_match_score:
                        best_match_score = score
                        best_match_word = index_word
                
                # Add candidates from best fuzzy match
                if best_match_word:
                    word_candidates.update(INVERTED_INDEX[best_match_word])
                    fuzzy_matches += 1
        
        # Add word candidates to overall candidates
        if word_candidates:
            if not candidate_lines:
                # First word - use all its candidates
                candidate_lines = word_candidates.copy()
            else:
                # Subsequent words - take intersection for more precise results
                # But if intersection is too small, use union to maintain recall
                intersection = candidate_lines.intersection(word_candidates)
                if len(intersection) >= EXACT_WORD_INTERSECTION_MIN:  # Configurable minimum viable candidate set
                    candidate_lines = intersection
                else:
                    candidate_lines.update(word_candidates)
    
    logger.info(f"Inverted index: Found {words_found} exact + {fuzzy_matches} fuzzy matches from {len(words)} words, {len(candidate_lines)} candidate lines")
    return candidate_lines

def weighted_fuzzy_score(query: str, line: str) -> float:
    """Calculate weighted fuzzy score using multiple methods
    Weights: 0.4 * partial_ratio + 0.3 * token_set_ratio + 0.3 * ratio
    """
    partial = fuzz.partial_ratio(query, line)
    token_set = fuzz.token_set_ratio(query, line)
    ratio = fuzz.ratio(query, line)
    
    weighted_score = 0.4 * partial + 0.3 * token_set + 0.3 * ratio
    return weighted_score

@lru_cache(maxsize=1000)
def fuzzy_search_sggs(query: str, threshold: float = FUZZY_THRESHOLD):
    """Enhanced three-stage fuzzy search: exact index -> fuzzy index -> full scan"""
    print(f"DEBUG: SGGS_LOADED={SGGS_LOADED}, INVERTED_INDEX_LOADED={INVERTED_INDEX_LOADED}, query='{query}'")
    if not SGGS_LOADED or not query.strip():
        print("DEBUG: Not loaded or empty query")
        return []
    
    # Stage 1: Try exact word matching in inverted index (FASTEST)
    if INVERTED_INDEX_LOADED:
        candidate_line_numbers = get_candidate_lines_from_index(query)
        
        if candidate_line_numbers:
            print(f"DEBUG: Using enhanced inverted index with {len(candidate_line_numbers)} candidates")
            
            # Convert line numbers to actual lines (1-indexed to 0-indexed)
            candidate_lines = []
            for line_num in candidate_line_numbers:
                if 1 <= line_num <= len(SGGS_LINES):
                    candidate_lines.append(SGGS_LINES[line_num - 1])
            
            print(f"DEBUG: Processing {len(candidate_lines)} candidate lines with weighted scoring")
            
            # Weighted fuzzy search on candidates only
            best_score = -1
            best_line = None
            
            for line in candidate_lines:
                score = weighted_fuzzy_score(query, line)
                if score >= 95:  # Early termination for excellent matches
                    print(f"DEBUG: Early termination! Weighted Score={score:.2f}, Line='{line}'")
                    return [(line, score)]
                if score > best_score:
                    best_score = score
                    best_line = line
            
            # Return best candidate match if above threshold
            if best_score >= threshold:
                print(f"DEBUG: Best candidate weighted score={best_score:.2f}, Line='{best_line}'")
                return [(best_line, best_score)]
            elif best_score >= 55:  # Still return decent matches
                print(f"DEBUG: Decent candidate weighted score={best_score:.2f}, Line='{best_line}'")
                return [(best_line, best_score)]
        
        # Stage 2: Try fuzzy word matching if exact matching didn't work well
        print("DEBUG: Trying fuzzy word matching approach")
        words = unicodedata.normalize('NFC', query.strip()).split()
        fuzzy_candidates = set()
        
        for word in words:
            word_candidates = get_fuzzy_word_matches(word)  # Uses FUZZY_WORD_THRESHOLD
            fuzzy_candidates.update(word_candidates)
        
        if fuzzy_candidates:
            print(f"DEBUG: Using fuzzy word matching with {len(fuzzy_candidates)} candidates")
            
            # Convert line numbers to actual lines
            fuzzy_candidate_lines = []
            for line_num in fuzzy_candidates:
                if 1 <= line_num <= len(SGGS_LINES):
                    fuzzy_candidate_lines.append(SGGS_LINES[line_num - 1])
            
            # Search through fuzzy candidates
            best_score = -1
            best_line = None
            
            for line in fuzzy_candidate_lines:
                score = weighted_fuzzy_score(query, line)
                if score >= 95:  # Early termination for excellent matches
                    print(f"DEBUG: Fuzzy word early termination! Weighted Score={score:.2f}, Line='{line}'")
                    return [(line, score)]
                if score > best_score:
                    best_score = score
                    best_line = line
            
            # Return best fuzzy word match if above threshold
            if best_score >= threshold:
                print(f"DEBUG: Best fuzzy word weighted score={best_score:.2f}, Line='{best_line}'")
                return [(best_line, best_score)]
            elif best_score >= 50:  # Lower threshold for fuzzy word matches
                print(f"DEBUG: Decent fuzzy word weighted score={best_score:.2f}, Line='{best_line}'")
                return [(best_line, best_score)]
    
    # Stage 3: Fallback to full-scan approach (SLOWEST)
    print("DEBUG: Using fallback full-scan approach with weighted scoring")
    best_score = -1
    best_line = None
    
    for line in SGGS_LINES:
        score = weighted_fuzzy_score(query, line)
        if score >= 95:  # Early termination for excellent matches
            print(f"DEBUG: Fallback early termination! Weighted Score={score:.2f}, Line='{line}'")
            return [(line, score)]
        if score > best_score:
            best_score = score
            best_line = line
    
    # Return best fallback match
    print(f"DEBUG: Fallback best weighted score={best_score:.2f}, Best line='{best_line}'")
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
    """Test endpoint to check enhanced inverted index functionality"""
    candidate_lines = get_candidate_lines_from_index(query) if INVERTED_INDEX_LOADED else set()
    
    # Test fuzzy word matching for each word in query
    words = unicodedata.normalize('NFC', query.strip()).split()
    fuzzy_word_analysis = {}
    
    for word in words:
        if len(word) > 2:
            fuzzy_candidates = get_fuzzy_word_matches(word)  # Uses FUZZY_WORD_THRESHOLD
            fuzzy_word_analysis[word] = {
                "candidate_count": len(fuzzy_candidates),
                "sample_lines": list(fuzzy_candidates)[:5]
            }
    
    fuzzy_results = fuzzy_search_sggs(query)
    
    return {
        "query": query,
        "inverted_index_loaded": INVERTED_INDEX_LOADED,
        "sggs_loaded": SGGS_LOADED,
        "total_words_in_index": len(INVERTED_INDEX) if INVERTED_INDEX_LOADED else 0,
        "exact_match_candidates": {
            "count": len(candidate_lines),
            "sample_lines": list(candidate_lines)[:10] if candidate_lines else []
        },
        "fuzzy_word_analysis": fuzzy_word_analysis,
        "final_fuzzy_results": fuzzy_results,
        "total_sggs_lines": len(SGGS_LINES),
        "enhancement_info": {
            "stages": ["exact_word_index", "fuzzy_word_matching", "full_scan_fallback"],
            "configuration": {
                "fuzzy_threshold": FUZZY_THRESHOLD,
                "fuzzy_word_threshold": FUZZY_WORD_THRESHOLD,
                "exact_word_intersection_min": EXACT_WORD_INTERSECTION_MIN,
                "fuzzy_word_max_matches": FUZZY_WORD_MAX_MATCHES
            },
            "weighted_scoring": "0.7*partial + 0.3*token_set for word matching, 0.4*partial + 0.3*token_set + 0.3*ratio for line scoring"
        }
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