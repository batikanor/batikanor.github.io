"use client";

import dynamic from "next/dynamic";

const SuiPageContent = dynamic(
  () => import("../../components/SuiPageContent"),
  { ssr: false }
);

export default function SuiPage() {
  return <SuiPageContent />;
}
