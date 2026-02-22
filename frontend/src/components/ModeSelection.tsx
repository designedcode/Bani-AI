import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ModeSelection.css';

const ModeSelection: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="mode-selection-container">
            <div
                className="mode-panel paath-mode"
                onClick={() => navigate('/paath')}
            >
                <div className="mode-content">
                    <div className="mode-icon">📿</div>
                    <h2 className="mode-title">Paath Mode</h2>
                    <p className="mode-description">For reading and reciting Gurbani</p>
                </div>
            </div>

            <div
                className="mode-panel kirtan-mode"
                onClick={() => navigate('/kirtan')}
            >
                <div className="mode-content">
                    <div className="mode-icon">🎵</div>
                    <h2 className="mode-title">Kirtan Mode</h2>
                    <p className="mode-description">For singing and musical recitation</p>
                </div>
            </div>
        </div>
    );
};

export default ModeSelection;
