class FuzzyComparisonApp {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.currentTranscription = '';
        this.sessionId = this.generateSessionId();
        this.apiBaseUrl = 'http://localhost:8001';
        this.microphonePermissionGranted = false;
        
        // Set to true to disable search and only log scores
        this.logOnlyMode = false;

        this.weights = {
            ratio: 0.2,
            partial_ratio: 0.2,
            token_sort_ratio: 0.0,
            token_set_ratio: 0.6,
            wratio: 0.0
        };

        this.initializeElements();
        this.initializeSpeechRecognition();
        this.initializeSliders();
        this.loadHistory();
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.logModeBtn = document.getElementById('logModeBtn');
        this.transcriptionDisplay = document.getElementById('transcriptionDisplay');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.historyContainer = document.getElementById('historyContainer');

        // Export elements
        this.exportHistoryBtn = document.getElementById('exportHistoryBtn');

        this.startBtn.addEventListener('click', () => this.handleStartListening());
        this.stopBtn.addEventListener('click', () => this.stopListening());
        this.logModeBtn.addEventListener('click', () => this.toggleLogMode());

        // Export event listener
        this.exportHistoryBtn.addEventListener('click', () => this.exportHistoryData());
        
        // Check if we need to show permission info
        this.updatePermissionUI();
    }

    toggleLogMode() {
        this.logOnlyMode = !this.logOnlyMode;
        this.logModeBtn.textContent = `📝 DB Log: ${this.logOnlyMode ? 'ON' : 'OFF'}`;
        this.logModeBtn.style.background = this.logOnlyMode ? '#10b981' : '#6b7280';
        
        console.log(`Database logging mode ${this.logOnlyMode ? 'ENABLED' : 'DISABLED'}`);
        
        if (this.logOnlyMode) {
            this.resultsContainer.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #10b981;">
                    📝 Database logging mode enabled<br>
                    <small>Individual method scores will be logged to database for export analysis</small>
                </div>
            `;
        } else {
            this.resultsContainer.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #64748b;">
                    Results will appear here after transcription...
                </div>
            `;
        }
    }

    updatePermissionUI() {
        if (!this.microphonePermissionGranted) {
            this.transcriptionDisplay.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p style="margin-bottom: 15px; color: #64748b;">
                        🎤 Microphone access is required for speech recognition
                    </p>
                    <p style="font-size: 0.9rem; color: #94a3b8;">
                        Click "Start Listening" and allow microphone access when prompted
                    </p>
                </div>
            `;
        }
    }

    async handleStartListening() {
        if (!this.microphonePermissionGranted) {
            // Show loading state
            this.transcriptionDisplay.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #3b82f6;">
                    🎤 Requesting microphone permission...
                </div>
            `;
        }
        
        this.startListening();
    }

    initializeSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showError('Speech recognition not supported in this browser');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'pa-IN'; // Punjabi (India) - closest to Gurmukhi

        this.recognition.onstart = () => {
            this.isListening = true;
            this.microphonePermissionGranted = true; // Permission was granted if we reach here
            this.updateUI();
            this.transcriptionDisplay.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #10b981;">
                    🎤 Listening... Speak in Gurmukhi
                </div>
            `;
            this.transcriptionDisplay.classList.add('listening');
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            this.currentTranscription = finalTranscript || interimTranscript;
            
            if (this.currentTranscription) {
                this.transcriptionDisplay.innerHTML = `
                    <div style="padding: 20px;">
                        <div style="font-size: 1.2rem; color: #1e293b; margin-bottom: 10px;">
                            "${this.currentTranscription}"
                        </div>
                        <div style="font-size: 0.9rem; color: ${finalTranscript ? '#10b981' : '#f59e0b'};">
                            ${finalTranscript ? '✓ Final transcription' : '⏳ Interim transcription...'}
                        </div>
                    </div>
                `;
            } else {
                this.transcriptionDisplay.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #10b981;">
                        🎤 Listening... Speak in Gurmukhi
                    </div>
                `;
            }

            // If we have a final transcript, perform search
            if (finalTranscript.trim()) {
                this.performFuzzySearch(finalTranscript.trim());
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                this.microphonePermissionGranted = false;
                this.transcriptionDisplay.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #ef4444;">
                        ❌ Microphone access denied
                        <p style="font-size: 0.9rem; margin-top: 10px; color: #64748b;">
                            Please allow microphone access in your browser settings and try again
                        </p>
                    </div>
                `;
            } else {
                this.showError(`Speech recognition error: ${event.error}`);
            }
            this.stopListening();
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI();
            this.transcriptionDisplay.classList.remove('listening');
            
            if (this.microphonePermissionGranted && !this.currentTranscription) {
                this.transcriptionDisplay.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #64748b;">
                        Click "Start Listening" to begin audio transcription...
                    </div>
                `;
            }
        };
    }

    initializeSliders() {
        const sliders = [
            { id: 'ratioSlider', valueId: 'ratioValue', key: 'ratio' },
            { id: 'partialRatioSlider', valueId: 'partialRatioValue', key: 'partial_ratio' },
            { id: 'tokenSortSlider', valueId: 'tokenSortValue', key: 'token_sort_ratio' },
            { id: 'tokenSetSlider', valueId: 'tokenSetValue', key: 'token_set_ratio' },
            { id: 'wratioSlider', valueId: 'wratioValue', key: 'wratio' }
        ];

        sliders.forEach(({ id, valueId, key }) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(valueId);

            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.weights[key] = value;
                valueDisplay.textContent = value.toFixed(1);

                // Debounce the search to avoid too many API calls
                this.debounceSliderSearch();
            });
        });
    }

    debounceSliderSearch() {
        // Clear any existing timeout
        if (this.sliderSearchTimeout) {
            clearTimeout(this.sliderSearchTimeout);
        }
        
        // Schedule search after 300ms of inactivity
        this.sliderSearchTimeout = setTimeout(() => {
            if (this.currentTranscription.trim()) {
                this.performFuzzySearch(this.currentTranscription.trim());
            }
        }, 300);
    }

    startListening() {
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                if (error.name === 'InvalidStateError') {
                    // Recognition is already running, stop it first
                    this.recognition.stop();
                    setTimeout(() => {
                        this.recognition.start();
                    }, 100);
                } else {
                    this.showError(`Error starting speech recognition: ${error.message}`);
                }
            }
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    updateUI() {
        this.startBtn.disabled = this.isListening;
        this.stopBtn.disabled = !this.isListening;

        const statusIndicator = this.startBtn.querySelector('.status-indicator');
        if (this.isListening) {
            statusIndicator.className = 'status-indicator status-listening';
            this.startBtn.innerHTML = '<span class="status-indicator status-listening"></span>Listening...';
        } else {
            statusIndicator.className = 'status-indicator status-ready';
            this.startBtn.innerHTML = '<span class="status-indicator status-ready"></span>Start Listening';
        }
    }

    async performFuzzySearch(query) {
        try {
            this.showProcessing();

            const response = await fetch(`${this.apiBaseUrl}/api/fuzzy-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    weights: this.weights,
                    top_k: 10,
                    session_id: this.sessionId,
                    log_mode: this.logOnlyMode  // Send log mode flag to backend
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.displayResults(data.results);
            
            // In log mode, show additional info about database logging
            if (this.logOnlyMode) {
                console.log('=== DATABASE LOGGING MODE ===');
                console.log(`Query: "${query}"`);
                console.log(`Weights: ${JSON.stringify(this.weights)}`);
                console.log(`Results saved to database: ${data.results.length > 0 && data.results[0].weighted_score >= 75 ? 'YES' : 'NO (score < 75)'}`);
                console.log('Individual method scores logged to database for export');
                console.log('=== END DATABASE LOGGING ===');
            }
            
            // Debounce history loading to avoid too many requests
            this.scheduleHistoryUpdate();

        } catch (error) {
            console.error('Fuzzy search error:', error);
            this.showError(`Search error: ${error.message}`);
        }
    }

    scheduleHistoryUpdate() {
        // Clear any existing timeout
        if (this.historyUpdateTimeout) {
            clearTimeout(this.historyUpdateTimeout);
        }
        
        // Schedule history update after 1 second of inactivity
        this.historyUpdateTimeout = setTimeout(() => {
            this.loadHistory();
        }, 1000);
    }

    showProcessing() {
        this.resultsContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #f59e0b;">
                <span class="status-indicator status-processing"></span>
                Processing search...
            </div>
        `;
    }

    displayResults(results) {
        if (!results || results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #64748b;">
                    No results found
                </div>
            `;
            return;
        }

        // Log detailed scores for each result
        console.log('=== FUZZY SEARCH RESULTS SCORES ===');
        console.log(`Query: "${this.currentTranscription}"`);
        console.log(`Weights: ${JSON.stringify(this.weights)}`);
        console.log('');
        
        results.forEach((result, index) => {
            console.log(`Result #${index + 1} (Line ${result.line_number}):`);
            console.log(`Text: "${result.text}"`);
            console.log(`Weighted Score: ${result.weighted_score.toFixed(2)}`);
            console.log('Individual Method Scores:');
            console.log(`  • Ratio:           ${result.individual_scores.ratio.toFixed(2)}`);
            console.log(`  • Partial Ratio:   ${result.individual_scores.partial_ratio.toFixed(2)}`);
            console.log(`  • Token Sort:      ${result.individual_scores.token_sort_ratio.toFixed(2)}`);
            console.log(`  • Token Set:       ${result.individual_scores.token_set_ratio.toFixed(2)}`);
            console.log(`  • WRatio:          ${result.individual_scores.wratio.toFixed(2)}`);
            console.log('');
        });
        
        // Log score breakdown calculation
        console.log('=== WEIGHTED SCORE CALCULATION ===');
        results.forEach((result, index) => {
            const scores = result.individual_scores;
            const calculation = 
                `(${scores.ratio.toFixed(2)} × ${this.weights.ratio}) + ` +
                `(${scores.partial_ratio.toFixed(2)} × ${this.weights.partial_ratio}) + ` +
                `(${scores.token_sort_ratio.toFixed(2)} × ${this.weights.token_sort_ratio}) + ` +
                `(${scores.token_set_ratio.toFixed(2)} × ${this.weights.token_set_ratio}) + ` +
                `(${scores.wratio.toFixed(2)} × ${this.weights.wratio})`;
            
            const calculatedScore = 
                (scores.ratio * this.weights.ratio) +
                (scores.partial_ratio * this.weights.partial_ratio) +
                (scores.token_sort_ratio * this.weights.token_sort_ratio) +
                (scores.token_set_ratio * this.weights.token_set_ratio) +
                (scores.wratio * this.weights.wratio);
            
            console.log(`Result #${index + 1} Calculation:`);
            console.log(`${calculation} = ${calculatedScore.toFixed(2)}`);
            console.log(`Actual weighted score: ${result.weighted_score.toFixed(2)}`);
            console.log('');
        });
        
        console.log('=== END FUZZY SEARCH RESULTS ===');

        const resultsHtml = results.map((result, index) => `
            <div class="result-item">
                <div class="result-text">${result.text}</div>
                <div class="result-scores">
                    <span class="score-badge weighted">Weighted: ${result.weighted_score.toFixed(2)}</span>
                    <span class="score-badge">Ratio: ${result.individual_scores.ratio.toFixed(1)}</span>
                    <span class="score-badge">Partial: ${result.individual_scores.partial_ratio.toFixed(1)}</span>
                    <span class="score-badge">Token Sort: ${result.individual_scores.token_sort_ratio.toFixed(1)}</span>
                    <span class="score-badge">Token Set: ${result.individual_scores.token_set_ratio.toFixed(1)}</span>
                    <span class="score-badge">WRatio: ${result.individual_scores.wratio.toFixed(1)}</span>
                </div>
                <div class="result-meta">Line ${result.line_number}</div>
            </div>
        `).join('');

        this.resultsContainer.innerHTML = resultsHtml;
    }

    async loadHistory() {
        try {
            // Load only 5 most recent items for better performance
            const response = await fetch(`${this.apiBaseUrl}/api/fuzzy-history?limit=5`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.displayHistory(data.history);

        } catch (error) {
            console.error('History load error:', error);
            this.historyContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #ef4444;">
                    Error loading history: ${error.message}
                </div>
            `;
        }
    }

    displayHistory(history) {
        if (!history || history.length === 0) {
            this.historyContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #64748b;">
                    No comparison history yet
                </div>
            `;
            return;
        }

        const historyHtml = history.map(item => {
            const weightsDisplay = Object.entries(item.weights || {})
                .filter(([key, value]) => value > 0)
                .map(([key, value]) => `<span class="history-weight">${key}: ${value}</span>`)
                .join('');

            // Display individual method scores from the best result
            let individualScoresHtml = '';
            const allScores = item.all_scores || {};
            const individualScores = allScores.individual_scores || {};
            
            if (Object.keys(individualScores).length > 0) {
                const scoresDisplay = Object.entries(individualScores)
                    .map(([method, score]) => `<span class="score-badge">${method}: ${score.toFixed(1)}</span>`)
                    .join('');
                
                if (scoresDisplay) {
                    individualScoresHtml = `
                        <div style="margin: 10px 0;">
                            <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 5px;">Individual Method Scores:</div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">${scoresDisplay}</div>
                        </div>
                    `;
                }
            }

            return `
                <div class="history-item">
                    <div class="history-transcription">"${item.transcription}"</div>
                    <div class="history-result">Best weighted match (${(item.best_score || 0).toFixed(2)}): ${item.best_match || 'N/A'}</div>
                    ${individualScoresHtml}
                    <div class="history-weights">${weightsDisplay}</div>
                    <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 5px;">
                        ${new Date(item.timestamp).toLocaleString()}
                    </div>
                </div>
            `;
        }).join('');

        this.historyContainer.innerHTML = historyHtml;
    }

    showError(message) {
        this.resultsContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                ❌ ${message}
            </div>
        `;
    }

    async exportHistoryData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/export-comparison-history`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Create and download CSV
            const csvContent = this.convertToCSV(data.export_data);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fuzzy_comparison_history_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            alert(`Exported ${data.total_records} comparison records to CSV`);

        } catch (error) {
            console.error('Export error:', error);
            alert(`Error exporting data: ${error.message}`);
        }
    }

    convertToCSV(data) {
        if (!data || data.length === 0) return '';

        // Get all possible headers from the data
        const allHeaders = new Set();
        data.forEach(row => {
            Object.keys(row).forEach(key => allHeaders.add(key));
        });

        const headers = Array.from(allHeaders).sort();
        const csvRows = [headers.join(',')];

        for (const row of data) {
            const values = headers.map(header => {
                let value = row[header];
                if (typeof value === 'string') {
                    value = `"${value.replace(/"/g, '""')}"`;
                } else if (value === null || value === undefined) {
                    value = '';
                }
                return value;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FuzzyComparisonApp();
});