import React from 'react';
import './LoadingOverlay.css';

const VIDEO_URL = process.env.PUBLIC_URL + '/uploads/blackhole-loader.webm';

// Generate 120 stars that move from anywhere in the viewport toward the center
function getRandom(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

const STARS = Array.from({ length: 120 }).map(() => {
  const duration = getRandom(7, 14);
  const delay = getRandom(0, 5);
  // Disperse stars all over the viewport
  const top = getRandom(0, 100);
  const left = getRandom(0, 100);
  // Calculate translation to center (50vw, 50vh)
  const x = 50 - left;
  const y = 50 - top;
  const transform = `translate(${x}vw, ${y}vh)`;
  return { duration, delay, top, left, transform };
});

interface LoadingOverlayProps {
  className?: string;
  volume?: number;
  children?: React.ReactNode;
  subtitle?: React.ReactNode;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  className = '',
  volume = 0,
  children,
  subtitle
}) => {
  // Volume-based scaling (range: 1.0 to 2.0)
  const adjustedVolume = Math.pow(Math.min(volume, 1), 0.5);
  const scale = 1 + adjustedVolume * 1.0;



  return (
    <div className={`loading-overlay hero-black-hole hero-black-hole-visible ${className}`.trim()}>
      <div
        className="loading-overlay-scaled-content"
        style={{
          transform: `scale(${scale})`,
          transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="ek-onkar-fade-in" style={{ left: '51%' }}>
          <img
            src={process.env.PUBLIC_URL + '/uploads/inner.svg'}
            alt="Inner Symbol"
            width={220}
            height={154}
          />
        </div>
        <div className="loader-fade-in">
          <div className="lazy-video lazy-video-loaded">
            <video
              preload="auto"
              muted
              playsInline
              loop
              autoPlay
              className="hero-black-hole-video hero-black-hole-video-large"
              src={VIDEO_URL}
            />
          </div>
          <div className="hero-black-hole-stars">
            {STARS.map((star, i) => (
              <div
                key={i}
                style={{
                  animationDuration: `${star.duration}s`,
                  animationDelay: `${star.delay}s`,
                  top: `${star.top}%`,
                  left: `${star.left}%`,
                  ['--transform' as any]: star.transform,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Overlay bottom content for children (TranscriptionPanel, SearchResults) */}
      {children && (
        <div className="loading-overlay-bottom-content">
          {children}
        </div>
      )}
      {/* Subtitle */}
      {subtitle && (
        <div className="loading-overlay-subtitle">
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default LoadingOverlay; 