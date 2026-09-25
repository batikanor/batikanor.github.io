import { motion } from "framer-motion";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

const PortfolioPage = ({ children, pageTitle = "Portfolio" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="pointer-events-auto w-full my-6 rounded-3xl border border-amber-500/20 bg-[#120c08]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl text-white"
    >
      <header className="mb-10 border-b border-amber-950/40 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link href="/">
            <div className="group inline-block cursor-pointer">
              <h1 className="mb-2 text-2xl font-black tracking-tight transition-colors sm:text-3xl md:text-4xl text-white">
                <span className="gradient-text">Batıkan Bora Ormancı</span>
              </h1>
              <div className="h-0.5 w-16 bg-amber-400 transition-all duration-300 group-hover:w-full"></div>
            </div>
          </Link>
          <Link
            href="/"
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition shadow-sm"
          >
            <FiArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Back to World Map</span>
          </Link>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90 sm:text-sm">
          {pageTitle}
        </p>
      </header>

      {children}
    </motion.div>
  );
};

export default PortfolioPage;
