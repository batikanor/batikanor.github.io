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
    const url = `${window.location.origin}/projects#${slug}`;
    window.location.href = url;
  };

  return (
    <div>
      <main className="flex flex-col items-center justify-center darker-background rounded-xl shadow-lg ">
        <header className="text-center">
          <br />
        </header>

        {/* Render the GlobeGame component */}
        <div className="w-full py-8">
          <GlobeGame navigateWithRefresh={navigateWithRefresh} />
        </div>

        {/* Rest of your components */}
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
