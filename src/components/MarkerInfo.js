import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, useState } from "react";

// Function to convert Google Drive link to embeddable format for videos and documents
const getGoogleDriveEmbedUrl = (url) => {
  if (url.includes("youtube.com/embed/")) return url;
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

// Function to render content with inline media
const renderContentWithInlineMedia = (content, activity) => {
  if (!content) return null;

  // Split content by inline media placeholders
  const parts = content.split(/(\{\{(?:image|embed|gdrive_embed)\[\d+\]\}\})/g);

  return parts
    .filter((part) => part)
    .map((part, index) => {
      // Check if this part is an inline media placeholder
      const imageMatch = part.match(/\{\{image\[(\d+)\]\}\}/);
      const embedMatch = part.match(/\{\{(?:embed|gdrive_embed)\[(\d+)\]\}\}/);

      if (imageMatch) {
        const imageIndex = parseInt(imageMatch[1], 10);
        if (activity.images && activity.images[imageIndex]) {
          return (
            <div key={index} className="my-4 flex justify-center">
              <img
                src={getGoogleDriveImageEmbedUrl(activity.images[imageIndex])}
                alt={`Inline image ${imageIndex + 1}`}
                className="max-w-full rounded-lg shadow-md"
                style={{ maxHeight: "300px", objectFit: "contain" }}
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
            containerClasses += " md:float-left md:mr-6 md:mb-4 md:clear-left";
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
                <p className="mb-2 text-sm text-light-foreground dark:text-dark-foreground text-center">
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
        // Regular text content
        return part.split("\n").map((line, lineIndex) => {
          if (line.trim()) {
            return (
              <p key={`${index}-${lineIndex}`} className="mb-2">
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

const ResizableEmbed = ({
  url,
  initialHeight = 300,
  initialSize = "medium",
  desktopEmbedAlign = "center",
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
    <div className="relative mb-4 embed-container">
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

const ProjectDetailsPopup = ({ activity, onClose }) => {
  const dragControls = useDragControls();
  const [isMobile, setIsMobile] = useState(false);

  // Add mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <motion.div
      className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragListener={isMobile} // Enable drag on the entire component for mobile
    >
      <div className="bg-light-background dark:bg-dark-background rounded-lg shadow-xl border-2 border-light-border dark:border-dark-border w-[95vw] sm:w-[90vw] max-w-[800px] max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header with drag handle - only used on desktop */}
        <div
          className="sticky top-0 px-4 py-2 bg-gradient-to-r from-accent/20 to-accent-hover/20 rounded-t-lg flex justify-between items-center z-10"
          onPointerDown={(e) => !isMobile && dragControls.start(e)}
          style={{ cursor: isMobile ? "default" : "move" }}
        >
          <h3 className="font-bold text-light-foreground dark:text-dark-foreground text-base sm:text-lg">
            Project Details
          </h3>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-light-background-secondary dark:bg-dark-background-secondary hover:bg-light-border dark:hover:bg-dark-border transition-colors"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(95vh-3rem)] sm:max-h-[calc(90vh-3rem)]">
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Title */}
            <div className="text-xl sm:text-2xl font-bold text-light-foreground dark:text-dark-foreground">
              {activity.title}
            </div>

            {/* Rest of the content with mobile-adjusted sizes */}
            <div className="space-y-2 sm:space-y-3 text-sm sm:text-base text-light-foreground-secondary dark:text-dark-foreground-secondary">
              <div>
                <strong className="text-light-foreground dark:text-dark-foreground">
                  Venue:
                </strong>{" "}
                {activity.mapData?.venue}, {activity.mapData?.city}/
                {activity.mapData?.country}
              </div>
              <div>
                <strong className="text-light-foreground dark:text-dark-foreground">
                  Date:
                </strong>{" "}
                {activity.date}
              </div>
            </div>

            {/* Short Description */}
            {activity.shortDescription && (
              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-semibold text-light-foreground dark:text-dark-foreground">
                  Summary
                </h4>
                <p className="text-sm sm:text-base text-light-foreground-secondary dark:text-dark-foreground-secondary">
                  {activity.shortDescription}
                </p>
              </div>
            )}

            {/* Long Description */}
            {activity.longDescription && (
              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-semibold text-light-foreground dark:text-dark-foreground">
                  Details
                </h4>
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
                  {renderContentWithInlineMedia(
                    activity.longDescription,
                    activity
                  )}
                </div>
              </div>
            )}

            {/* Technologies */}
            {activity.technologies && activity.technologies.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-semibold text-light-foreground dark:text-dark-foreground">
                  Technologies
                </h4>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {activity.technologies.map((tech, i) => (
                    <span
                      key={i}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm bg-dark-border text-dark-foreground rounded-full"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {activity.links && activity.links.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-semibold text-light-foreground dark:text-dark-foreground">
                  Links
                </h4>
                <ul className="space-y-1">
                  {activity.links.map((link, i) => (
                    <li key={i}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm sm:text-base text-accent hover:text-accent-hover hover:underline"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Images */}
            {activity.images && activity.images.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-semibold text-light-foreground dark:text-dark-foreground">
                  Images
                </h4>
                <div className="space-y-3 sm:space-y-4">
                  {activity.images.map((image, i) => (
                    <img
                      key={i}
                      src={getGoogleDriveImageEmbedUrl(image)}
                      alt={`Project image ${i + 1}`}
                      className="w-full rounded-lg shadow-md"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Embedded Content */}
            {activity.gdrive_embed && activity.gdrive_embed.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-semibold text-light-foreground dark:text-dark-foreground">
                  Additional Content
                </h4>
                <div className="space-y-3 sm:space-y-4">
                  {activity.gdrive_embed.map((embedData, i) => {
                    const isNewFormat =
                      typeof embedData === "object" && embedData !== null;
                    const url = isNewFormat ? embedData.url : embedData;
                    const abovePhotoCaption = isNewFormat
                      ? embedData.abovePhotoCaption
                      : null;
                    const credit = isNewFormat ? embedData.credit : null;
                    const desktopSize = isNewFormat
                      ? embedData.desktopSize
                      : "M";
                    const mobileSize = isNewFormat ? embedData.mobileSize : "M";
                    const desktopEmbedAlign = isNewFormat
                      ? embedData.desktopEmbedAlign
                      : "center";

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
                      embedWrapperClasses = "w-full md:w-96";
                    } else if (desktopEmbedAlign === "right") {
                      // Desktop right alignment: float right, text wraps around
                      containerClasses +=
                        " md:float-right md:ml-6 md:mb-4 md:clear-right";
                      embedWrapperClasses = "w-full md:w-96";
                    }

                    let initialSize, initialHeight;
                    const size =
                      window.innerWidth <= 768 ? mobileSize : desktopSize;

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
                        initialHeight = 250;
                    }

                    return (
                      <div key={i} className={containerClasses}>
                        {abovePhotoCaption && (
                          <p className="mb-2 text-sm text-light-foreground dark:text-dark-foreground text-center">
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
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const MarkerInfo = ({
  marker,
  onClose,
  navigateWithRefresh,
  isFullscreen = false,
  children,
  isGameMode = false,
}) => {
  const dragControls = useDragControls();
  const [isMobile, setIsMobile] = useState(false);

  // Add mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const containerClasses = isFullscreen
    ? "fixed top-40 right-16 z-[9998]"
    : "fixed top-1/2 right-4 transform -translate-y-1/2 z-[9998]";

  const contentClasses = `relative p-4 rounded-lg shadow-lg bg-light-background dark:bg-dark-background/80 border-[3px] border-light-border dark:border-dark-border ${
    isFullscreen ? "max-w-md" : "max-w-[200px] sm:max-w-xs"
  }`;

  return (
    <AnimatePresence>
      {marker && (
        <motion.div
          key="marker-info"
          className={containerClasses}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.2 }}
          drag
          dragControls={dragControls}
          dragMomentum={false}
          dragListener={isMobile} // Enable drag on the entire component for mobile
          dragConstraints={{ left: -500, right: 500, top: -300, bottom: 300 }}
        >
          <div className={contentClasses}>
            {/* Drag handle bar - only shown/used on desktop */}
            {!isMobile && (
              <div
                className="absolute top-0 left-0 right-0 h-8 cursor-move bg-gradient-to-r from-accent/20 to-accent-hover/20 rounded-t-lg"
                onPointerDown={(e) => dragControls.start(e)}
              />
            )}

            {/* Content */}
            <div className={`relative ${!isMobile ? "pt-6" : ""}`}>
              {/* City name header */}
              <h2 className="text-base sm:text-xl font-semibold mb-3 text-light-foreground dark:text-dark-foreground">
                {marker.label || ""}
              </h2>

              <div className="max-h-32 sm:max-h-64 overflow-y-auto space-y-2 sm:space-y-3 relative">
                {(marker.activities || []).map((activity, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-md text-[10px] sm:text-sm shadow-md bg-light-background-secondary dark:bg-dark-background-secondary/50 border border-light-border dark:border-dark-border"
                  >
                    <div className="font-semibold text-light-foreground-secondary dark:text-dark-foreground-secondary">
                      {activity.venue} - {activity.date}
                    </div>
                    <div className="text-light-foreground-secondary dark:text-dark-foreground-secondary/70 mt-1 mb-2">
                      {activity.title}
                    </div>
                    {activity.slug && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/projects#${activity.slug}`;
                          window.open(url, "_blank");
                        }}
                        className="w-full mt-2 px-2 py-1 bg-gradient-to-r from-accent to-accent-hover text-text-on-accent rounded text-[9px] sm:text-xs hover:from-accent-hover hover:to-accent transition-all duration-200 font-medium"
                      >
                        View Project Details ↗
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {children}
              {!isGameMode && (
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-accent-dark to-accent-darker text-text-on-accent rounded-lg hover:from-accent-darker hover:to-accent-dark transition-all shadow-md hover:shadow-lg text-sm sm:text-base font-medium w-full cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MarkerInfo;
