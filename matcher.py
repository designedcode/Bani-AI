# matcher.py
from rapidfuzz import fuzz, process

def fuzzy_match_local_sggs(query, sggs_data, threshold=50, top_n=3):
    choices = [entry["line"] for entry in sggs_data]
    results = process.extract(query, choices, scorer=fuzz.partial_ratio, limit=top_n)

    for matched_line, score, index in results:
        if score >= threshold:
            return sggs_data[index]
    return None
