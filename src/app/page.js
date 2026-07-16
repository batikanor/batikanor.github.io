/* eslint-disable react/no-unescaped-entities */

"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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
    <div className="flex items-center justify-center h-[800px] bg-gray-900/50 rounded-2xl">
      <div className="text-gray-400">Loading globe...</div>
    </div>
  ),
});

const HERO_MOTTOS = ["Someone", "a Friend"];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [mottoIndex, setMottoIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMottoIndex((currentIndex) => (currentIndex + 1) % HERO_MOTTOS.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, []);

  const navigateWithRefresh = (slug) => {
    const url = `${window.location.origin}/projects#${slug}`;
    window.location.href = url;
  };

  const toggle3D = () => {
    setShow3D(!show3D);
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

          {/* Map/Globe Container - Much Larger and More Prominent */}
          <div className="mt-16 w-full px-0 sm:px-4">
            {show3D ? (
              <div className="relative">
                <div className="glass rounded-3xl p-2 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl">
                  <div
                    className="w-full py-4 sm:py-12 globe-container"
                    style={{ minHeight: "800px" }}
                  >
                    <GlobeGame navigateWithRefresh={navigateWithRefresh} />
                  </div>
                </div>

                {/* Switch back to 2D button */}
                <div className="absolute top-6 left-6 z-10">
                  <button
                    onClick={toggle3D}
                    className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-full font-medium transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <span className="text-sm sm:text-base font-semibold">
                      ← Back to 2D Map
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <AchievementMap
                navigateWithRefresh={navigateWithRefresh}
                onToggle3D={toggle3D}
              />
            )}
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
