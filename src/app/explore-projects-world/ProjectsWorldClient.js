"use client";

import { useEffect, useState } from "react";

const loadingStyle = {
  minHeight: "100svh",
  display: "grid",
  placeItems: "center",
  background: "#27304d",
  color: "rgba(255,255,255,.72)",
  fontFamily: "var(--font-geist-mono), monospace",
  letterSpacing: ".16em",
  fontSize: "11px",
};

export default function ProjectsWorldClient() {
  const [Experience, setExperience] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    import("../../components/projects-world/ExploreProjectsWorld")
      .then((module) => {
        if (mounted) setExperience(() => module.default);
      })
      .catch((error) => {
        console.error("Unable to initialize Explore Projects World", error);
        if (mounted) setFailed(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (failed) return <div style={loadingStyle}>PROJECT WORLD GENERATION FAILED</div>;
  if (!Experience) return <div style={loadingStyle}>GROWING THE LANDSCAPE…</div>;

  return <Experience />;
}
