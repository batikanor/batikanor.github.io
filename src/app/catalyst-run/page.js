import CatalystRunClient from "./CatalystRunClient";

export const metadata = {
  title: "Catalyst Run | Batıkan Bora Ormancı",
  description: "A neon Three.js cat platform game with signal courses and playable quiz maps.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function CatalystRunPage() {
  return <CatalystRunClient />;
}
