/* eslint-disable react/no-unescaped-entities */

"use client";

import React from "react";
import dynamic from "next/dynamic";
import Projects from "../components/Projects"; // Adjust path based on your folder structure
import CV from "./cv/page";

// Dynamically import the GlobeGame component without server-side rendering
const GlobeGame = dynamic(() => import("../components/GlobeGame"), { ssr: false });

export default function Home() {
  const navigateWithRefresh = (slug) => {
    const url = `${window.location.origin}${window.location.pathname}#${slug}`;
    window.location.href = url;
    window.location.reload(); // Forces a page refresh
  };

  return (
    <div>
      <main className="flex flex-col items-center justify-center darker-background rounded-xl shadow-lg ">
        {/* Header and Menu */}
        <header className="text-center">
          <br />
          {/* <h1 className="flex items-center justify-center space-x-2 text-3xl font-bold">
            <span>🌍</span>
            <span>Achievements Map</span>
          </h1> */}
        </header>

        {/* Render the GlobeGame component */}
        <div className="w-full py-8">
          <GlobeGame navigateWithRefresh={navigateWithRefresh} />
        </div>

        {/* Divider */}
        <hr className="w-full border-t border-gray-300 dark:border-gray-700 my-8" />

        {/* Description Content */}
        <p className="text-center max-w-lg text-base sm:text-lg leading-relaxed">
          The fourth letter of my name &apos;ı&apos; (i without a dot) is pronounced the way &apos;e&apos; is pronounced while saying &apos;folder&apos;.
        </p>
        <hr className="w-full border-t border-gray-300 dark:border-gray-700 my-8" />

        <Projects />
        <hr className="w-full border-t border-gray-300 dark:border-gray-700 my-8" />

        <CV />

        <br />
        <br />
        <br />
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
          Are you looking for my old homepage? You can find it{" "}
          <a
            href="http://batikanor.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 dark:text-blue-400 hover:underline"
          >
            here
          </a>.
        </p>
        <br />
        <br />
        <br />
      </main>
    </div>
  );
}
