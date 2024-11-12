"use client";
import { useState, useEffect } from 'react';

export default function CV() {
  const [scale, setScale] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const isMobileDevice = window.innerWidth <= 768; // Adjust breakpoint as needed
      setIsMobile(isMobileDevice);

      if (!isMobileDevice) {
        const cvWidth = 1000; 
        const availableWidth = window.innerWidth;
        const widthScale = availableWidth / cvWidth;
        const newScale = widthScale;


        setScale(newScale);
      } else {
        setScale(1);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <br/>
      <h1 className="text-4xl font-bold mb-4">Curriculum Vitae</h1>
      {isMobile ? (
        // Do not show CV on mobile, just show the download button or a message
        <p className="text-center mb-4">Please download my CV below.</p>
      ) : (
        // Scaled iframe for larger screens
        <div
          className="overflow-hidden"
          style={{
            width: `${816 * scale}px`,
            height: `${1450 * scale}px`,
          }}
        >
          <iframe
            src="https://docs.google.com/document/d/e/2PACX-1vTI_n0Epv5KdWd5cO9d_78Lbvzvpb2gN7IqtrOPrYEpLHBd9islycKCqAk3BoDcH0fEOMzypmLvVQan/pub?embedded=true"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: '816px',
              height: '3156px',
              border: 'none',
            }}
            title="My CV"
          ></iframe>
        </div>
      )}

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
