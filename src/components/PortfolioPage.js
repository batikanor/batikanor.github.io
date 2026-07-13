import { motion } from "framer-motion";
import Link from "next/link";

const PortfolioPage = ({ children, pageTitle = "Portfolio" }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full py-6"
    >
      <header className="mb-10 border-b border-light-border/80 pb-6 dark:border-dark-border animate-fadeIn">
        <Link href="/">
          <div className="group inline-block cursor-pointer">
            <h1 className="mb-2 text-2xl font-black tracking-tight transition-colors sm:text-3xl md:text-4xl">
              <span className="gradient-text">Batıkan Bora Ormancı</span>
            </h1>
            <div className="h-0.5 w-16 bg-accent transition-all duration-300 group-hover:w-full"></div>
          </div>
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-light-foreground-secondary dark:text-dark-foreground-secondary sm:text-sm">
          {pageTitle}
        </p>
      </header>

      {children}
    </motion.div>
  );
};

export default PortfolioPage;
