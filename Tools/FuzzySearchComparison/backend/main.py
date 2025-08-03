from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging
import time
from fuzzy_search import FuzzySearchComparator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize fuzzy search comparator with SGGSO.txt
fuzzy_comparator = FuzzySearchComparator("../data/SGGSO.txt", "../data/fuzzy_comparisons.db")

# Pydantic models for fuzzy comparison API
class FuzzySearchRequest(BaseModel):
    query: str
    weights: dict
    top_k: Optional[int] = 10
    session_id: Optional[str] = None
    log_mode: Optional[bool] = False

class FuzzySearchResponse(BaseModel):
    query: str
    results: List[dict]
    weights_used: dict
    comparison_id: int
    timestamp: float

app = FastAPI(title="Fuzzy Search Comparison Tool", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Fuzzy Search Comparison Tool API", "status": "running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Fuzzy Search Comparison Tool"}

# Fuzzy Search Comparison Endpoints
@app.post("/api/fuzzy-search")
async def fuzzy_search_endpoint(request: FuzzySearchRequest) -> FuzzySearchResponse:
    """Search SGGS with weighted fuzzy matching"""
    results = fuzzy_comparator.search_with_weights(
        request.query, 
        request.weights, 
        request.top_k
    )
    
    # Check if we should save based on score threshold (75)
    should_save = False
    best_score = 0
    if results and len(results) > 0:
        best_score = results[0]['weighted_score']
        should_save = best_score >= 75.0
    
    comparison_id = 0
    if should_save:
        # Save comparison to database with individual methods for analysis
        comparison_id = fuzzy_comparator.save_comparison(
            request.query,
            request.weights,
            results,
            request.session_id,
            include_individual_methods=request.log_mode  # Include individual methods if in log mode
        )
        logger.info(f"Saved comparison (score: {best_score:.2f}) - Log mode: {request.log_mode}")
    else:
        logger.info(f"Skipped saving comparison (score: {best_score:.2f} < 75)")
    
    return FuzzySearchResponse(
        query=request.query,
        results=results,
        weights_used=request.weights,
        comparison_id=comparison_id,
        timestamp=time.time()
    )

@app.get("/api/fuzzy-history")
async def get_fuzzy_history(limit: int = 50):
    """Get fuzzy search comparison history"""
    history = fuzzy_comparator.get_comparison_history(limit)
    return {"history": history}

@app.post("/api/compare-weights")
async def compare_weight_combinations(
    transcription: str,
    weight_combinations: List[dict]
):
    """Compare multiple weight combinations for a single transcription"""
    results = fuzzy_comparator.compare_weight_combinations(
        transcription, 
        weight_combinations
    )
    return {"transcription": transcription, "comparisons": results}

@app.get("/api/fuzzy-methods")
async def get_fuzzy_methods():
    """Get available fuzzy matching methods"""
    return {
        "methods": [
            {"name": "ratio", "description": "Simple ratio comparison"},
            {"name": "partial_ratio", "description": "Partial string matching"},
            {"name": "token_sort_ratio", "description": "Token-based sorting"},
            {"name": "token_set_ratio", "description": "Token-based set matching"},
            {"name": "wratio", "description": "Weighted ratio (combines multiple methods)"}
        ]
    }

# History Export Endpoint
@app.get("/api/export-comparison-history")
async def export_comparison_history(limit: Optional[int] = None):
    """Export comparison history data for offline analysis"""
    export_data = fuzzy_comparator.export_comparison_history(limit)
    
    return {
        'export_data': export_data,
        'total_records': len(export_data),
        'export_timestamp': time.time()
    }

@app.post("/api/calculate-individual-methods")
async def calculate_individual_methods(request: dict):
    """Calculate individual method results for a specific transcription (for detailed analysis)"""
    transcription = request.get('transcription', '')
    top_k = request.get('top_k', 5)
    
    if not transcription:
        raise HTTPException(status_code=400, detail="Transcription is required")
    
    individual_results = fuzzy_comparator.search_with_individual_methods(transcription, top_k)
    
    return {
        'transcription': transcription,
        'individual_method_results': individual_results,
        'timestamp': time.time()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)  # Different port from main app