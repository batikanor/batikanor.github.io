import { motion } from "framer-motion";
import Link from "next/link";

const PortfolioPage = ({ children, pageTitle = "Portfolio" }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full py-8"
    >
      {/* Professional Title Header */}
      <header className="text-center mb-16 animate-fadeIn">
        <Link href="/">
          <div className="inline-block group cursor-pointer">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 group-hover:scale-105 transition-all duration-300 tracking-tight">
              <span className="gradient-text">Batıkan Bora Ormancı</span>
            </h1>
            <div className="h-0.5 w-0 group-hover:w-full mx-auto bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-300"></div>
          </div>
        </Link>
        <p className="text-xs sm:text-sm text-light-foreground-secondary dark:text-dark-foreground-secondary mt-4 italic opacity-70">
          {pageTitle}
        </p>
      </header>

      {/* Page Content */}
      {children}
    </motion.div>
  );
};

export default PortfolioPage;
