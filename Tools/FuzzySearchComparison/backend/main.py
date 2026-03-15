"""
RapidFuzz method comparison tool backend.
Searches shabads_verses_SGGS_window8_step2_by_shabad.db with different rapidfuzz scorers and returns top 10 results.
"""
from pathlib import Path
import unicodedata
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

import aiosqlite
from rapidfuzz import fuzz, process

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# DB path: next to this file (Tools/FuzzySearchComparison/backend/)
DEFAULT_DB = Path(__file__).resolve().parent / "shabads_verses_SGGS_window8_step2_by_shabad.db"

app = FastAPI(title="Fuzzy Search Comparison Tool", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache: list of (ShabadID, GurmukhiUni)
VERSES_DATA: list[tuple[int, str]] = []
DATABASE_LOADED = False

# Available rapidfuzz methods (scorer name -> (scorer callable, label))
FUZZ_METHODS = {
    "ratio": (fuzz.ratio, "ratio"),
    "partial_ratio": (fuzz.partial_ratio, "partial_ratio"),
    "token_set_ratio": (fuzz.token_set_ratio, "token_set_ratio"),
    "token_sort_ratio": (fuzz.token_sort_ratio, "token_sort_ratio"),
    "WRatio": (fuzz.WRatio, "WRatio"),
    "weighted": (None, "weighted (0.3×ratio + 0.4×partial + 0.3×token_set)"),
}


class SearchRequest(BaseModel):
    query: str
    method: Optional[str] = "weighted"
    limit: Optional[int] = 10


class SearchResult(BaseModel):
    text: str
    shabadID: int
    score: float
    rank: int


class SearchResponse(BaseModel):
    method: str
    method_label: str
    query: str
    results: list[SearchResult]
    total_verses: int


async def load_database(db_path: Path) -> None:
    global VERSES_DATA, DATABASE_LOADED
    if not db_path.exists():
        logger.warning(f"Database not found: {db_path}")
        return
    try:
        async with aiosqlite.connect(str(db_path)) as db:
            async with db.execute("SELECT ShabadID, GurmukhiUni FROM Verse") as cursor:
                rows = await cursor.fetchall()
                VERSES_DATA = [(row[0], unicodedata.normalize("NFC", row[1] or "")) for row in rows]
        DATABASE_LOADED = True
        logger.info(f"Loaded {len(VERSES_DATA)} verses from {db_path.name}")
    except Exception as e:
        logger.error(f"Error loading database: {e}")
        DATABASE_LOADED = False


def search_with_scorer(query: str, scorer, limit: int) -> list[tuple[str, int, float]]:
    """Run fuzzy search with a single rapidfuzz scorer. Returns list of (text, shabadID, score)."""
    if not VERSES_DATA or not query.strip():
        return []
    normalized_query = unicodedata.normalize("NFC", query.strip())
    verse_texts = [v[1] for v in VERSES_DATA]
    batch = process.extract(
        normalized_query,
        verse_texts,
        scorer=scorer,
        limit=limit,
        score_cutoff=0,
    )
    return [
        (verse_text, VERSES_DATA[idx][0], float(score))
        for verse_text, score, idx in batch
    ]


def _weighted_scorer(query: str, choice: str) -> float:
    """Single scorer for process.extract: 0.3*ratio + 0.4*partial_ratio + 0.3*token_set_ratio."""
    return 0.3 * fuzz.ratio(query, choice) + 0.4 * fuzz.partial_ratio(query, choice) + 0.3 * fuzz.token_set_ratio(query, choice)


def search_weighted(query: str, limit: int) -> list[tuple[str, int, float]]:
    """Weighted combination: 0.3*ratio + 0.4*partial_ratio + 0.3*token_set_ratio."""
    if not VERSES_DATA or not query.strip():
        return []
    normalized_query = unicodedata.normalize("NFC", query.strip())
    verse_texts = [v[1] for v in VERSES_DATA]
    batch = process.extract(
        normalized_query,
        verse_texts,
        scorer=lambda q, c: _weighted_scorer(q, c),
        limit=limit,
        score_cutoff=0,
    )
    return [
        (verse_text, VERSES_DATA[idx][0], float(score))
        for verse_text, score, idx in batch
    ]


@app.post("/api/fuzzy-search", response_model=SearchResponse)
async def fuzzy_search(req: SearchRequest):
    limit = min(max(1, req.limit or 10), 50)
    method = (req.method or "weighted").strip().lower()
    if method == "wratio":
        method = "WRatio"
    if method not in FUZZ_METHODS:
        method = "weighted"
    scorer, method_label = FUZZ_METHODS[method]

    if not DATABASE_LOADED:
        return SearchResponse(
            method=method,
            method_label=method_label,
            query=req.query,
            results=[],
            total_verses=0,
        )

    if method == "weighted":
        rows = search_weighted(req.query, limit)
    else:
        rows = search_with_scorer(req.query, scorer, limit)

    results = [
        SearchResult(text=text, shabadID=sid, score=round(score, 2), rank=i)
        for i, (text, sid, score) in enumerate(rows, 1)
    ]
    return SearchResponse(
        method=method,
        method_label=method_label,
        query=req.query,
        results=results,
        total_verses=len(VERSES_DATA),
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "database_loaded": DATABASE_LOADED, "verses": len(VERSES_DATA)}


@app.get("/api/methods")
async def list_methods():
    return {
        "methods": [
            {"id": k, "label": v[1]}
            for k, v in FUZZ_METHODS.items()
        ]
    }


def _score_with_method(query: str, text: str, method: str) -> float:
    """Compute match score between query and text using the given method."""
    q = unicodedata.normalize("NFC", (query or "").strip())
    t = unicodedata.normalize("NFC", (text or "").strip())
    if not q or not t:
        return 0.0
    scorer, _ = FUZZ_METHODS.get(method, FUZZ_METHODS["weighted"])
    if method == "weighted":
        return round(_weighted_scorer(q, t), 2)
    return round(float(scorer(q, t)), 2)


class ScoreCustomRequest(BaseModel):
    query: str
    custom_text: str
    method: Optional[str] = "weighted"


class ScoreCustomResponse(BaseModel):
    query: str
    custom_text: str
    method: str
    method_label: str
    score: float


@app.post("/api/score-custom", response_model=ScoreCustomResponse)
async def score_custom(req: ScoreCustomRequest):
    """Score a custom text against the search query using the selected rapidfuzz method."""
    method = (req.method or "weighted").strip().lower()
    if method == "wratio":
        method = "WRatio"
    if method not in FUZZ_METHODS:
        method = "weighted"
    _, method_label = FUZZ_METHODS[method]
    score = _score_with_method(req.query, req.custom_text, method)
    return ScoreCustomResponse(
        query=req.query,
        custom_text=req.custom_text,
        method=method,
        method_label=method_label,
        score=score,
    )


@app.on_event("startup")
async def startup():
    await load_database(DEFAULT_DB)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
