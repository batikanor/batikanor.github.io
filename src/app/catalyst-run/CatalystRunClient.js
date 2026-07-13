"use client";

import { useEffect, useState } from "react";

const loadingStyle = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "#050608",
  color: "rgba(255,255,255,.68)",
  fontFamily: "var(--font-geist-mono), monospace",
  fontSize: "11px",
  letterSpacing: ".18em",
};

export default function CatalystRunClient() {
  const [Game, setGame] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    import("../../components/bounce/BounceWorld")
      .then((module) => {
        if (mounted) setGame(() => module.default);
      })
      .catch((error) => {
        console.error("Unable to initialize Catalyst Run", error);
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (failed) return <div style={loadingStyle}>CATALYST RUN COULD NOT START</div>;
  if (!Game) return <div style={loadingStyle}>ASSEMBLING THE COURSE…</div>;
  return <Game />;
}
