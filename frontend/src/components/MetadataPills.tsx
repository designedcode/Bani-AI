import React from 'react';
import './MetadataPills.css';

interface MetadataPillsProps {
  raag?: string;
  writer?: string;
  page?: string | number;
}

const MetadataPills: React.FC<MetadataPillsProps> = ({ raag, writer, page }) => {
  return (
    <div className="metadata-pills-row">
      {raag && (
        <span className="pill pill-raag">{raag}</span>
      )}
      {writer && (
        <span className="pill pill-writer">{writer}</span>
      )}
      {page && (
        <span className="pill pill-page">Page {page}</span>
      )}
    </div>
  );
};

export default MetadataPills; 