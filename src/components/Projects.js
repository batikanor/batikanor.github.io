import { useEffect, useState } from "react";
import { FaGlobe } from "react-icons/fa";
import VanillaTilt from "vanilla-tilt";
import { contestsAndActivities } from "../data/contestsAndActivities";
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
}) => {
  const presetSizes = {
    small: 250,
    medium: 450,
    large: 650,
    full: 850,
  };

  const [height, setHeight] = useState(
    initialHeight || presetSizes[initialSize]
  );
  const [isExpanded, setIsExpanded] = useState(initialSize === "full");

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

const Projects = () => {
  const [expandedActivity, setExpandedActivity] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Function to handle scrolling to a project
  const scrollToProject = (slug) => {
    const foundActivity = contestsAndActivities.find(
      (activity) => activity.slug === slug
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
        "Clipboard operation failed. Please make sure the document is focused."
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

  // Function to render text with inline markdown links
  const renderTextWithLinks = (text) => {
    // Find all markdown links and replace them
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add the link component
      parts.push(
        <a
          key={`link-${match.index}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent-hover hover:underline transition-colors"
        >
          {match[1]}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last link
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    // If no links found, return the original text
    return parts.length > 0 ? parts : text;
  };

  // Function to parse and render content with inline images/embeds
  const renderContentWithInlineMedia = (content, activity) => {
    if (!content) return null;

    // Split content by inline media placeholders
    const parts = content.split(
      /(\{\{(?:image|embed|gdrive_embed)\[\d+\]\}\})/g
    );

    return parts.map((part, index) => {
      // Check if this part is an inline media placeholder
      const imageMatch = part.match(/\{\{image\[(\d+)\]\}\}/);
      const embedMatch = part.match(/\{\{(?:embed|gdrive_embed)\[(\d+)\]\}\}/);

      if (imageMatch) {
        const imageIndex = parseInt(imageMatch[1]);
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
        const embedIndex = parseInt(embedMatch[1]);
        if (activity.gdrive_embed && activity.gdrive_embed[embedIndex]) {
          // Set demo video (index 2) to XL by default
          const isLargeEmbed = embedIndex === 2;
          return (
            <div key={index} className="my-6">
              <ResizableEmbed
                url={activity.gdrive_embed[embedIndex]}
                initialSize={isLargeEmbed ? "full" : "medium"}
                initialHeight={isLargeEmbed ? 850 : 300}
              />
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
                className="text-light-foreground dark:text-dark-foreground mb-4"
              >
                {renderTextWithLinks(line)}
              </p>
            );
          }
          return null;
        });
      }
      return null;
    });
  };

  return (
    <div className="w-full">
      {/* Activities Grid - Using more width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        {contestsAndActivities.map((activity, index) => {
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
                  ? "col-span-1"
                  : "col-span-1 sm:col-span-2 lg:col-span-2"
              } transition-all duration-300`}
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
                    <LocationDisplay
                      activity={activity}
                      onClick={() => handleLocationClick(activity)}
                    />

                    <p className="mb-4 text-light-foreground-secondary dark:text-dark-foreground-secondary truncate">
                      {activity.date}
                    </p>

                    {/* Display Short Description */}
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
                  </div>

                  {/* Display Long Description if Expanded */}
                  {isExpanded && (
                    <div className="mt-4 overflow-hidden">
                      {/* Render content with inline media */}
                      <div className="prose prose-lg dark:prose-invert max-w-none">
                        {renderContentWithInlineMedia(
                          activity.longDescription,
                          activity
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
                                `{{image[${index}]}}`
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
                            {activity.gdrive_embed.map((embedUrl, index) => {
                              // Check if this embed was already used inline
                              const wasUsedInline =
                                activity.longDescription.includes(
                                  `{{embed[${index}]}}`
                                ) ||
                                activity.longDescription.includes(
                                  `{{gdrive_embed[${index}]}}`
                                );
                              if (!wasUsedInline) {
                                return (
                                  <ResizableEmbed key={index} url={embedUrl} />
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
