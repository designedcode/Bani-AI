import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ModeSelection from './components/ModeSelection';
import BaniCore from './components/BaniCore';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ModeSelection />} />
        <Route path="/kirtan" element={<BaniCore mode="kirtan" />} />
        <Route path="/paath" element={<BaniCore mode="paath" />} />
      </Routes>
    </Router>
  );
}

export default App;
