import React, { useRef, useState } from 'react';
import './FileUpload.css';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isUploading: boolean;
  disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, isUploading, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      onFileUpload(file);
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="file-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.ogg,.flac"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || isUploading}
      />
      
      <div
        className={`upload-area ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {isUploading ? (
          <div className="upload-content">
            <div className="upload-spinner"></div>
            <span>Uploading...</span>
          </div>
        ) : (
          <div className="upload-content">
            <span className="upload-icon">📁</span>
            <span className="upload-text">
              {disabled ? 'Upload Disabled' : 'Upload Audio File'}
            </span>
            <span className="upload-hint">
              Drag & drop or click to upload
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload; 