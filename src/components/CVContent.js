"use client";

import { motion } from "framer-motion";
import { FaDownload, FaGoogleDrive } from "react-icons/fa";
import { CV_CONFIG } from "../app/cv/config";

const compactActionClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-sm transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-gray-950 sm:px-4 sm:text-sm";

export default function CVContent() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="mx-auto w-full max-w-6xl px-2 sm:px-4"
    >
      <div className="space-y-4 sm:space-y-8">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="mx-auto w-full max-w-[880px] overflow-hidden rounded-2xl border border-light-border/70 bg-[#f8f9fa] shadow-2xl dark:border-dark-border/70 dark:bg-gray-950"
        >
          <div className="flex items-center justify-end gap-2 border-b border-gray-200 bg-white/95 p-3 dark:border-gray-800 dark:bg-gray-900/95 sm:p-4">
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={CV_CONFIG.embeddedViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${compactActionClass} border border-[#0f9d58]/35 bg-[#0f9d58]/10 text-[#0b8043] hover:border-[#0f9d58] hover:bg-[#0f9d58]/15 dark:border-[#34a853]/40 dark:bg-[#34a853]/10 dark:text-[#81c995]`}
                aria-label="Open CV in Google Drive"
                title="Open CV in Google Drive"
              >
                <FaGoogleDrive aria-hidden="true" className="text-sm" />
                <span className="sm:hidden">Drive</span>
                <span className="hidden sm:inline">Google Drive</span>
              </a>
              <a
                href={CV_CONFIG.pdfDownloadUrl}
                download="Batikan-Bora-Ormanci-CV.pdf"
                className={`${compactActionClass} bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white hover:from-amber-700 hover:via-orange-700 hover:to-red-700`}
                aria-label="Download CV as PDF"
              >
                <FaDownload aria-hidden="true" className="text-[11px]" />
                <span>PDF</span>
              </a>
            </div>
          </div>

          <div className="relative aspect-[596/842] overflow-hidden bg-white dark:bg-gray-900">
            <iframe
              src={`${CV_CONFIG.pdfDownloadUrl}#view=FitH&toolbar=0&navpanes=0`}
              title="Batıkan Bora Ormancı's mobile CV preview"
              className="block h-full w-full border-0 bg-white sm:hidden"
            />
            <iframe
              src={CV_CONFIG.embeddedViewUrl}
              title="Batıkan Bora Ormancı's CV"
              className="hidden h-full w-full border-0 bg-white sm:block"
            />
          </div>
        </motion.div>

        <p className="mx-auto max-w-[880px] px-2 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400 sm:hidden">
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
            className="btn flex items-center gap-3"
          >
            <FaDownload className="text-sm" aria-hidden="true" />
            Download CV as PDF
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
}
