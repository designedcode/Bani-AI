# sggs_loader.py

import json

def load_sggs_json(path="SriGranth_English.json"):
    """
    Loads the SGGS data from a JSON file.

    Args:
        path (str): Path to the JSON file.

    Returns:
        list: List of Gurbani lines with metadata.
    """
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)