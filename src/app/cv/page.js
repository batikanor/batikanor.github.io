"use client"
import { useState, useEffect, useRef } from 'react';

export default function CV() {
  const iframeRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      const cvWidth = 816; // Original CV width in pixels
      const cvHeight = 1056; // Original CV height in pixels

      const availableWidth = window.innerWidth;
      const availableHeight = window.innerHeight;

      const widthScale = availableWidth / cvWidth;
      const heightScale = availableHeight / cvHeight;
      const newScale = Math.min(widthScale, heightScale);

      setScale(newScale);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">

      <h1 className="text-4xl font-bold mb-4">My CV</h1>
      <div
        className="overflow-hidden"
        style={{
          width: `${816 * scale}px`,
          height: `${1056 * scale}px`,
        }}
      >
        <iframe
          ref={iframeRef}
          src="https://docs.google.com/document/d/e/2PACX-1vTI_n0Epv5KdWd5cO9d_78Lbvzvpb2gN7IqtrOPrYEpLHBd9islycKCqAk3BoDcH0fEOMzypmLvVQan/pub?embedded=true"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: '816px',
            height: '1056px',
            border: 'none',
          }}
          title="My CV"
        ></iframe>
      </div>
      <a
        href="https://docs.google.com/document/d/1ZVQcdNvOR46HBUCtVy6XKFOXocRYL9-TR_LLrRfJ2T8/export?format=pdf"
        download
        className="mt-4 inline-block bg-green-500 text-white px-4 py-2 rounded"
      >
        Download CV as PDF
      </a>
    </main>
  );
}
