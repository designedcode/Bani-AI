import React from 'react';
import './SearchResults.css';

interface SearchResult {
  gurmukhi_text: string;
  english_translation: string;
  line_number: number;
  page_number: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  transcribedText: string;
  sggsMatchFound?: boolean | null;
  fallbackUsed?: boolean | null;
  bestSggsMatch?: string | null;
  bestSggsScore?: number | null;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, transcribedText, sggsMatchFound, fallbackUsed, bestSggsMatch, bestSggsScore }) => {
  return (
    <div className="search-results">
      <div className="panel-header">
        <h3>📖 Bani-DB Search Results</h3>
        {transcribedText && (
          <div className="search-query">
            Query: <span className="query-text gurmukhi-text">{transcribedText}</span>
          </div>
        )}
        {(sggsMatchFound !== null || fallbackUsed !== null) && (
          <div className="sggs-indicators">
            {sggsMatchFound === true && <span className="sggs-match-found">✅ Found in SGGS</span>}
            {sggsMatchFound === false && <span className="sggs-match-not-found">❌ Not found in SGGS</span>}
            {fallbackUsed === true && <span className="fallback-used">⚠️ Fallback search used</span>}
          </div>
        )}
        {bestSggsMatch && (
          <div className="best-sggs-match">
            <span>Best SGGS Match: <span className="gurmukhi-text">{bestSggsMatch}</span></span>
            {bestSggsScore !== null && bestSggsScore !== undefined && <span> (Score: {bestSggsScore.toFixed(1)})</span>}
          </div>
        )}
      </div>
      
      <div className="results-content">
        {results.length > 0 ? (
          <div className="results-list">
            {results.map((result, index) => (
              <div key={index} className="result-item">
                <div className="result-header">
                  <span className="line-number">Line {result.line_number}</span>
                  <span className="page-number">Page {result.page_number}</span>
                </div>
                
                <div className="gurmukhi-text result-text">
                  {result.gurmukhi_text}
                </div>
                
                {result.english_translation && (
                  <div className="english-translation">
                    {result.english_translation}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-results">
            {transcribedText 
              ? 'No matching Bani found in database' 
              : 'Transcribe some text to search Bani-DB'
            }
          </div>
        )}
      </div>
      
      {results.length > 0 && (
        <div className="results-stats">
          <span>Found {results.length} result{results.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
};

export default SearchResults; 