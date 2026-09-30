import CVClient from "./CVClient";

export const metadata = {
  title: "CV | Batıkan Bora Ormancı",
  description: "Professional experience, education and CV of Batıkan Bora Ormancı.",
  alternates: { canonical: "/cv/" },
  openGraph: { url: "/cv/", title: "CV | Batıkan Bora Ormancı" },
};

export default function CV() {
  return <CVClient />;
}
