"use client";

import { useEffect, useState } from "react";

const loadingStyle = {
  minHeight: "680px",
  display: "grid",
  placeItems: "center",
  borderRadius: "30px",
  background: "#090711",
  color: "rgba(255,255,255,.62)",
  fontFamily: "var(--font-geist-mono), monospace",
  letterSpacing: ".12em",
  fontSize: "12px",
};

export default function LabClient() {
  const [ProjectLab, setProjectLab] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    import("../../components/ProjectLab3D")
      .then((module) => {
        if (active) setProjectLab(() => module.default);
      })
      .catch((error) => {
        console.error("Unable to initialize the project lab", error);
        if (active) setLoadError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return <div style={loadingStyle}>PROJECT LAB COULD NOT START</div>;
  }

  if (!ProjectLab) {
    return <div style={loadingStyle}>INITIALIZING PROJECT LAB…</div>;
  }

  return <ProjectLab />;
}
