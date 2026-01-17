import { useEffect, useState } from "react";
import { FaGlobe } from "react-icons/fa";
import VanillaTilt from "vanilla-tilt";
import { contestsAndActivities } from "../data/contestsAndActivities";
import ExportPdfButton from "./ExportPdfButton";
import "./Projects.css";

// import ResizePanel from "react-resize-panel";
const ResizePanel =
  typeof window !== "undefined" ? require("react-resize-panel").default : null;

// Function to convert Google Drive link to embeddable format for videos and documents
const getGoogleDriveEmbedUrl = (url) => {
  const fileIdMatch = url.match(/[-\w]{25,}/);
  return fileIdMatch
    ? `https://drive.google.com/file/d/${fileIdMatch[0]}/preview`
    : url;
};

// Function to convert Google Drive link to embeddable image format
const getGoogleDriveImageEmbedUrl = (url) => {
  const fileIdMatch = url.match(/[-\w]{25,}/);
  return fileIdMatch
    ? `https://drive.google.com/uc?export=view&id=${fileIdMatch[0]}`
    : url;
};

// Replace getDeterministicColor with getImportanceStyles
const getImportanceStyles = (importance) => {
  // Define different style configurations based on importance ranges
  if (importance >= 8) {
    return {
      borderStyle: "border-l-4 border-t-4",
      borderColor: "border-accent-hover",
      bgGradient: "bg-gradient-to-r from-accent-hover/10 to-transparent",
    };
  } else if (importance >= 5) {
    return {
      borderStyle: "border-l-4",
      borderColor: "border-accent",
      bgGradient: "bg-gradient-to-r from-accent/10 to-transparent",
    };
  } else if (importance >= 2) {
    return {
      borderStyle: "border-l-2",
      borderColor: "border-accent",
      bgGradient: "bg-gradient-to-r from-accent/5 to-transparent",
    };
  } else {
    return {
      borderStyle: "border-l",
      borderColor: "border-light-border dark:border-dark-border",
      bgGradient: "bg-gradient-to-r from-light-border/10 to-transparent",
    };
  }
};

// Update the iframe component with preset size options and better controls
const ResizableEmbed = ({
  url,
  initialHeight = 300,
  initialSize = "medium",
  desktopEmbedAlign = "center",
}) => {
  const [height, setHeight] = useState(initialHeight);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const presetSizes = {
    small: isMobile ? 150 : 200,
    medium: isMobile ? 250 : 300,
    large: isMobile ? 350 : 500,
    full: isMobile ? 450 : 850,
  };

  const handleSizeChange = (size) => {
    setHeight(presetSizes[size]);
    setIsExpanded(size === "full");
  };

  const toggleExpand = () => {
    if (isExpanded) {
      setHeight(presetSizes.medium);
      setIsExpanded(false);
    } else {
      setHeight(presetSizes.full);
      setIsExpanded(true);
    }
  };

  return (
    <div className="relative mb-4 w-full max-w-full overflow-hidden embed-container">
      <iframe
        src={getGoogleDriveEmbedUrl(url)}
        className="w-full border-0 rounded-lg transition-height duration-300 ease-in-out"
        style={{ height: `${height}px` }}
        allowFullScreen
      />
      <div className="embed-controls">
        <div className="size-controls bg-light-background-secondary dark:bg-dark-background-secondary px-2 py-1 rounded-lg shadow-md flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => handleSizeChange("small")}
              className={`size-btn ${
                height === presetSizes.small ? "active" : ""
              }`}
              title="Small size"
            >
              S
            </button>
            <button
              onClick={() => handleSizeChange("medium")}
              className={`size-btn ${
                height === presetSizes.medium ? "active" : ""
              }`}
              title="Medium size"
            >
              M
            </button>
            <button
              onClick={() => handleSizeChange("large")}
              className={`size-btn ${
                height === presetSizes.large ? "active" : ""
              }`}
              title="Large size"
            >
              L
            </button>
            <button
              onClick={() => handleSizeChange("full")}
              className={`size-btn ${
                height === presetSizes.full ? "active" : ""
              }`}
              title="Full size"
            >
              XL
            </button>
          </div>
          <button
            onClick={toggleExpand}
            className="expand-btn ml-2"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? "↓" : "↑"}
          </button>
        </div>
      </div>
    </div>
  );
};

// GitHub Stats Component
const GitHubStats = ({ repo }) => {
  const [stats, setStats] = useState({ stars: null, watchers: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repo) return;

    const fetchStats = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}`);
        if (response.ok) {
          const data = await response.json();
          setStats({
            stars: data.stargazers_count,
            watchers: data.subscribers_count, // subscribers_count is the correct field for watchers
          });
        }
      } catch (error) {
        console.error("Failed to fetch GitHub stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [repo]);

  const buttonClass =
    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 bg-[#f6f8fa] dark:bg-[#21262d] text-[#24292f] dark:text-[#c9d1d9] border border-[#d0d7de] dark:border-[#30363d] hover:bg-[#f3f4f6] dark:hover:bg-[#30363d]";

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <a
        href={`https://github.com/${repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label="Star on GitHub"
      >
        <svg
          height="16"
          width="16"
          viewBox="0 0 16 16"
          className="fill-current text-yellow-500"
        >
          <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.719-4.192-3.046-2.97a.75.75 0 01.416-1.28l4.21-.612L7.327.668A.75.75 0 018 .25z"></path>
        </svg>
        <span>Star</span>
        {stats.stars !== null && (
          <>
            <span className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></span>
            <span className="font-bold">{stats.stars}</span>
          </>
        )}
      </a>

      <a
        href={`https://github.com/${repo}/watchers`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label="Watch on GitHub"
      >
        <svg
          height="16"
          width="16"
          viewBox="0 0 16 16"
          className={`fill-current ${
            stats.watchers !== null
              ? "text-blue-500"
              : "text-[#57606a] dark:text-[#8b949e]"
          }`}
        >
          <path d="M6 9a.75.75 0 100-1.5.75.75 0 000 1.5zM8 9a.75.75 0 100-1.5.75.75 0 000 1.5zM10 9a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
          <path
            fillRule="evenodd"
            d="M8 1a7 7 0 100 14A7 7 0 008 1zM2.5 8a5.5 5.5 0 1111 0 5.5 5.5 0 01-11 0z"
          ></path>
        </svg>
        <span>Watch</span>
        {stats.watchers !== null && (
          <>
            <span className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></span>
            <span className="font-bold">{stats.watchers}</span>
          </>
        )}
      </a>
    </div>
  );
};

const Projects = () => {
  const [expandedActivity, setExpandedActivity] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Function to handle scrolling to a project
  const scrollToProject = (slug) => {
    const foundActivity = contestsAndActivities.find(
      (activity) => activity.slug === slug,
    );
    if (foundActivity) {
      setExpandedActivity(foundActivity);

      // Wait for state update and content expansion
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const element = document.getElementById(foundActivity.slug);
          if (element) {
            const offset = element.offsetTop - 20; // No navbar height needed anymore
            window.scrollTo({
              top: offset,
              behavior: "smooth",
            });
          }
        });
      });
    }
  };

  // Handle initial load from URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const slug = hash.replace("#", "");
      scrollToProject(slug);
    }
  }, []);

  // Handle project expansion toggle
  const toggleExpandedView = (activity) => {
    const newExpandedActivity = activity === expandedActivity ? null : activity;
    setExpandedActivity(newExpandedActivity);

    if (newExpandedActivity) {
      scrollToProject(activity.slug);
    }
  };

  const handleCopyLink = (slug) => {
    const url = `${window.location.origin}/projects#${slug}`;
    // const url = `${window.location.origin}${window.location.pathname}#${slug}`;

    try {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          alert("Link copied to clipboard!");
        })
        .catch((err) => {
          console.error("Failed to copy the link:", err);
          alert("Unable to copy link. Please try again.");
        });
    } catch (err) {
      console.error("Clipboard API error:", err);
      alert(
        "Clipboard operation failed. Please make sure the document is focused.",
      );
    }
  };

  const handleLocationClick = (activity) => {
    const url = `${window.location.origin}/?lat=${activity.mapData.coordinates.lat}&lng=${activity.mapData.coordinates.lng}`;
    window.location.href = url;
  };

  const LocationDisplay = ({ activity, onClick }) => {
    return (
      <div className="group relative inline-block">
        <p
          className="flex items-center gap-1 text-light-foreground-secondary dark:text-dark-foreground-secondary cursor-pointer hover:text-accent-hover text-xs sm:text-sm truncate"
          onClick={onClick}
        >
          <FaGlobe className="text-accent flex-shrink-0" />
          <span className="truncate">
            {activity.mapData.venue}, {activity.mapData.city}/
            {activity.mapData.country}
          </span>

          {/* Tooltip - Made wider and more responsive */}
          <span className="invisible group-hover:visible absolute left-0 top-full mt-2 w-56 sm:w-64 p-3 bg-dark-background text-dark-foreground text-sm rounded-lg shadow-lg z-10 whitespace-normal leading-relaxed">
            Click to view location on the map
          </span>
        </p>
      </div>
    );
  };

  // Add this useEffect for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Add this useEffect for tilt effect
  useEffect(() => {
    // Initialize tilt effect on all project cards
    const tiltElements = document.querySelectorAll(".tilt-card");
    if (!isMobile) {
      tiltElements.forEach((element) => {
        VanillaTilt.init(element, {
          max: 1.5, // Reduced from 3 to 1.5
          scale: 1.01, // Reduced from 1.02 to 1.01
          speed: 1000, // Increased from 800 to 1000 for smoother movement
          glare: true,
          "max-glare": 0.05, // Reduced from 0.1 to 0.05
          perspective: 1500, // Increased from 1000 to 1500 for subtler effect
        });
      });
    }
  }, [isMobile, expandedActivity]); // Re-run when cards expand/collapse

  // Function to render text with markdown formatting (Bold, Italic, Links)
  const renderMarkdown = (text) => {
    if (!text || typeof text !== "string") return text;

    // Helper to process text recursively
    const processText = (currentText) => {
      // Find the first occurrence of any formatting syntax
      const matchBold = /\*\*(.+?)\*\*/.exec(currentText);
      const matchItalic = /\*(.+?)\*/.exec(currentText);
      const matchLink = /\[([^\]]+)\]\(([^)]+)\)/.exec(currentText);

      // determine which match is first
      let bestMatch = null;
      let type = null;

      const candidates = [
        { match: matchBold, type: "bold" },
        { match: matchItalic, type: "italic" },
        { match: matchLink, type: "link" },
      ].filter((c) => c.match);

      if (candidates.length === 0) return [currentText];

      // Sort by index
      candidates.sort((a, b) => a.match.index - b.match.index);
      bestMatch = candidates[0].match;
      type = candidates[0].type;

      const before = currentText.slice(0, bestMatch.index);
      const after = currentText.slice(bestMatch.index + bestMatch[0].length);
      const content = bestMatch[1]; // for bold/italic/link text
      const url = bestMatch[2]; // for link url

      const components = [];
      if (before) components.push(...processText(before));

      if (type === "bold") {
        components.push(
          <strong
            key={`b-${bestMatch.index}`}
            className="font-bold text-light-foreground dark:text-dark-foreground"
          >
            {processText(content)}
          </strong>,
        );
      } else if (type === "italic") {
        components.push(
          <em key={`i-${bestMatch.index}`} className="italic">
            {processText(content)}
          </em>,
        );
      } else if (type === "link") {
        components.push(
          <a
            key={`l-${bestMatch.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hover hover:underline transition-colors"
          >
            {content}
          </a>,
        );
      }

      if (after) components.push(...processText(after));

      return components;
    };

    return processText(text);
  };

  // Function to parse and render content with inline images/embeds
  const renderContentWithInlineMedia = (content, activity) => {
    if (!content) return null;

    // Split content by inline media placeholders
    const parts = content.split(
      /(\{\{(?:image|embed|gdrive_embed)\[\d+\]\}\})/g,
    );

    return parts
      .filter((part) => part)
      .map((part, index) => {
        // Check if this part is an inline media placeholder
        const imageMatch = part.match(/\{\{image\[(\d+)\]\}\}/);
        const embedMatch = part.match(
          /\{\{(?:embed|gdrive_embed)\[(\d+)\]\}\}/,
        );

        if (imageMatch) {
          const imageIndex = parseInt(imageMatch[1], 10);
          if (activity.images && activity.images[imageIndex]) {
            return (
              <div key={index} className="my-6 flex justify-center">
                <img
                  src={getGoogleDriveImageEmbedUrl(activity.images[imageIndex])}
                  alt={`Inline image ${imageIndex + 1}`}
                  className="max-w-full rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300"
                  style={{ maxHeight: "500px", objectFit: "contain" }}
                />
              </div>
            );
          }
        } else if (embedMatch) {
          const embedIndex = parseInt(embedMatch[1], 10);
          const embedData = activity.gdrive_embed?.[embedIndex];

          if (embedData) {
            const isNewFormat =
              typeof embedData === "object" && embedData !== null;
            const url = isNewFormat ? embedData.url : embedData;
            const abovePhotoCaption = isNewFormat
              ? embedData.abovePhotoCaption
              : null;
            const credit = isNewFormat ? embedData.credit : null;
            const desktopSize = isNewFormat ? embedData.desktopSize : "M";
            const mobileSize = isNewFormat ? embedData.mobileSize : "M";
            const desktopEmbedAlign = isNewFormat
              ? embedData.desktopEmbedAlign
              : "center";

            let initialSize, initialHeight;

            const size = window.innerWidth <= 768 ? mobileSize : desktopSize;

            switch (size) {
              case "S":
                initialSize = "small";
                initialHeight = 200;
                break;
              case "L":
                initialSize = "large";
                initialHeight = 500;
                break;
              case "XL":
                initialSize = "full";
                initialHeight = 850;
                break;
              case "M":
              default:
                initialSize = "medium";
                initialHeight = 300;
            }

            // Determine container classes based on alignment (only affects desktop)
            const isMobile = window.innerWidth <= 768;
            let containerClasses = "my-4";
            let embedWrapperClasses = "";

            if (isMobile || desktopEmbedAlign === "center") {
              // Mobile or center alignment: full width, centered
              containerClasses += " text-center";
              embedWrapperClasses = "w-full";
            } else if (desktopEmbedAlign === "left") {
              // Desktop left alignment: float left, text wraps around
              containerClasses +=
                " md:float-left md:mr-6 md:mb-4 md:clear-left";
              embedWrapperClasses = "w-full md:w-96"; // Full width on mobile, fixed width on desktop
            } else if (desktopEmbedAlign === "right") {
              // Desktop right alignment: float right, text wraps around
              containerClasses +=
                " md:float-right md:ml-6 md:mb-4 md:clear-right";
              embedWrapperClasses = "w-full md:w-96"; // Full width on mobile, fixed width on desktop
            }

            return (
              <div key={index} className={containerClasses}>
                {abovePhotoCaption && (
                  <p className="mb-2 text-base text-light-foreground dark:text-dark-foreground text-center">
                    {abovePhotoCaption}
                  </p>
                )}
                <div className={embedWrapperClasses}>
                  <ResizableEmbed
                    url={url}
                    initialSize={initialSize}
                    initialHeight={initialHeight}
                    desktopEmbedAlign={desktopEmbedAlign}
                  />
                </div>
                {credit && (
                  <p className="mt-1 text-xs text-light-foreground-secondary dark:text-dark-foreground-secondary text-center">
                    {credit}
                  </p>
                )}
              </div>
            );
          }
        } else {
          // Regular text content - split by newlines and render paragraphs
          return part.split("\n").map((line, lineIndex) => {
            if (line.trim()) {
              return (
                <p
                  key={`${index}-${lineIndex}`}
                  className="text-light-foreground dark:text-dark-foreground mb-4 leading-relaxed"
                >
                  {renderMarkdown(line)}
                </p>
              );
            }
            return null;
          });
        }
        return null;
      });
  };

  // Calculate category counts
  const categoryCounts = {
    Jury: 0,
    Mentor: 0,
    Hacker: 0,
    Project: 0,
  };

  contestsAndActivities.forEach((activity) => {
    if (activity.categories) {
      activity.categories.forEach((category) => {
        if (categoryCounts.hasOwnProperty(category)) {
          categoryCounts[category]++;
        }
      });
    }
  });

  // Toggle filter selection
  const toggleCategory = (category) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategories([]);
  };

  // Filter projects based on selected categories
  const filteredActivities =
    selectedCategories.length === 0
      ? contestsAndActivities
      : contestsAndActivities.filter((activity) =>
          activity.categories?.some((cat) => selectedCategories.includes(cat)),
        );

  return (
    <div className="w-full">
      {/* PDF Download Button */}
      <div className="my-8 flex justify-center">
        <ExportPdfButton achievements={contestsAndActivities} />
      </div>

      {/* Filter Buttons */}
      <div className="mb-8 flex flex-wrap gap-3 justify-center">
        <button
          onClick={clearFilters}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            selectedCategories.length === 0
              ? "bg-gradient-to-r from-accent to-accent-hover text-text-on-accent shadow-lg"
              : "bg-light-background-secondary dark:bg-dark-background-secondary text-light-foreground dark:text-dark-foreground hover:bg-accent/20 dark:hover:bg-accent/20"
          }`}
        >
          All ({contestsAndActivities.length})
        </button>
        {Object.keys(categoryCounts).map((category) => (
          <button
            key={category}
            onClick={() => toggleCategory(category)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              selectedCategories.includes(category)
                ? "bg-gradient-to-r from-accent to-accent-hover text-text-on-accent shadow-lg"
                : "bg-light-background-secondary dark:bg-dark-background-secondary text-light-foreground dark:text-dark-foreground hover:bg-accent/20 dark:hover:bg-accent/20"
            }`}
          >
            {category} ({categoryCounts[category]})
          </button>
        ))}
      </div>

      {/* Activities Grid - Using more width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        {filteredActivities.map((activity, index) => {
          const isExpanded = expandedActivity === activity;
          const isMicro = activity.importance < 2;
          const isMinor = activity.importance >= 2 && activity.importance < 5;

          return (
            <div
              id={activity.slug}
              key={activity.slug}
              className={`${
                isExpanded
                  ? "col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4"
                  : isMicro
                    ? "col-span-1"
                    : isMinor
                      ? "col-span-1 sm:col-span-1"
                      : "col-span-1 sm:col-span-2 lg:col-span-2"
              } transition-all duration-300 ${
                isMinor && !isExpanded ? "minor-project-card" : ""
              }`}
            >
              <div
                className={`tilt-card relative p-4 sm:p-6 rounded-2xl shadow-xl backdrop-blur-lg overflow-hidden hover:shadow-2xl transition-all duration-300 ${
                  activity.highlighted && !isExpanded ? "highlight" : ""
                } ${isExpanded ? "expanded" : ""} ${
                  activity.highlighted && !isExpanded
                    ? "ring-2 ring-accent"
                    : ""
                } ${
                  !isExpanded
                    ? `${
                        getImportanceStyles(activity.importance).borderStyle
                      } ${getImportanceStyles(activity.importance).borderColor}`
                    : "border-0"
                }`}
                style={{
                  transformStyle: "preserve-3d",
                  ...(isExpanded && {
                    border: "none !important",
                    borderLeft: "none !important",
                    borderTop: "none !important",
                    borderRight: "none !important",
                    borderBottom: "none !important",
                    boxShadow:
                      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                  }),
                }}
              >
                {/* Replace the colored bar with a subtle gradient background - only when not expanded */}
                {!isExpanded && (
                  <div
                    className={`absolute inset-0 ${
                      getImportanceStyles(activity.importance).bgGradient
                    } pointer-events-none rounded-lg`}
                  />
                )}

                {/* Remove the old colored bar div and continue with existing content */}
                <div className="relative z-20">
                  <div className="flex justify-between items-start flex-wrap">
                    <h3
                      className={`${
                        isMicro
                          ? "text-xs sm:text-sm"
                          : isMinor
                            ? "text-sm sm:text-base"
                            : "text-base sm:text-lg"
                      } font-semibold mb-2 max-w-[70%]`}
                    >
                      {activity.title}
                    </h3>
                    <div className="flex flex-col items-end gap-2 ml-auto">
                      {!isExpanded && (isMicro || isMinor) && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                            isMicro
                              ? "bg-light-background-secondary text-light-foreground-secondary dark:bg-dark-background-secondary dark:text-dark-foreground-secondary"
                              : "bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-hover"
                          }`}
                        >
                          {isMicro ? "MICRO" : "MINOR"}
                        </span>
                      )}
                      <button
                        onClick={() => toggleExpandedView(activity)}
                        className="px-3 py-1 rounded hover:bg-light-background-secondary dark:hover:bg-dark-background-secondary whitespace-nowrap"
                      >
                        {isExpanded ? "Collapse" : "See more"}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden">
                    {!isMinor && (
                      <LocationDisplay
                        activity={activity}
                        onClick={() => handleLocationClick(activity)}
                      />
                    )}

                    <p className="mb-4 text-light-foreground-secondary dark:text-dark-foreground-secondary truncate">
                      {activity.date}
                    </p>

                    {/* Display Short Description - hide for minor projects when not expanded */}
                    {(!isMinor || isExpanded) && (
                      <div
                        className={`mb-3 p-2 bg-light-background-secondary/50 dark:bg-dark-background-secondary/50 rounded-lg ${
                          !isExpanded
                            ? "border-l-4 border-accent dark:border-accent"
                            : ""
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <span className="text-xs uppercase tracking-wider text-accent dark:text-accent font-semibold">
                            Summary
                          </span>
                        </div>
                        <p
                          className={`text-xs sm:text-sm text-light-foreground-secondary dark:text-dark-foreground-secondary italic ${
                            !isExpanded ? "line-clamp-2 sm:line-clamp-1" : ""
                          }`}
                        >
                          {activity.shortDescription}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Display Long Description if Expanded */}
                  {isExpanded && (
                    <div className="mt-4 overflow-hidden">
                      {/* Render content with inline media */}
                      <div className="prose prose-lg dark:prose-invert max-w-none">
                        {renderContentWithInlineMedia(
                          activity.longDescription,
                          activity,
                        )}
                      </div>

                      <div className="mt-4">
                        <button
                          onClick={() => handleCopyLink(activity.slug)}
                          className="bg-gradient-to-r from-accent to-accent-hover text-text-on-accent px-3 py-1 rounded hover:from-accent-hover hover:to-accent mb-4 transition-all duration-200"
                        >
                          Copy Link to this Project
                        </button>
                      </div>

                      {/* GitHub Repository Widget */}
                      {activity.githubRepo && (
                        <div className="mb-6 p-4 rounded-xl bg-light-background-secondary dark:bg-dark-background-secondary border border-light-border dark:border-dark-border">
                          <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                            <svg
                              height="24"
                              width="24"
                              viewBox="0 0 16 16"
                              className="fill-current"
                            >
                              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                            </svg>
                            GitHub Repository
                          </h4>
                          <div className="flex flex-col gap-4">
                            {/* Custom GitHub Buttons using API */}
                            <GitHubStats repo={activity.githubRepo} />

                            <div className="w-full overflow-hidden rounded-lg bg-white dark:bg-[#0d1117] p-2 border border-light-border dark:border-gray-800">
                              <div className="flex justify-center">
                                <img
                                  src={`https://api.star-history.com/svg?repos=${activity.githubRepo}&type=Date`}
                                  alt="Star History Chart"
                                  className="max-w-full"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Add Links */}
                      {activity.links && activity.links.length > 0 && (
                        <div className="mb-4 overflow-hidden">
                          <h4 className="font-semibold text-lg mb-2">Links:</h4>
                          <ul className="space-y-1">
                            {activity.links.map((link, index) => (
                              <li key={index} className="truncate">
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-accent hover:text-accent-hover hover:underline transition-colors"
                                >
                                  {link.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Add Technologies */}
                      {activity.technologies &&
                        activity.technologies.length > 0 && (
                          <div className="mt-4 mb-4 flex flex-wrap gap-2">
                            {activity.technologies.map((tech, i) => (
                              <span
                                key={i}
                                className="tech-tag text-sm bg-gradient-to-r from-accent to-accent-hover text-text-on-accent px-3 py-1 rounded-full shadow-md hover:shadow-lg transition-all duration-200"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}

                      {/* Add remaining Images that weren't used inline */}
                      {activity.images && activity.images.length > 0 && (
                        <div className="mb-4">
                          {activity.images.map((image, index) => {
                            // Check if this image was already used inline
                            const wasUsedInline =
                              activity.longDescription.includes(
                                `{{image[${index}]}}`,
                              );
                            if (!wasUsedInline) {
                              return (
                                <div key={index} className="mb-4">
                                  <img
                                    src={getGoogleDriveImageEmbedUrl(image)}
                                    alt={`Project image ${index + 1}`}
                                    className="w-full rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300"
                                  />
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}

                      {/* Add remaining embeds that weren't used inline */}
                      {activity.gdrive_embed &&
                        activity.gdrive_embed.length > 0 && (
                          <div className="mb-4">
                            {activity.gdrive_embed.map((_, index) => {
                              // Check if this embed was already used inline
                              const wasUsedInline =
                                activity.longDescription.includes(
                                  `{{embed[${index}]}}`,
                                ) ||
                                activity.longDescription.includes(
                                  `{{gdrive_embed[${index}]}}`,
                                );
                              if (!wasUsedInline) {
                                const embedData =
                                  activity.gdrive_embed?.[index];
                                const isNewFormat =
                                  typeof embedData === "object" &&
                                  embedData !== null;
                                const url = isNewFormat
                                  ? embedData.url
                                  : embedData;
                                const abovePhotoCaption = isNewFormat
                                  ? embedData.abovePhotoCaption
                                  : null;
                                const credit = isNewFormat
                                  ? embedData.credit
                                  : null;
                                const desktopSize = isNewFormat
                                  ? embedData.desktopSize
                                  : "M";
                                const mobileSize = isNewFormat
                                  ? embedData.mobileSize
                                  : "M";
                                const desktopEmbedAlign = isNewFormat
                                  ? embedData.desktopEmbedAlign
                                  : "center";

                                // Determine container classes based on alignment (only affects desktop)
                                const isMobile = window.innerWidth <= 768;
                                let containerClasses = "my-4";
                                let embedWrapperClasses = "";

                                if (
                                  isMobile ||
                                  desktopEmbedAlign === "center"
                                ) {
                                  // Mobile or center alignment: full width, centered
                                  containerClasses += " text-center";
                                  embedWrapperClasses = "w-full";
                                } else if (desktopEmbedAlign === "left") {
                                  // Desktop left alignment: float left, text wraps around
                                  containerClasses +=
                                    " md:float-left md:mr-6 md:mb-4 md:clear-left";
                                  embedWrapperClasses = "w-full md:w-96";
                                } else if (desktopEmbedAlign === "right") {
                                  // Desktop right alignment: float right, text wraps around
                                  containerClasses +=
                                    " md:float-right md:ml-6 md:mb-4 md:clear-right";
                                  embedWrapperClasses = "w-full md:w-96";
                                }

                                let initialSize, initialHeight;
                                const size =
                                  window.innerWidth <= 768
                                    ? mobileSize
                                    : desktopSize;

                                switch (size) {
                                  case "S":
                                    initialSize = "small";
                                    initialHeight = 200;
                                    break;
                                  case "L":
                                    initialSize = "large";
                                    initialHeight = 500;
                                    break;
                                  case "XL":
                                    initialSize = "full";
                                    initialHeight = 850;
                                    break;
                                  case "M":
                                  default:
                                    initialSize = "medium";
                                    initialHeight = 300;
                                }

                                return (
                                  <div key={index} className={containerClasses}>
                                    {abovePhotoCaption && (
                                      <p className="mb-2 text-base text-light-foreground dark:text-dark-foreground text-center">
                                        {abovePhotoCaption}
                                      </p>
                                    )}
                                    <div className={embedWrapperClasses}>
                                      <ResizableEmbed
                                        url={url}
                                        initialSize={initialSize}
                                        initialHeight={initialHeight}
                                        desktopEmbedAlign={desktopEmbedAlign}
                                      />
                                    </div>
                                    {credit && (
                                      <p className="mt-1 text-xs text-light-foreground-secondary dark:text-dark-foreground-secondary text-center">
                                        {credit}
                                      </p>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Projects;
