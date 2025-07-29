# 🎯 Fuzzy Search Comparison Tool

A real-time web application for comparing different RapidFuzz methods when searching SGGS.txt with Gurmukhi audio transcription.

## Features

- **🎤 Real-time Audio Transcription**: Uses Web Speech API to transcribe Gurmukhi speech
- **⚖️ Weighted Fuzzy Matching**: Compare 5 different RapidFuzz methods with adjustable weights:
  - `ratio` - Simple ratio comparison
  - `partial_ratio` - Partial string matching  
  - `token_sort_ratio` - Token-based sorting
  - `token_set_ratio` - Token-based set matching
  - `wratio` - Weighted ratio (combines multiple methods)
- **🔍 Real-time Results**: See search results update as you adjust weights
- **📊 Comparison History**: All transcriptions and results are saved to SQLite database
- **📈 Comprehensive Evaluation Metrics**: 
  - **Precision@k** (k=1,3,5,10) - Accuracy of top-k results
  - **Recall** - Coverage of relevant results
  - **F1 Score** - Harmonic mean of precision and recall
  - **MRR (Mean Reciprocal Rank)** - Quality of ranking
  - **Average Precision** - Area under precision-recall curve
- **🎯 Ground Truth Management**: Add manual annotations for evaluation
- **📊 Method Performance Analysis**: Compare all fuzzy methods with statistical summaries
- **💾 Data Export**: Export evaluation data to CSV for offline analysis

## Quick Start

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Tool**:
   ```bash
   ./start-comparison.sh
   ```
   
   Or manually:
   ```bash
   # Start backend
   cd backend && python main.py &
   
   # Open frontend
   open frontend/fuzzy-comparison.html
   ```

3. **Use the Tool**:
   - Click "Start Listening" to begin audio transcription
   - Speak in Gurmukhi (the tool will attempt to transcribe)
   - Adjust the weight sliders to see how results change
   - View comparison history at the bottom

## API Endpoints

### Fuzzy Search
```
POST /api/fuzzy-search
{
  "query": "ਸਤਿ ਨਾਮੁ",
  "weights": {
    "ratio": 0.2,
    "partial_ratio": 0.2,
    "token_sort_ratio": 0.0,
    "token_set_ratio": 0.6,
    "wratio": 0.0
  },
  "top_k": 10,
  "session_id": "optional"
}
```

### Get History
```
GET /api/fuzzy-history?limit=50
```

### Compare Weight Combinations
```
POST /api/compare-weights
{
  "transcription": "ਸਤਿ ਨਾਮੁ",
  "weight_combinations": [
    {"ratio": 1.0, "partial_ratio": 0.0, ...},
    {"ratio": 0.5, "partial_ratio": 0.5, ...}
  ]
}
```

### Add Ground Truth
```
POST /api/add-ground-truth
{
  "transcription": "ਸਤਿ ਨਾਮੁ",
  "relevant_line_numbers": [1, 15, 23],
  "annotated_by": "user",
  "confidence_level": 5,
  "notes": "Manual verification"
}
```

### Get Evaluation Summary
```
GET /api/evaluation-summary?limit=50
```

### Evaluate Individual Methods
```
POST /api/evaluate-methods
{
  "transcription": "ਸਤਿ ਨਾਮੁ",
  "relevant_line_numbers": [1, 15, 23]
}
```

### Export Evaluation Data
```
GET /api/export-evaluation-data
```

## Database Schema

The tool automatically creates `fuzzy_comparisons.db` with:

```sql
-- Main comparisons table
CREATE TABLE transcription_comparisons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transcription TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    weights TEXT NOT NULL,  -- JSON
    best_match TEXT,
    best_score REAL,
    all_scores TEXT,        -- JSON
    session_id TEXT,
    ground_truth_lines TEXT, -- JSON array of line numbers
    has_ground_truth BOOLEAN DEFAULT FALSE
);

-- Evaluation metrics for each method
CREATE TABLE evaluation_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comparison_id INTEGER,
    method_name TEXT NOT NULL,
    precision_at_1 REAL,
    precision_at_3 REAL,
    precision_at_5 REAL,
    precision_at_10 REAL,
    recall REAL,
    f1_score REAL,
    mrr REAL,
    average_precision REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comparison_id) REFERENCES transcription_comparisons (id)
);

-- Ground truth annotations
CREATE TABLE ground_truth (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transcription TEXT NOT NULL,
    relevant_line_numbers TEXT NOT NULL, -- JSON array
    annotated_by TEXT,
    confidence_level INTEGER DEFAULT 5,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);
```

## Weight Configuration Examples

### Balanced Approach
```json
{
  "ratio": 0.2,
  "partial_ratio": 0.2,
  "token_sort_ratio": 0.2,
  "token_set_ratio": 0.2,
  "wratio": 0.2
}
```

### Token-focused (Good for Gurmukhi)
```json
{
  "ratio": 0.1,
  "partial_ratio": 0.1,
  "token_sort_ratio": 0.3,
  "token_set_ratio": 0.5,
  "wratio": 0.0
}
```

### Simple Ratio Only
```json
{
  "ratio": 1.0,
  "partial_ratio": 0.0,
  "token_sort_ratio": 0.0,
  "token_set_ratio": 0.0,
  "wratio": 0.0
}
```

## Browser Compatibility

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Partial support (may need to enable speech recognition)
- **Safari**: Limited support

## Troubleshooting

1. **Speech Recognition Not Working**:
   - Ensure you're using Chrome/Edge
   - Check microphone permissions
   - Try speaking clearly in Punjabi/Gurmukhi

2. **Backend Connection Issues**:
   - Ensure backend is running on port 8000
   - Check CORS settings if accessing from different domain

3. **No Search Results**:
   - Check if SGGS.txt exists in `backend/uploads/`
   - Verify the text encoding is UTF-8

## Evaluation Metrics Explained

### Precision@k
- **Precision@1**: Percentage of times the top result is relevant
- **Precision@3**: Percentage of relevant results in top 3
- **Precision@5**: Percentage of relevant results in top 5
- **Precision@10**: Percentage of relevant results in top 10

### Recall
- Percentage of all relevant results that were retrieved
- Formula: `relevant_retrieved / total_relevant`

### F1 Score
- Harmonic mean of Precision@5 and Recall
- Formula: `2 * (precision * recall) / (precision + recall)`

### MRR (Mean Reciprocal Rank)
- Quality of ranking - higher when relevant results appear earlier
- Formula: `1 / rank_of_first_relevant_result`

### Average Precision (AP)
- Area under the precision-recall curve
- Considers both precision and ranking quality

## Data Export

### Automatic CSV Export
Use the "Export Data" button in the UI to download evaluation data as CSV.

### Manual Database Query
```python
import sqlite3
import pandas as pd

# Export all evaluation metrics
conn = sqlite3.connect('fuzzy_comparisons.db')
df = pd.read_sql_query("""
    SELECT tc.transcription, tc.timestamp, tc.weights,
           em.method_name, em.precision_at_1, em.precision_at_5,
           em.recall, em.f1_score, em.mrr
    FROM transcription_comparisons tc
    JOIN evaluation_metrics em ON tc.id = em.comparison_id
    WHERE tc.has_ground_truth = TRUE
""", conn)
df.to_csv('evaluation_results.csv', index=False)

# Get method performance summary
summary_df = pd.read_sql_query("""
    SELECT method_name,
           AVG(precision_at_1) as avg_p1,
           AVG(precision_at_5) as avg_p5,
           AVG(recall) as avg_recall,
           AVG(f1_score) as avg_f1,
           AVG(mrr) as avg_mrr,
           COUNT(*) as sample_count
    FROM evaluation_metrics
    GROUP BY method_name
    ORDER BY avg_f1 DESC
""", conn)
summary_df.to_csv('method_summary.csv', index=False)
```

## Next Steps

- Add more fuzzy matching algorithms
- Implement A/B testing framework
- Add statistical analysis of weight performance
- Export results to different formats (CSV, JSON, Excel)