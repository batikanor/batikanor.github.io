"use client";

import { useEffect } from "react";
import { CV_CONFIG } from "./config";

// Legacy Next client-navigation payloads must leave the retired site shell too.
// Direct public /cv URLs are rendered by the new Earth CV export.
export default function CVClient() {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.searchParams.set("view", "cv");
    window.location.replace(url.href);
  }, []);

  return (
    <section className="rounded border border-[#d9bb8d] bg-[#112227] p-8 text-[#f5f3eb]">
      <h1>CV | Batıkan Bora Ormancı</h1>
      <p>Opening the current CV…</p>
      <a href="/?view=cv">View CV in the new site</a>{" · "}
      <a href={CV_CONFIG.pdfDownloadUrl}>Download the latest CV PDF</a>
    </section>
  );
}
