# Tools Directory

This directory contains standalone tools and utilities for the Bani AI project.

## Available Tools

### 1. Fuzzy Search Comparison Tool

**Location**: `Tools/FuzzySearchComparison/`

**Purpose**: A standalone tool for comparing different fuzzy search methods and weights on SGGSO.txt using RapidFuzz, with real-time audio transcription in Gurmukhi.

**Features**:
- Real-time audio transcription using Web Speech API
- 5 different RapidFuzz methods with adjustable weights
- Performance optimized search (~380ms response time)
- Database logging and CSV export for analysis
- Individual method score tracking

**How to Run**:
```bash
cd Tools/FuzzySearchComparison
./start.sh
```

**Ports**:
- Backend API: http://localhost:8001
- Frontend: Opens automatically in browser

**Requirements**:
- Python 3.8+
- FastAPI, RapidFuzz, Uvicorn (see backend/requirements.txt)

### 2. SGGS Utilities

**Location**: `Tools/SGGSUtilities/`

**Purpose**: Utility scripts for processing and optimizing the SGGSO.txt file.

**Features**:
- Text optimization (removes special characters and digits)
- Inverted index creation for fast text search
- Statistics and analysis tools

**How to Run**:
```bash
cd Tools/SGGSUtilities
./run_utilities.sh
```

**Individual Scripts**:
- `python3 optimize_sggs.py` - Optimize SGGSO.txt
- `python3 create_inverted_index.py` - Create search index

**Requirements**:
- Python 3.6+
- SGGSO.txt file in backend/uploads/

## Adding New Tools

To add a new tool:

1. Create a new directory under `Tools/`
2. Follow the same structure pattern:
   ```
   Tools/YourTool/
   ├── backend/          # If needed
   ├── frontend/         # If needed  
   ├── data/            # Tool-specific data
   ├── README.md        # Tool documentation
   └── start.sh         # Startup script
   ```
3. Use different ports to avoid conflicts with main app and other tools
4. Update this README.md to document the new tool

## Port Allocation

- Main App: 8000
- Fuzzy Search Comparison: 8001
- SGGS Utilities: No network ports (command-line tools)
- (Reserve 8002+ for future tools)