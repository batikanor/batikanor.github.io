/* eslint-disable react/no-unescaped-entities */

"use client";

import { useEffect, useState } from "react";
import CVContent from "../components/CVContent";
import Projects from "../components/Projects";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navigateWithRefresh = (slug) => {
    const projEl = document.getElementById(slug);
    if (projEl) {
      window.history.pushState(null, "", `#${slug}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      const top = projEl.getBoundingClientRect().top + window.scrollY - 30;
      window.scrollTo({ top, behavior: "smooth" });
    } else {
      window.location.href = `/projects#${slug}`;
    }
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
    <div className="space-y-12">
      {/* Hero Section - Floats directly over the interactive full-screen topographic map */}
      <section className="relative min-h-[92vh] flex flex-col justify-between py-6 sm:py-10 pointer-events-none">
        {/* Top bar with Batıkan in top-left */}
        <div className="w-full flex items-start justify-between px-2 sm:px-6 pt-2">
          {/* Top Left: Batıkan */}
          <div className="pointer-events-auto flex flex-col">
            <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[-0.05em] leading-none select-none">
              <span className="hero-name inline-block">Batıkan</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-[#e2d5c5]/90 font-bold tracking-[0.22em] uppercase mt-3">
              Hacker • Developer • Entrepreneur
            </p>
          </div>
        </div>

        {/* Bottom Hero Navigation Anchor - Projects & CV side-by-side */}
        <div className="w-full flex flex-wrap items-center justify-center gap-3 sm:gap-4 pb-2 px-4 pointer-events-auto">
          <a
            href="#projects"
            className="group flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#160f0a]/90 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-amber-100 hover:text-white shadow-xl backdrop-blur-xl transition hover:border-amber-400 hover:bg-[#24170f]"
          >
            <span>Explore Projects & Achievements</span>
            <span className="text-amber-400 group-hover:translate-y-0.5 transition-transform">
              ↓
            </span>
          </a>

          <a
            href="#cv"
            onClick={scrollToCv}
            className="group flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#160f0a]/90 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-amber-100 hover:text-white shadow-xl backdrop-blur-xl transition hover:border-amber-400 hover:bg-[#24170f]"
            aria-label="Scroll to view CV"
          >
            <span>
              Scroll to view <span className="gradient-text font-bold">CV</span>
            </span>
            <span className="text-amber-400 group-hover:translate-y-0.5 transition-transform">
              ↓
            </span>
          </a>
        </div>
      </section>

      {/* Projects Section - Opens cleanly on top of the world map */}
      <section
        id="projects"
        className="pointer-events-auto scroll-mt-6 my-16 rounded-3xl border border-amber-500/20 bg-[#120c08]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl transition-all"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-white">
            My <span className="gradient-text">Projects</span>
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Here I share some of my competition wins, personal projects, and
            other achievements I find noteworthy. Life is short, so I want to
            adventure further. If you find another adventure for me, let me
            know!
          </p>
        </div>
        <Projects />
      </section>

      {/* CV Section - Opens cleanly on top of the world map */}
      <section
        id="cv"
        className="pointer-events-auto scroll-mt-6 my-16 rounded-3xl border border-amber-500/20 bg-[#120c08]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl transition-all"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-white">
            My <span className="gradient-text">Experience</span>
          </h2>
          <p className="text-gray-300 text-sm sm:text-base">
            Professional journey and academic achievements
          </p>
        </div>
        <CVContent />
      </section>
    </div>
  );
}
