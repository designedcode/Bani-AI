#!/usr/bin/env python3
"""
Test script for enhanced fuzzy word matching in inverted index
"""
import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from main import (
    load_sggs_data, 
    load_inverted_index, 
    fuzzy_search_sggs,
    get_candidate_lines_from_index,
    get_fuzzy_word_matches,
    FUZZY_WORD_THRESHOLD,
    EXACT_WORD_INTERSECTION_MIN,
    FUZZY_WORD_MAX_MATCHES
)

async def test_enhanced_fuzzy_matching():
    """Test the enhanced fuzzy matching functionality"""
    print("🔄 Loading SGGS data and inverted index...")
    
    await load_sggs_data()
    await load_inverted_index()
    
    print(f"✅ Data loaded successfully!")
    print(f"📊 Configuration:")
    print(f"   - FUZZY_WORD_THRESHOLD: {FUZZY_WORD_THRESHOLD}")
    print(f"   - EXACT_WORD_INTERSECTION_MIN: {EXACT_WORD_INTERSECTION_MIN}")
    print(f"   - FUZZY_WORD_MAX_MATCHES: {FUZZY_WORD_MAX_MATCHES}")
    
    # Test cases with expected behavior
    test_cases = [
        {
            "query": "ਸਤਿ ਨਾਮੁ",
            "description": "Exact match - should use Stage 1 (exact index)"
        },
        {
            "query": "ਸਤ ਨਾਮ", 
            "description": "Fuzzy word match - should use Stage 2 (fuzzy word matching)"
        },
        {
            "query": "ਵਾਹਿਗੁਰੂ",
            "description": "Exact single word - should use Stage 1"
        },
        {
            "query": "ਵਾਹਗੁਰੂ",
            "description": "Fuzzy single word - should use Stage 2"
        },
        {
            "query": "ਕਰਤਾ ਪੁਰਖ",
            "description": "Mixed exact/fuzzy - should use enhanced matching"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        query = test_case["query"]
        description = test_case["description"]
        
        print(f"\n{'='*60}")
        print(f"🧪 Test {i}: {description}")
        print(f"📝 Query: '{query}'")
        print(f"{'='*60}")
        
        # Test individual word fuzzy matching
        words = query.split()
        print(f"🔍 Individual word analysis:")
        for word in words:
            if len(word) > 2:
                fuzzy_candidates = get_fuzzy_word_matches(word)
                print(f"   '{word}' -> {len(fuzzy_candidates)} fuzzy candidates")
        
        # Test candidate line extraction
        candidates = get_candidate_lines_from_index(query)
        print(f"📋 Candidate lines from enhanced index: {len(candidates)}")
        
        # Test final fuzzy search
        print(f"🎯 Final fuzzy search results:")
        results = fuzzy_search_sggs(query)
        
        if results:
            line, score = results[0]
            print(f"   ✅ Best match (score: {score:.2f})")
            print(f"   📄 Line: {line[:80]}{'...' if len(line) > 80 else ''}")
        else:
            print(f"   ❌ No matches found")

if __name__ == "__main__":
    asyncio.run(test_enhanced_fuzzy_matching())