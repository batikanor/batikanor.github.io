"use client";

import ExportPdfButton from "../../../components/ExportPdfButton";
import PortfolioPage from "../../../components/PortfolioPage";

export default function ProjectsPdfAutoPage() {
  return (
    <PortfolioPage pageTitle="Projects – PDF Export">
      {/* Hidden button that triggers PDF generation on mount */}
      <ExportPdfButton autoStart={true} hideWhenAuto={true} />
      <p className="mt-4 text-sm text-gray-600">
        Your download should start automatically. If it doesn’t, please refresh
        the page or enable pop-ups.
      </p>
    </PortfolioPage>
  );
}
