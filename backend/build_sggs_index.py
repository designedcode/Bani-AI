import json
import re
from collections import defaultdict

# === Configuration ===
INPUT_FILE = "/Users/jsingh/Documents/Bani-AI-New Approach/backend/uploads/SGGS.txt"
INDEX_OUTPUT_FILE = "/Users/jsingh/Documents/Bani-AI-New Approach/backend/uploads/sggs_inverted_index.json"
LINE_MAP_OUTPUT_FILE = "/Users/jsingh/Documents/Bani-AI-New Approach/backend/uploads/sggs_line_map.json"

def clean_line(text):
    """
    Remove SGGS markers like '॥' and unwanted punctuation, but preserve casing.
    """
    text = text.replace("॥", "")           # Remove SGGS end markers
    text = re.sub(r"[^\w\s]", "", text)    # Remove other non-word, non-space chars
    return text.strip()

def build_inverted_index(filepath):
    inverted_index = defaultdict(set)
    line_map = {}

    with open(filepath, "r", encoding="utf-8") as file:
        for line_num, line in enumerate(file):
            clean = clean_line(line)
            line_map[line_num] = line.strip()

            tokens = clean.split()
            for token in tokens:
                if token:  # ignore empty tokens
                    inverted_index[token].add(line_num)

    return inverted_index, line_map

def save_index_to_json(inverted_index, output_path):
    # Convert sets to lists for JSON compatibility
    json_ready = {token: list(lines) for token, lines in inverted_index.items()}
    with open(output_path, "w", encoding="utf-8") as out_file:
        json.dump(json_ready, out_file, ensure_ascii=False, indent=2)

def save_line_map_to_json(line_map, output_path):
    # Save line map separately
    json_ready = {str(line_id): text for line_id, text in line_map.items()}
    with open(output_path, "w", encoding="utf-8") as out_file:
        json.dump(json_ready, out_file, ensure_ascii=False, indent=2)

def main():
    print(f"Building inverted index from {INPUT_FILE} (case-sensitive)...")
    index, line_map = build_inverted_index(INPUT_FILE)
    
    save_index_to_json(index, INDEX_OUTPUT_FILE)
    save_line_map_to_json(line_map, LINE_MAP_OUTPUT_FILE)
    
    print(f"Inverted index saved to {INDEX_OUTPUT_FILE}")
    print(f"Line map saved to {LINE_MAP_OUTPUT_FILE}")
    print(f"Index contains {len(index)} unique tokens and {len(line_map)} lines")

if __name__ == "__main__":
    main()
