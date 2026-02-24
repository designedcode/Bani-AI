import React, { useEffect, useRef } from 'react';
import './AudioVisualizer.css';

interface AudioVisualizerProps {
  isListening: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isListening }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null!);

  useEffect(() => {
    if (!isListening || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      if (!isListening) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create animated bars
      const barCount = 20;
      const barWidth = canvas.width / barCount;

      for (let i = 0; i < barCount; i++) {
        const height = Math.random() * canvas.height * 0.8;
        const x = i * barWidth;
        const y = canvas.height - height;

        // Create gradient
        const gradient = ctx.createLinearGradient(x, y, x, canvas.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - 2, height);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening]);

  return (
    <div className="audio-visualizer">
      <h4>🎵 Audio Activity</h4>
      <canvas
        ref={canvasRef}
        width={300}
        height={100}
        className={`visualizer-canvas ${isListening ? 'active' : ''}`}
      />
      <div className="visualizer-status">
        {isListening ? 'Capturing audio...' : 'Audio monitoring inactive'}
      </div>
    </div>
  );
};

export default AudioVisualizer; 