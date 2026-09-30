import ProjectsClient from "./ProjectsClient";

export const metadata = {
  title: "Projects & Achievements | Batıkan Bora Ormancı",
  description: "Projects, competition results and other achievements by Batıkan Bora Ormancı.",
  alternates: { canonical: "/projects/" },
  openGraph: { url: "/projects/", title: "Projects & Achievements | Batıkan Bora Ormancı" },
};

export default function ProjectsPage() {
  return <ProjectsClient />;
}
