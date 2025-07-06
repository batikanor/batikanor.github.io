"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FaDownload, FaFileAlt } from "react-icons/fa";
import { CV_CONFIG } from "../app/cv/config";

export default function CVContent() {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-6xl mx-auto px-4"
    >
      {isMobile ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="card text-center space-y-6"
        >
          <div className="space-y-4">
            <FaFileAlt className="text-5xl text-accent mx-auto" />
            <h3 className="text-2xl font-bold gradient-text">My CV</h3>
          </div>
          <p>
            Please access this page through a computer if you'd like to download
            a pdf version.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href={CV_CONFIG.pdfDownloadUrl}
              download
              className="btn flex items-center gap-2"
            >
              <FaDownload className="text-sm" />
              View in Google Docs
            </motion.a>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {/* CV Viewer */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="flex justify-center"
          >
            {/* Main CV Container - Clean and Modern */}
            <div
              className="relative card overflow-hidden hover-lift"
              style={{ width: "1350px" }}
            >
              {/* CV Content Container */}
              <div className="relative bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
                {/* Loading Overlay */}
                {isLoading && (
                  <div className="absolute inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-10 rounded-xl">
                    <div className="text-center space-y-4">
                      <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto"></div>
                      <p className="text-gray-600 dark:text-gray-400">
                        Loading CV...
                      </p>
                    </div>
                  </div>
                )}

                {/* Google Docs Iframe */}
                <div
                  style={{
                    width: "100%",
                    height: "1747px",
                    overflow: "hidden",
                  }}
                >
                  <iframe
                    src={CV_CONFIG.embeddedViewUrl}
                    onLoad={handleIframeLoad}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      opacity: isLoading ? 0 : 1,
                      zoom: "1.3",
                    }}
                    title="Batıkan's CV"
                    className="transition-opacity duration-500 bg-white"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap gap-4 justify-center"
          >
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href={CV_CONFIG.pdfDownloadUrl}
              download
              className="btn flex items-center gap-3"
            >
              <FaDownload className="text-sm" />
              Download PDF
            </motion.a>
          </motion.div>

          {/* Info Card */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center"
          >
            <div className="card max-w-2xl mx-auto">
              <p className="text-gray-600 dark:text-gray-400">
                If you expected my experience(s) to be listed through a
                different format, please send me an email and I will do my best
                to present myself better.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
