from rapidfuzz import fuzz
import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Set
import unicodedata
import re
import math

class FuzzySearchComparator:
    def __init__(self, sggs_file_path: str, db_path: str = "fuzzy_comparisons.db"):
        self.sggs_file_path = sggs_file_path
        self.db_path = db_path
        self.sggs_lines = self._load_sggs()
        self._init_database()
    
    def _load_sggs(self) -> List[str]:
        """Load and preprocess SGGS text"""
        with open(self.sggs_file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Filter out empty lines and clean text
        cleaned_lines = []
        for line in lines:
            line = line.strip()
            if line and not line.startswith('॥') and len(line) > 5:
                # Basic cleaning - remove extra spaces
                line = re.sub(r'\s+', ' ', line)
                cleaned_lines.append(line)
        
        return cleaned_lines
    
    def _init_database(self):
        """Initialize SQLite database for storing comparisons and evaluation metrics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Main comparisons table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transcription_comparisons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transcription TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                weights TEXT NOT NULL,
                best_match TEXT,
                best_score REAL,
                all_scores TEXT,
                session_id TEXT
            )
        ''')

        
        conn.commit()
        conn.close()
    
    def normalize_text(self, text: str) -> str:
        """Normalize Gurmukhi text for better matching"""
        # Remove diacritics and normalize unicode
        text = unicodedata.normalize('NFKD', text)
        # Remove punctuation and extra spaces
        text = re.sub(r'[।॥\.\,\!\?\;\:]', '', text)
        text = re.sub(r'\s+', ' ', text.strip())
        return text
    
    def calculate_individual_scores(self, query: str, target: str) -> Dict[str, float]:
        """Calculate all individual fuzzy matching scores"""
        query_norm = self.normalize_text(query)
        target_norm = self.normalize_text(target)
        
        return {
            'ratio': fuzz.ratio(query_norm, target_norm),
            'partial_ratio': fuzz.partial_ratio(query_norm, target_norm),
            'token_sort_ratio': fuzz.token_sort_ratio(query_norm, target_norm),
            'token_set_ratio': fuzz.token_set_ratio(query_norm, target_norm),
            'wratio': fuzz.WRatio(query_norm, target_norm)
        }
    
    def calculate_weighted_score(self, scores: Dict[str, float], weights: Dict[str, float]) -> float:
        """Calculate weighted combination of scores"""
        total_weight = sum(weights.values())
        if total_weight == 0:
            return 0
        
        weighted_sum = sum(scores[method] * weight for method, weight in weights.items() if method in scores)
        return weighted_sum / total_weight
    
    def search_with_weights(self, query: str, weights: Dict[str, float], top_k: int = 10) -> List[Dict]:
        """Search SGGS with weighted fuzzy matching (highly optimized)"""
        query_norm = self.normalize_text(query)
        query_words = set(query_norm.split())
        
        # Use a heap to maintain only top results
        import heapq
        top_results = []
        
        # Pre-filter candidates using word overlap for speed
        candidates = []
        for i, line in enumerate(self.sggs_lines):
            line_norm = self.normalize_text(line)
            line_words = set(line_norm.split())
            
            # Quick filters for performance
            if len(line_norm) < 3:  # Skip very short lines
                continue
                
            # Check for word overlap (much faster than fuzzy matching)
            overlap = len(query_words.intersection(line_words))
            if overlap > 0 or len(query_norm) < 10:  # Always include if query is short
                candidates.append((i, line, line_norm))
        
        # Limit candidates to prevent slowdown (take a sample if too many)
        if len(candidates) > 5000:
            import random
            candidates = random.sample(candidates, 5000)
        
        # Now do fuzzy matching only on candidates
        for i, line, line_norm in candidates:
            individual_scores = self.calculate_individual_scores_fast(query_norm, line_norm)
            weighted_score = self.calculate_weighted_score(individual_scores, weights)
            
            # Only keep results above a minimum threshold
            if weighted_score > 30:
                result = {
                    'line_number': i + 1,
                    'text': line,
                    'weighted_score': weighted_score,
                    'individual_scores': individual_scores
                }
                
                if len(top_results) < top_k * 3:  # Keep more for better results
                    heapq.heappush(top_results, (weighted_score, i, result))
                elif weighted_score > top_results[0][0]:
                    heapq.heapreplace(top_results, (weighted_score, i, result))
        
        # Extract results and sort
        results = [result for score, idx, result in sorted(top_results, reverse=True)]
        return results[:top_k]
    
    def calculate_individual_scores_fast(self, query_norm: str, target_norm: str) -> Dict[str, float]:
        """Calculate individual fuzzy matching scores (optimized version)"""
        return {
            'ratio': fuzz.ratio(query_norm, target_norm),
            'partial_ratio': fuzz.partial_ratio(query_norm, target_norm),
            'token_sort_ratio': fuzz.token_sort_ratio(query_norm, target_norm),
            'token_set_ratio': fuzz.token_set_ratio(query_norm, target_norm),
            'wratio': fuzz.WRatio(query_norm, target_norm)
        }
    
    def save_comparison(self, transcription: str, weights: Dict[str, float], 
                       results: List[Dict], session_id: str = None, include_individual_methods: bool = True) -> int:
        """Save comparison results to database (simplified)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        best_match = results[0] if results else None
        best_score = best_match['weighted_score'] if best_match else 0
        best_text = best_match['text'] if best_match else ""
        best_line = best_match['line_number'] if best_match else 0
        
        # Extract individual method scores from the best result only
        individual_scores = {}
        if include_individual_methods and best_match:
            individual_scores = best_match.get('individual_scores', {})
        
        cursor.execute('''
            INSERT INTO transcription_comparisons 
            (transcription, weights, best_match, best_score, all_scores, session_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            transcription,
            json.dumps(weights),
            best_text,
            best_score,
            json.dumps({
                'best_line_number': best_line,
                'individual_scores': individual_scores
            }),
            session_id
        ))
        
        comparison_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return comparison_id
    

    
    def get_comparison_history(self, limit: int = 50) -> List[Dict]:
        """Get comparison history from database (simplified)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, transcription, timestamp, weights, best_match, best_score, all_scores, session_id
            FROM transcription_comparisons
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        history = []
        for row in rows:
            try:
                all_scores_data = json.loads(row[6]) if row[6] else {}
                
                history.append({
                    'id': row[0],
                    'transcription': row[1],
                    'timestamp': row[2],
                    'weights': json.loads(row[3]) if row[3] else {},
                    'best_match': row[4],
                    'best_score': row[5],
                    'all_scores': all_scores_data,
                    'session_id': row[7]
                })
            except (json.JSONDecodeError, KeyError) as e:
                # Handle corrupted data gracefully
                history.append({
                    'id': row[0],
                    'transcription': row[1],
                    'timestamp': row[2],
                    'weights': {},
                    'best_match': row[4],
                    'best_score': row[5],
                    'all_scores': {},
                    'session_id': row[7],
                    'error': f"Data parsing error: {str(e)}"
                })
        
        return history
    

    
    def search_with_individual_methods(self, query: str, top_k: int = 10) -> Dict[str, List[Dict]]:
        """Search using each individual fuzzy method separately (optimized)"""
        methods = ['ratio', 'partial_ratio', 'token_sort_ratio', 'token_set_ratio', 'wratio']
        results_by_method = {}
        
        # Pre-calculate scores for all methods at once to avoid redundant normalization
        query_norm = self.normalize_text(query)
        
        for method in methods:
            method_results = []
            
            # Use a more efficient approach with early termination for very low scores
            for i, line in enumerate(self.sggs_lines):
                line_norm = self.normalize_text(line)
                
                # Calculate score for this specific method
                if method == 'ratio':
                    score = fuzz.ratio(query_norm, line_norm)
                elif method == 'partial_ratio':
                    score = fuzz.partial_ratio(query_norm, line_norm)
                elif method == 'token_sort_ratio':
                    score = fuzz.token_sort_ratio(query_norm, line_norm)
                elif method == 'token_set_ratio':
                    score = fuzz.token_set_ratio(query_norm, line_norm)
                elif method == 'wratio':
                    score = fuzz.WRatio(query_norm, line_norm)
                else:
                    score = 0
                
                # Only keep results above a minimum threshold for performance
                if score > 30:  # Skip very low scores
                    method_results.append({
                        'line_number': i + 1,
                        'text': line,
                        'score': score,
                        'method': method
                    })
            
            # Sort by score and return top k
            method_results.sort(key=lambda x: x['score'], reverse=True)
            results_by_method[method] = method_results[:top_k]
        
        return results_by_method
    


    
    def compare_weight_combinations(self, transcription: str, 
                                  weight_combinations: List[Dict[str, float]]) -> Dict:
        """Compare multiple weight combinations for a single transcription"""
        comparison_results = {}
        
        for i, weights in enumerate(weight_combinations):
            results = self.search_with_weights(transcription, weights, top_k=10)
            
            combination_data = {
                'weights': weights,
                'results': results,
                'best_score': results[0]['weighted_score'] if results else 0
            }
            
            comparison_results[f"combination_{i}"] = combination_data
        
        return comparison_results
    
    def export_comparison_history(self, limit: int = None) -> List[Dict]:
        """Export comparison history data for analysis (simplified)"""
        history = self.get_comparison_history(limit or 1000)  # Default to large number if no limit
        
        # Flatten the data for easier analysis
        export_data = []
        for item in history:
            base_data = {
                'id': item['id'],
                'transcription': item['transcription'],
                'timestamp': item['timestamp'],
                'session_id': item['session_id'],
                'best_match': item['best_match'],
                'best_score': item['best_score']
            }
            
            # Add weight information
            weights = item.get('weights', {})
            for method, weight in weights.items():
                base_data[f'weight_{method}'] = weight
            
            # Add best line number
            all_scores = item.get('all_scores', {})
            if isinstance(all_scores, dict):
                base_data['best_line_number'] = all_scores.get('best_line_number', 0)
                
                # Add individual method scores from the best result
                individual_scores = all_scores.get('individual_scores', {})
                for method, score in individual_scores.items():
                    base_data[f'{method}_score'] = score
            
            export_data.append(base_data)
        
        return export_data