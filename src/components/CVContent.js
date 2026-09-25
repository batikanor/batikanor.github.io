"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FaDownload, FaGoogleDrive, FaRedo } from "react-icons/fa";
import { CV_CONFIG } from "../app/cv/config";

const compactActionClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-sm transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-[#140e09] sm:px-4 sm:text-sm";

export default function CVContent() {
  const [viewportMode, setViewportMode] = useState("unknown");
  const [mobilePdfUrl, setMobilePdfUrl] = useState(null);
  const [mobilePdfStatus, setMobilePdfStatus] = useState("idle");
  const [mobilePdfAttempt, setMobilePdfAttempt] = useState(0);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 640px)");
    const syncViewportMode = () => {
      setViewportMode(desktopQuery.matches ? "desktop" : "mobile");
    };

    syncViewportMode();
    desktopQuery.addEventListener("change", syncViewportMode);

    return () => desktopQuery.removeEventListener("change", syncViewportMode);
  }, []);

  useEffect(() => {
    if (viewportMode !== "mobile") return undefined;

    let cancelled = false;
    let objectUrl;

    const prepareLatestPdf = async () => {
      setMobilePdfUrl(null);
      setMobilePdfStatus("loading");

      try {
        const response = await fetch(CV_CONFIG.pdfDownloadUrl, {
          cache: "no-store",
          credentials: "omit",
          mode: "cors",
          redirect: "follow",
        });

        if (!response.ok) {
          throw new Error(`Google Docs returned HTTP ${response.status}`);
        }

        const pdf = await response.blob();
        const signature = await pdf.slice(0, 5).text();

        if (signature !== "%PDF-") {
          throw new Error("Google Docs did not return a PDF");
        }

        objectUrl = URL.createObjectURL(
          new Blob([pdf], { type: "application/pdf" }),
        );

        if (!cancelled) {
          setMobilePdfUrl(objectUrl);
          setMobilePdfStatus("ready");
        }
      } catch (error) {
        console.error("Unable to prepare the latest mobile CV PDF", error);
        if (!cancelled) setMobilePdfStatus("error");
      }
    };

    prepareLatestPdf();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mobilePdfAttempt, viewportMode]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="mx-auto w-full max-w-6xl px-2 sm:px-4"
      data-mobile-pdf-status={mobilePdfStatus}
      data-cv-viewport={viewportMode}
    >
      <div className="space-y-4 sm:space-y-8">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="mx-auto w-full max-w-[880px] overflow-hidden rounded-2xl border border-amber-500/25 bg-[#140e09] shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-[#1a120c]/95 p-3 sm:p-4 backdrop-blur-xl">
            {/* Left title badge */}
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs sm:text-sm font-semibold tracking-wider text-amber-200/90 font-mono uppercase">
                Curriculum Vitae
              </span>
            </div>

            {/* Right action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={CV_CONFIG.embeddedViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${compactActionClass} border border-amber-500/30 bg-[#251a12]/90 text-amber-100 hover:border-amber-400 hover:text-white hover:bg-[#342419] transition-colors`}
                aria-label="Open CV in Google Drive"
                title="Open CV in Google Drive"
              >
                <FaGoogleDrive aria-hidden="true" className="text-sm text-amber-400" />
                <span className="sm:hidden">Drive</span>
                <span className="hidden sm:inline">Google Drive</span>
              </a>
              {mobilePdfUrl ? (
                <a
                  href={mobilePdfUrl}
                  download="Batikan-Bora-Ormanci-CV.pdf"
                  className={`${compactActionClass} bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white hover:from-amber-500 hover:via-orange-500 hover:to-amber-600 shadow-md sm:hidden`}
                  aria-label="Download latest CV as PDF"
                >
                  <FaDownload aria-hidden="true" className="text-[11px]" />
                  <span>PDF</span>
                </a>
              ) : mobilePdfStatus === "error" ? (
                <button
                  type="button"
                  onClick={() => setMobilePdfAttempt((attempt) => attempt + 1)}
                  className={`${compactActionClass} bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white sm:hidden`}
                  aria-label="Retry preparing latest CV PDF"
                >
                  <FaRedo aria-hidden="true" className="text-[11px]" />
                  <span>Retry</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className={`${compactActionClass} cursor-wait bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white opacity-70 sm:hidden`}
                  aria-label="Preparing latest CV PDF"
                >
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  <span>PDF</span>
                </button>
              )}
              <a
                href={CV_CONFIG.pdfDownloadUrl}
                download="Batikan-Bora-Ormanci-CV.pdf"
                className={`${compactActionClass} hidden bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white hover:from-amber-500 hover:via-orange-500 hover:to-amber-600 shadow-md sm:inline-flex`}
                aria-label="Download CV as PDF"
              >
                <FaDownload aria-hidden="true" className="text-[11px]" />
                <span>PDF</span>
              </a>
            </div>
          </div>

          {viewportMode === "desktop" && (
            <div className="relative aspect-[596/842] overflow-hidden bg-white dark:bg-[#140e09]">
              <iframe
                src={CV_CONFIG.embeddedViewUrl}
                title="Batıkan Bora Ormancı's CV"
                className="block h-full w-full border-0 bg-white"
              />
            </div>
          )}
        </motion.div>

        <p className="mx-auto max-w-[880px] px-2 text-center text-xs leading-relaxed text-[#d4c5b5]/75 sm:hidden">
          Tap <strong>Drive</strong> for a full-screen, zoomable view. The{" "}
          <strong>PDF</strong> button downloads the latest version directly.
        </p>

        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="hidden justify-center sm:flex"
        >
          <a
            href={CV_CONFIG.pdfDownloadUrl}
            download="Batikan-Bora-Ormanci-CV.pdf"
            className="group flex items-center gap-2.5 rounded-full border border-amber-500/30 bg-[#160f0a]/90 px-6 py-3 text-sm font-semibold text-amber-100 hover:text-white shadow-xl backdrop-blur-xl transition hover:border-amber-400 hover:bg-[#24170f]"
          >
            <FaDownload className="text-sm text-amber-400 group-hover:translate-y-0.5 transition-transform" aria-hidden="true" />
            <span>Download CV as PDF</span>
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
}
