/* eslint-disable react/no-unescaped-entities */

"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  FiChevronDown,
  FiGlobe,
  FiMap,
  FiNavigation,
  FiRadio,
} from "react-icons/fi";
import CVContent from "../components/CVContent";
import Projects from "../components/Projects";

// Dynamically import both components without server-side rendering
const AchievementMap = dynamic(() => import("../components/AchievementMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] bg-gray-900/50 rounded-2xl">
      <div className="text-gray-400">Loading map...</div>
    </div>
  ),
});

const GlobeGame = dynamic(() => import("../components/GlobeGame"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[800px] items-center justify-center rounded-2xl bg-gray-900/50">
      <div className="text-gray-400">Loading globe...</div>
    </div>
  ),
});

const HERO_MOTTOS = ["Someone", "a Friend"];

const ACHIEVEMENT_VIEWS = [
  {
    id: "original",
    shortLabel: "Classic map",
    icon: FiMap,
  },
  {
    id: "journeys",
    shortLabel: "Connected map",
    icon: FiNavigation,
  },
  {
    id: "satellite",
    shortLabel: "Satellite map",
    icon: FiRadio,
  },
  {
    id: "globe",
    shortLabel: "3D map",
    icon: FiGlobe,
  },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [achievementView, setAchievementView] = useState("satellite");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [mottoIndex, setMottoIndex] = useState(0);
  const viewMenuRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMottoIndex((currentIndex) => (currentIndex + 1) % HERO_MOTTOS.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!viewMenuOpen) return undefined;

    const closeViewMenu = (event) => {
      if (!viewMenuRef.current?.contains(event.target)) {
        setViewMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeViewMenu);
    return () => document.removeEventListener("pointerdown", closeViewMenu);
  }, [viewMenuOpen]);

  const navigateWithRefresh = (slug) => {
    const url = `${window.location.origin}/projects#${slug}`;
    window.location.href = url;
  };

  const scrollToCv = (event) => {
    event.preventDefault();

    const cvSection = document.getElementById("cv");
    if (!cvSection) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cvSection.scrollIntoView();
      window.history.replaceState(null, "", "#cv");
      return;
    }

    const startY = window.scrollY;
    const targetY = cvSection.getBoundingClientRect().top + startY;
    const distance = targetY - startY;
    const duration = 1200;
    const startedAt = performance.now();

    const animateScroll = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      window.scrollTo(0, startY + distance * eased);

      if (progress < 1) {
        window.requestAnimationFrame(animateScroll);
      } else {
        window.history.replaceState(null, "", "#cv");
      }
    };

    window.requestAnimationFrame(animateScroll);
  };

  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return null; // or a loading skeleton
  }

  return (
    <div className="space-y-20">
      {/* Hero Section with Map/Globe Toggle - Much Larger and More Prominent */}
      <section className="relative min-h-screen flex items-center justify-center py-8">
        <div className="text-center space-y-12 max-w-7xl mx-auto px-4 w-full">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Hi, I'm <span className="gradient-text">Batıkan</span>
            </h1>
            <p className="text-xl md:text-3xl text-gray-600 dark:text-gray-400">
              Hacker • Developer • Entrepreneur •{" "}
              <span className="inline-flex min-w-[12ch] justify-start">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={HERO_MOTTOS[mottoIndex]}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="gradient-text"
                  >
                    {HERO_MOTTOS[mottoIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </p>
          </div>

          {/* Achievement visualization */}
          <div className="mt-16 w-full px-0 sm:px-4">
            <div className="relative">
              <div
                ref={viewMenuRef}
                className="absolute right-3 top-3 z-[2100] text-left sm:right-10 sm:top-6"
              >
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={viewMenuOpen}
                  onClick={() => setViewMenuOpen((open) => !open)}
                  className="group flex items-center gap-2 rounded-full border border-amber-400/35 bg-gray-950/85 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xl transition hover:border-amber-400/70 hover:bg-gray-950 sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  <FiMap className="text-amber-400" aria-hidden="true" />
                  <span>Alternative views</span>
                  <FiChevronDown
                    className={`text-amber-300 transition-transform ${
                      viewMenuOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence>
                  {viewMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      role="menu"
                      aria-label="Alternative achievement views"
                      className="absolute right-0 top-full mt-2 w-[min(290px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-gray-950/95 p-1.5 shadow-2xl backdrop-blur-2xl"
                    >
                      {ACHIEVEMENT_VIEWS.map((view) => {
                        const ViewIcon = view.icon;
                        const isActive = achievementView === view.id;

                        return (
                          <button
                            key={view.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={isActive}
                            onClick={() => {
                              setAchievementView(view.id);
                              setViewMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                              isActive
                                ? "border-amber-400/35 bg-amber-400/10"
                                : "border-transparent hover:bg-white/[0.07]"
                            }`}
                          >
                            <span
                              className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${
                                isActive
                                  ? "bg-gradient-to-br from-amber-400 to-orange-500 text-gray-950"
                                  : "bg-white/[0.07] text-gray-300"
                              }`}
                            >
                              <ViewIcon aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <strong className="text-xs text-white sm:text-sm">
                                  {view.shortLabel}
                                </strong>
                                {isActive && (
                                  <span className="font-mono text-[8px] uppercase tracking-[0.13em] text-amber-300">
                                    Current
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {achievementView === "globe" ? (
                <div className="glass rounded-3xl border border-gray-200 p-2 shadow-2xl backdrop-blur-xl dark:border-gray-800 sm:p-6">
                  <div
                    className="globe-container w-full py-4 sm:py-12"
                    style={{ minHeight: "800px" }}
                  >
                    <GlobeGame navigateWithRefresh={navigateWithRefresh} />
                  </div>
                </div>
              ) : (
                <AchievementMap
                  key={achievementView}
                  variant={achievementView}
                  navigateWithRefresh={navigateWithRefresh}
                />
              )}
            </div>
          </div>
        </div>

        <a
          href="#cv"
          onClick={scrollToCv}
          data-floating-cv-control
          className="fixed left-2 top-1/2 z-[2000] hidden -translate-y-1/2 rotate-180 items-center gap-2 rounded-full border border-gray-300/60 bg-white/55 px-2 py-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-500 shadow-sm backdrop-blur-md transition-colors hover:border-amber-500/60 hover:text-amber-700 dark:border-gray-700/70 dark:bg-gray-950/45 dark:text-gray-400 dark:hover:text-amber-400 sm:flex [writing-mode:vertical-rl]"
          aria-label="Scroll to view CV"
        >
          <span aria-hidden="true">↓</span>
          <span>
            Scroll to view <span className="gradient-text">CV</span>
          </span>
        </a>

        <a
          href="#cv"
          onClick={scrollToCv}
          data-floating-cv-control
          className="fixed left-2 top-1/2 z-[2000] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f59e0b_0%,#f97316_52%,#ef4444_100%)] text-xs font-black tracking-wide text-white shadow-lg ring-1 ring-white/60 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:ring-gray-950 sm:hidden"
          aria-label="Scroll to view CV"
        >
          CV
        </a>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-amber-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-yellow-200/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-orange-200/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Projects Section - Unified Title */}
      <section id="projects" className="py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            My <span className="gradient-text">Projects</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Here I share some of my competition wins, personal projects, and
            other achievements I find noteworthy. Life is short, so I want to
            adventure further. If you find another adventure for me, let me
            know!
          </p>
        </div>
        <Projects />
      </section>

      {/* CV Section */}
      <section id="cv" className="scroll-mt-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            My <span className="gradient-text">Experience</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Professional journey and academic achievements
          </p>
        </div>
        <CVContent />
      </section>

      {/* Export PDF Button removed: now available in Projects section */}
    </div>
  );
}
