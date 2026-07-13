import ProjectsWorldClient from "./ProjectsWorldClient";

export const metadata = {
  title: "Explore Projects World | Batıkan Bora Ormancı",
  description:
    "Explore Batıkan’s projects across interactive Three.js worlds and geographic maps.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function ExploreProjectsWorldPage() {
  return <ProjectsWorldClient />;
}
