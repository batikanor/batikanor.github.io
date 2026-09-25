"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const TopoMap = dynamic(() => import("./TopoMap"), {
  ssr: false,
});

export default function SiteBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 w-screen h-screen z-0 overflow-hidden pointer-events-auto select-none"
    >
      <TopoMap isSiteBackground={true} />
    </div>
  );
}
