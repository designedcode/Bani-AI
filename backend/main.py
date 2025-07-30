from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from typing import List, Optional
import logging
import os
from pathlib import Path
import re
import asyncio
from collections import defaultdict
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
    results: List[dict]
    sggs_match_found: bool
    fallback_used: bool
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

# BaniDB API configuration
BANIDB_API_BASE_URL = "https://api.banidb.com/v2"

# Create a shared HTTP client with connection pooling for better performance
http_client = httpx.AsyncClient(
    timeout=httpx.Timeout(5.0, connect=2.0),  # Optimized timeouts
    limits=httpx.Limits(max_keepalive_connections=50, max_connections=100),
    headers={"User-Agent": "BaniAI/1.0"},  # Consistent User-Agent
    http2=True  # Enable HTTP/2 for better performance
)

# Search caching mechanism
search_cache = {}

# --- SGGSO.txt Fuzzy Search Setup ---
from functools import lru_cache

SGGS_PATH = Path(__file__).parent / "uploads" / "SGGSO.txt"
SGGS_LINES = []
SGGS_LOADED = False
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

from rapidfuzz import fuzz, process

@lru_cache(maxsize=1000)
def fuzzy_search_sggs(query: str, threshold: float = FUZZY_THRESHOLD):
    """Optimized fuzzy search with caching and early termination"""
    print(f"DEBUG: SGGS_LOADED={SGGS_LOADED}, query='{query}'")
    if not SGGS_LOADED or not query.strip():
        print("DEBUG: Not loaded or empty query")
        return []
    
    # First, try to find an excellent match with early termination (score >= 95)
    best_score = -1
    best_line = None
    
    for line in SGGS_LINES:
        score = fuzz.ratio(query, line)
        if score >= 95:  # Early termination for excellent matches
            print(f"DEBUG: Early termination! Score={score}, Line='{line}'")
            return [(line, score)]
        if score > best_score:
            best_score = score
            best_line = line
    
    # If no excellent match found, return the best match we found
    print(f"DEBUG: Best score={best_score}, Best line='{best_line}'")
    if best_score >= threshold:
        return [(best_line, best_score)]
    elif best_score >= 55:  # Still return decent matches
        return [(best_line, best_score)]
    else:
        print("DEBUG: No matches found above threshold")
        return []

# Session management for REST API
session_store = {}

class SessionData:
    def __init__(self):
        self.top_result_found = False
        self.search_history = []

@lru_cache(maxsize=500)
def strip_gurmukhi_matras(text: str) -> str:
    """
    Strip matras (vowel signs) from Gurmukhi text, keeping only the main letters.
    This helps with search as BaniDB expects simplified Gurmukhi.
    Also removes common non-distinctive phrases/symbols (e.g., Ik Onkar variants).
    """
    if not text:
        return ""
    
    text = unicodedata.normalize('NFC', text)
    
    # Remove ੴ (Ik Onkar) and common phrases explicitly
    ignore_patterns = [
        '\u0A74',  # ੴ symbol (Ik Onkar)
        'ੴ',       # ੴ symbol (Ik Onkar, literal)
        'ਇਕ ਓਕਾਰ',  # Ek Onkar phrase
        'ਇ ਓਕਾਰ',   # I Okaar phrase
        'ਇਕ ਓਂਕਾਰ', # Ek Omkaar phrase
    ]
    for pattern in ignore_patterns:
        text = text.replace(pattern, '')

    # First, convert problematic characters to their base forms
    char_mappings = {
        'ਆ': 'ਅ',  # aa -> base a
        'ਇ': 'ੲ',  # i -> base i
        'ਈ': 'ੲ',  # ii -> base i  
        'ਉ': 'ੳ',  # u -> base u
        'ਊ': 'ੳ',  # uu -> base u
        'ਏ': 'ੲ',  # e -> base i
        'ਐ': 'ੲ',  # ai -> base i
        'ਓ': 'ੳ',  # o -> base u
        'ਔ': 'ੳ',  # au -> base u
    }
    for old_char, new_char in char_mappings.items():
        text = text.replace(old_char, new_char)
    
    # NFD normalize to decompose characters
    normalized_text = unicodedata.normalize('NFD', text)
    
    # Remove conjunct 'ਰ' (subjoined ra) BEFORE matra/diacritic removal
    # [consonant][halant][ਰ] -> [consonant]
    normalized_text = re.sub(r'([\u0A15-\u0A39])\u0A4D\u0A30', r'\1', normalized_text)
    
    # Remove common matras and diacritics
    matras_to_remove = [
        '\u0A3E',  # ਾ (aa)
        '\u0A3F',  # ਿ (i)
        '\u0A40',  # ੀ (ii)
        '\u0A41',  # ੁ (u)
        '\u0A42',  # ੂ (uu)
        '\u0A47',  # ੇ (e)
        '\u0A48',  # ੈ (ai)
        '\u0A4B',  # ੋ (o)
        '\u0A4C',  # ੌ (au)
        '\u0A4D',  # ੍ (halant/virama)
        '\u0A70',  # ੰ (tippi)
        '\u0A71',  # ੱ (addak)
        '\u0A02',  # ਂ (bindi)
        '\u0A01',  # ਁ (candrabindu)
    ]
    for matra in matras_to_remove:
        normalized_text = normalized_text.replace(matra, '')
    
    # Remove any remaining combining marks
    cleaned_text = ""
    for char in normalized_text:
        if not unicodedata.combining(char):
            cleaned_text += char
    
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    cleaned_text = unicodedata.normalize('NFC', cleaned_text)
    return cleaned_text

@lru_cache(maxsize=500)
def get_first_letters_search(text: str) -> str:
    """
    Get first letters of each word concatenated for searchtype=1 search.
    Example: 'ਧੰਨ ਧੰਨ ਰਾਮਦਾਸ ਗੁਰ ਜਿਨ ਸਿਰਿਆ ਤਿਨੈ ਸਵਾਰਿਆ' -> 'ਧਧਰਗਜਸਤਸ'
    """
    if not text:
        return ""
    
    # Strip matras and ignore patterns first (now handled in strip_gurmukhi_matras)
    stripped_text = strip_gurmukhi_matras(text)
    
    # If nothing left after removing patterns, return empty
    if not stripped_text.strip():
        return ""
    
    # Split into words and get first letter of each
    words = stripped_text.split()
    first_letters = []
    
    for word in words:
        if word:  # Ensure word is not empty
            # Get the first character (first letter)
            first_letters.append(word[0])
    
    # Concatenate all first letters
    result = ''.join(first_letters)
    
    return result

async def search_banidb_api(query: str, source: str = "all", searchtype: str = "6") -> List[dict]:
    """Search BaniDB API for Gurbani text with caching and debouncing"""
    if not query.strip():
        return []

    # Use the original query (after matra stripping) as is
    search_query = query.strip()
    logger.info(f"Original query: '{query}' -> Using as is for BaniDB search")

    # Check cache first
    cache_key = f"{search_query}_{source}_{searchtype}"
    if cache_key in search_cache:
        logger.info(f"Cache hit for query: '{search_query}'")
        return search_cache[cache_key]

    # No debouncing needed - frontend handles request deduplication

    try:
        # Use the shared HTTP client for better performance
        search_url = f"{BANIDB_API_BASE_URL}/search/{search_query}"
        params = {
            "source": source,
            "searchtype": searchtype,  # Use the provided searchtype
            "writer": "all",
            "page": "1",
            "livesearch": "1"
        }

        response = await http_client.get(search_url, params=params)
        response.raise_for_status()

        data = response.json()
        results = []

        # The API returns "verses" not "results"
        if "verses" in data:
            for verse in data["verses"][:10]:  # Limit to 10 results
                results.append({
                    "gurmukhi_text": verse.get("verse", {}).get("unicode", ""),
                    "english_translation": verse.get("translation", {}).get("en", {}).get("bdb", ""),
                    "verse_id": verse.get("verseId", 0),
                    "shabad_id": verse.get("shabadId", 0),
                    "source": "Guru Granth Sahib",  # Default source
                    "writer": "Guru Nanak Dev Ji",  # Default writer
                    "raag": ""  # Will be populated if available
                })

        # Cache the results for 5 minutes
        search_cache[cache_key] = results
        logger.info(f"BaniDB search returned {len(results)} results for query: '{search_query}'")
        return results

    except httpx.RequestError as e:
        logger.error(f"BaniDB API request error: {e}")
        return []
    except Exception as e:
        logger.error(f"BaniDB API error: {e}")
        return []

# Clean up cache periodically
async def cleanup_cache():
    """Clean up old cache entries every 5 minutes"""
    while True:
        await asyncio.sleep(300)  # 5 minutes
        current_time = time.time()
        # Keep only recent cache entries (last 10 minutes)
        old_keys = [k for k, v in search_cache.items() if current_time - v.get('_timestamp', 0) > 600]
        for key in old_keys:
            del search_cache[key]
        logger.info(f"Cleaned up {len(old_keys)} old cache entries")

@app.get("/")
async def root():
    return {"message": "Bani AI Transcription API"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Bani AI Transcription"}

@app.post("/api/transcribe")
async def transcribe_and_search(request: TranscriptionRequest) -> TranscriptionResponse:
    """Process transcription and return search results"""
    transcribed_text = request.text
    confidence = request.confidence
    
    logger.info(f"Received transcription: {transcribed_text} (confidence: {confidence})")

    # Step 1: Fuzzy search SGGS.txt
    fuzzy_matches = fuzzy_search_sggs(transcribed_text, FUZZY_THRESHOLD)
    logger.info(f"Fuzzy search threshold: {FUZZY_THRESHOLD}")
    sggs_match_found = False
    fallback_used = False
    best_sggs_match = None
    best_sggs_score = None
    search_results = []
    
    if fuzzy_matches:
        matched_line, score = fuzzy_matches[0]
        best_sggs_match = matched_line
        best_sggs_score = score
        logger.info(f"Best fuzzy match: Score={score}, Line='{matched_line}'")
        logger.info(f"Transcription: '{transcribed_text}' | Best SGGS line: '{matched_line}'")
        
        if score >= FUZZY_THRESHOLD:
            sggs_match_found = True
            if matched_line is not None:
                verse = matched_line
                if '॥' in verse:
                    verse = verse.split('॥')[0].strip()
                verse = unicodedata.normalize('NFC', verse)
                stripped_verse = strip_gurmukhi_matras(verse)
                logger.info(f"Stripped verse for BaniDB search: '{stripped_verse}' (from: '{verse}')")
                search_results = await search_banidb_api(stripped_verse)
                
                if not search_results:
                    fallback_used = True
                    logger.info(f"No results with searchtype=6, falling back to first letter search for: '{stripped_verse}'")
                    fallback_first_letters = get_first_letters_search(verse)
                    logger.info(f"Fallback first letters: '{fallback_first_letters}'")
                    search_results = await search_banidb_api(fallback_first_letters, source="all", searchtype="1")
            else:
                logger.warning("No valid matched line found for fuzzy search.")
                fallback_used = True
                fallback_stripped = strip_gurmukhi_matras(transcribed_text)
                fallback_first_letters = get_first_letters_search(transcribed_text)
                logger.info(f"Fallback: Stripped='{fallback_stripped}', First letters='{fallback_first_letters}'")
                search_results = await search_banidb_api(fallback_first_letters, source="all", searchtype="1")
        else:
            logger.info(f"Best match below threshold ({FUZZY_THRESHOLD}). No match used.")
            fallback_used = True
            fallback_stripped = strip_gurmukhi_matras(transcribed_text)
            fallback_first_letters = get_first_letters_search(transcribed_text)
            logger.info(f"Fallback: Stripped='{fallback_stripped}', First letters='{fallback_first_letters}'")
            search_results = await search_banidb_api(fallback_first_letters, source="all", searchtype="1")
    else:
        logger.info("No fuzzy matches found at all.")
        fallback_used = True
        fallback_stripped = strip_gurmukhi_matras(transcribed_text)
        fallback_first_letters = get_first_letters_search(transcribed_text)
        logger.info(f"Fallback: Stripped='{fallback_stripped}', First letters='{fallback_first_letters}'")
        search_results = await search_banidb_api(fallback_first_letters, source="all", searchtype="1")

    return TranscriptionResponse(
        transcribed_text=transcribed_text,
        confidence=confidence,
        results=search_results,
        sggs_match_found=sggs_match_found,
        fallback_used=fallback_used,
        best_sggs_match=best_sggs_match,
        best_sggs_score=best_sggs_score,
        timestamp=time.time()
    )

@app.get("/api/search")
async def search_endpoint(query: str, source: str = "all"):
    """REST endpoint for searching BaniDB"""
    results = await search_banidb_api(query, source)
    return {"query": query, "results": results}

@app.get("/api/sources")
async def get_sources():
    """Get available sources from BaniDB"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BANIDB_API_BASE_URL}/sources", timeout=30.0)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Error fetching sources: {e}")
        return {"sources": []}

@app.get("/api/strip-matras")
async def strip_matras_endpoint(text: str):
    """Test endpoint to strip matras from Gurmukhi text and show first letters search"""
    stripped = strip_gurmukhi_matras(text)
    first_letters = get_first_letters_search(text)
    return {
        "original": text,
        "stripped": stripped,
        "first_letters": first_letters,
        "length_original": len(text),
        "length_stripped": len(stripped),
        "length_first_letters": len(first_letters)
    }



@app.on_event("startup")
async def startup_event():
    """Initialize async tasks on startup"""
    # Load SGGS data asynchronously
    await load_sggs_data()
    # Start cache cleanup task
    asyncio.create_task(cleanup_cache())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 