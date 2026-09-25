"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaGlobe } from "react-icons/fa";
import { FiX } from "react-icons/fi";

const getImportanceStyles = (importance = 5) => {
  if (importance >= 8) {
    return {
      borderStyle: "border-l-4 border-t-4",
      borderColor: "border-accent-hover",
      bgGradient: "bg-gradient-to-r from-accent-hover/15 to-transparent",
    };
  } else if (importance >= 5) {
    return {
      borderStyle: "border-l-4",
      borderColor: "border-accent",
      bgGradient: "bg-gradient-to-r from-accent/15 to-transparent",
    };
  } else if (importance >= 2) {
    return {
      borderStyle: "border-l-2",
      borderColor: "border-accent",
      bgGradient: "bg-gradient-to-r from-accent/10 to-transparent",
    };
  } else {
    return {
      borderStyle: "border-l",
      borderColor: "border-dark-border",
      bgGradient: "bg-gradient-to-r from-white/5 to-transparent",
    };
  }
};

export default function MarkerInfo({ marker, onClose, navigateWithRefresh }) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!marker) return null;

  const activities = marker.activities && marker.activities.length > 0
    ? marker.activities
    : [
        {
          title: marker.title || marker.label,
          venue: marker.venue,
          city: marker.city,
          country: marker.country,
          date: marker.date,
          slug: marker.slug,
          importance: marker.importance || 5,
          shortDescription: marker.shortDescription,
        },
      ];

  const handleSeeMore = (slug) => {
    onClose?.();
    if (slug && navigateWithRefresh) {
      navigateWithRefresh(slug);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md pointer-events-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <motion.div
          key="marker-modal"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-amber-500/30 bg-[#140e09]/95 text-white shadow-2xl backdrop-blur-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5 border-b border-amber-500/20 bg-[#1a120c]/80 flex-shrink-0">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                <FaGlobe className="w-3.5 h-3.5 text-accent" />
                <span>
                  {marker.city}, {marker.country}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-1 leading-snug">
                {marker.venue || marker.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer flex-shrink-0"
              aria-label="Close details"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Body: Activity Cards matching the exact Project Card widget */}
          <div className="overflow-y-auto p-4 sm:p-6 space-y-4">
            {activities.map((activity, index) => {
              const importance = activity.importance || 5;
              const isMicro = importance < 2;
              const isMinor = importance >= 2 && importance < 5;
              const styles = getImportanceStyles(importance);

              return (
                <div
                  key={activity.slug || index}
                  className={`relative overflow-hidden rounded-xl p-4 sm:p-5 shadow-lg backdrop-blur-lg transition-all duration-300 border bg-[#1a120c]/90 ${
                    activity.highlighted ? "ring-1 ring-accent" : ""
                  } ${styles.borderStyle} ${styles.borderColor}`}
                >
                  {/* Subtle Gradient Glow */}
                  <div
                    className={`absolute inset-0 ${styles.bgGradient} pointer-events-none rounded-xl`}
                  />

                  <div className="relative z-20">
                    <div className="flex items-start justify-between gap-3">
                      <h3
                        className={`${
                          isMicro
                            ? "text-sm sm:text-base"
                            : isMinor
                              ? "text-base sm:text-lg"
                              : "text-lg sm:text-xl"
                        } mb-2 max-w-[74%] font-bold leading-snug text-white`}
                      >
                        {activity.title}
                      </h3>
                      <div className="flex flex-col items-end gap-2 ml-auto flex-shrink-0">
                        {(isMicro || isMinor) && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                              isMicro
                                ? "bg-[#251b14] text-stone-300"
                                : "bg-accent/20 text-accent font-semibold"
                            }`}
                          >
                            {isMicro ? "MICRO" : "MINOR"}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSeeMore(activity.slug)}
                          className="whitespace-nowrap rounded-md border border-light-border bg-white/70 px-3 py-1 text-xs font-semibold text-light-foreground-secondary shadow-sm hover:border-accent hover:text-accent dark:border-dark-border dark:bg-dark-background/50 dark:text-dark-foreground-secondary flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>See more</span>
                          <span className="text-accent text-[11px] font-bold">↓</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-hidden">
                      {!isMinor && (
                        <div className="group relative inline-block mb-1">
                          <p className="flex items-center gap-1 text-light-foreground-secondary dark:text-dark-foreground-secondary text-xs sm:text-sm truncate">
                            <FaGlobe className="text-accent flex-shrink-0" />
                            <span className="truncate">
                              {activity.mapData?.venue || activity.venue || marker.venue},{" "}
                              {activity.mapData?.city || activity.city || marker.city}/
                              {activity.mapData?.country || activity.country || marker.country}
                            </span>
                          </p>
                        </div>
                      )}

                      <p className="mb-3 text-light-foreground-secondary dark:text-dark-foreground-secondary text-xs sm:text-sm truncate">
                        {activity.date}
                      </p>

                      {activity.shortDescription && (
                        <div className="mb-2 rounded-md bg-light-background-secondary/70 p-3 sm:p-4 dark:bg-dark-background/35 border-l-2 border-accent dark:border-accent">
                          <div className="flex items-center mb-1">
                            <span className="text-xs uppercase tracking-wider text-accent dark:text-accent font-semibold">
                              Summary
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-light-foreground-secondary dark:text-dark-foreground-secondary italic leading-relaxed">
                            {activity.shortDescription}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
