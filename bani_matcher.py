import json
from rapidfuzz import fuzz, process

def load_gurbani_data(file_path):
    """Load the Gurbani lines and translations from a JSON file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ Error: gurbani.json not found.")
        return []
    except json.JSONDecodeError:
        print("❌ Error: JSON is not formatted properly.")
        return []

def find_best_matches(query, data, threshold=50):
    """Find the top fuzzy matches from the data based on the query."""
    choices = [entry["line"] for entry in data]
    results = process.extract(query, choices, scorer=fuzz.partial_ratio, limit=3)

    matches = []
    for matched_text, score, index in results:
        if score >= threshold:
            matches.append({
                "matched_line": matched_text,
                "translation": data[index]["translation"],
                "score": score
            })
    return matches

def run_search():
    """Main loop: prompts user and performs search."""
    data = load_gurbani_data('gurbani.json')
    if not data:
        return

    print("🔍 Gurbani Line Matcher is ready!")
    print("Type a line in Punjabi (Romanized) to search.")
    print("Type 'exit' to quit.\n")

    while True:
        query = input("Enter Punjabi line: ").strip()
        if query.lower() == 'exit':
            print("👋 Exiting. Waheguru Ji Ka Khalsa Waheguru Ji Ki Fateh.")
            break

        matches = find_best_matches(query, data)

        if matches:
            print("\n🟢 Top Matches:")
            for match in matches:
                print(f"✔ Line: {match['matched_line']}")
                print(f"   ➤ Translation: {match['translation']}")
                print(f"   🔢 Score: {match['score']}\n")
        else:
            print("❌ No strong match found.\n")

if __name__ == "__main__":
    print("🚀 Script is running...\n")
    run_search()