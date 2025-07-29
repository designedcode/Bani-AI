# SGGS Utilities

This directory contains utility scripts for processing and optimizing the SGGSO.txt file.

## Available Utilities

### 1. optimize_sggs.py

**Purpose**: Creates an optimized version of SGGSO.txt by removing specified Gurmukhi characters and words for better text processing.

**What it removes**:
- `॥` (Double danda)
- `ਰਹਾਉ` (Rahao)
- Gurmukhi digits (੧, ੨, ੩, ੪, ੫, ੬, ੭, ੮, ੯, ੦)
- `ਸਲੋਕੁ` (Salok)
- `ੴ` (Ik Onkar)

**Usage**:
```bash
cd Tools/SGGSUtilities
python3 optimize_sggs.py
```

**Output**: Creates `../../backend/uploads/SGGSO_optimized.txt`

### 2. create_inverted_index.py

**Purpose**: Creates an inverted index from SGGSO.txt file, mapping words to line numbers for fast text search.

**Features**:
- Ignores specific Gurmukhi characters
- Separates tokens by whitespace
- Outputs statistics about word frequency
- Saves index as JSON file

**Usage**:
```bash
cd Tools/SGGSUtilities
python3 create_inverted_index.py
```

**Output**: Creates `sggso_inverted_index.json`

## Requirements

- Python 3.6+
- SGGSO.txt file must exist at `../../backend/uploads/SGGSO.txt`

## Notes

- These are one-time utility scripts for data preprocessing
- Run them from the `Tools/SGGSUtilities` directory
- The scripts automatically handle file paths relative to the project root
- Both scripts include error handling and progress reporting