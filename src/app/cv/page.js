"use client";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import VanillaTilt from 'vanilla-tilt'; // You'll need to install this
import { CV_CONFIG } from './config';

export default function CV() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Initialize tilt effect on the CV container
    const tiltElement = document.querySelector(".tilt-element");
    if (tiltElement && !isMobile) {
      VanillaTilt.init(tiltElement, {
        max: 5, // maximum tilt rotation (degrees)
        scale: 1.05, // scaling on hover
        speed: 1000, // Speed of the enter/exit transition
        glare: true, // Enable glare effect
        "max-glare": 0.2, // maximum glare opacity
        perspective: 1000, // Transform perspective, the lower the more extreme the tilt gets
      });
    }
  }, [isMobile]);

  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      // className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-white p-8"
      className="flex flex-col items-center justify-center"

    >
      <motion.h1 
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        className="text-5xl font-bold mb-8 text-gray-800 tracking-tight"
      >

      </motion.h1>

      {isMobile ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg"
        >
          <p className="text-lg text-gray-700">
            For the best viewing experience, please download the CV below.
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <a
              href={CV_CONFIG.pdfDownloadUrl}
              download
              className="inline-block bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
            >
              Download CV as PDF
            </a>
          </motion.div>
        </motion.div>
      ) : (
        <div className="space-y-8">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="tilt-element relative bg-white rounded-xl shadow-2xl overflow-hidden"
            style={{
              width: '850px',
              height: '1100px',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Decorative elements */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-white/30 pointer-events-none z-10" />
            <div className="absolute -inset-1 bg-gradient-to-tr from-green-500/20 to-blue-500/20 blur-sm" />
            
            <iframe
              src={CV_CONFIG.embeddedViewUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                transform: 'translateZ(50px)', // 3D effect
                position: 'relative',
                zIndex: 1,
              }}
              title="My CV"
              className="bg-white"
            />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href={CV_CONFIG.pdfDownloadUrl}
              download
              className="inline-block bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
            >
              Download CV as PDF
            </motion.a>
          </motion.div>
        </div>
      )}
    </motion.main>
  );
}
