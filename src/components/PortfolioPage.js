import { motion } from "framer-motion";
import { FiArrowLeft } from "react-icons/fi";

const PortfolioPage = ({ children, pageTitle = "Portfolio" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="portfolio-page pointer-events-auto w-full my-6 p-5 sm:p-8"
    >
      <header className="portfolio-page-header mb-8 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <a href="/" aria-label="Batıkanor">
            <div className="group inline-block cursor-pointer">
              <h1 className="portfolio-brand mb-2 text-2xl tracking-tight transition-colors sm:text-3xl md:text-4xl">
                <span className="gradient-text">Batıkan<span className="portfolio-wordmark-accent">or</span></span>
              </h1>
              <div className="portfolio-brand-rule h-0.5 w-16 transition-all duration-300 group-hover:w-full"></div>
            </div>
          </a>
          <a
            href="/"
            className="portfolio-return self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold transition-colors"
          >
            <FiArrowLeft className="w-3.5 h-3.5" />
            <span>Back to World Map</span>
          </a>
        </div>
        <p className="portfolio-page-label mt-4 text-xs font-semibold uppercase tracking-[0.16em] sm:text-sm">
          {pageTitle}
        </p>
      </header>

      {children}
    </motion.div>
  );
};

export default PortfolioPage;
