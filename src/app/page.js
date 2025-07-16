/* eslint-disable react/no-unescaped-entities */

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { FaCode, FaRocket, FaTrophy } from "react-icons/fa";
import CVContent from "../components/CVContent";
import ExportPdfButton from "../components/ExportPdfButton";
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

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [show3D, setShow3D] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navigateWithRefresh = (slug) => {
    const url = `${window.location.origin}/projects#${slug}`;
    window.location.href = url;
  };

  const toggle3D = () => {
    setShow3D(!show3D);
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
              <span className="gradient-text">Friend</span>
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

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-6 justify-center mt-12">
            <a href="#projects" className="btn text-lg px-8 py-4">
              Explore My Projects
            </a>
            <a href="/cv" className="btn-secondary text-lg px-8 py-4">
              View CV
            </a>
          </div>
        </div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-amber-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-yellow-200/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-orange-200/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 animate-slideIn">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="card text-center hover-lift">
            <FaTrophy className="text-4xl text-yellow-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">10+</h3>
            <p className="text-gray-600 dark:text-gray-400">Competition wins</p>
          </div>
          <div className="card text-center hover-lift">
            <FaCode className="text-4xl text-amber-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Many</h3>
            <p className="text-gray-600 dark:text-gray-400">Projects built</p>
          </div>
          <div className="card text-center hover-lift">
            <FaRocket className="text-4xl text-orange-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">100+</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Teammates befriended for life.
            </p>
          </div>
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
      <section className="py-12">
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

      {/* Export PDF Button Section */}
      <section className="py-12 text-center">
        <ExportPdfButton />
      </section>

      {/* Legacy Link */}
      <section className="text-center py-12">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Looking for my old homepage? Find it{" "}
          <a
            href="http://batikanor.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 underline"
          >
            here
          </a>
        </p>
      </section>
    </div>
  );
}
