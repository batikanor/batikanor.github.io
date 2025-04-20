import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import VanillaTilt from 'vanilla-tilt';
import "./Projects.css";
import { contestsAndActivities } from "../data/contestsAndActivities";
import { NAVBAR_HEIGHT } from '../constants/layout';
import { FaGlobe } from 'react-icons/fa';

// import ResizePanel from "react-resize-panel";
const ResizePanel = typeof window !== "undefined" ? require("react-resize-panel").default : null;

// Function to convert Google Drive link to embeddable format for videos and documents
const getGoogleDriveEmbedUrl = (url) => {
  const fileIdMatch = url.match(/[-\w]{25,}/);
  return fileIdMatch ? `https://drive.google.com/file/d/${fileIdMatch[0]}/preview` : url;
};

// Function to convert Google Drive link to embeddable image format
const getGoogleDriveImageEmbedUrl = (url) => {
  const fileIdMatch = url.match(/[-\w]{25,}/);
  return fileIdMatch ? `https://drive.google.com/uc?export=view&id=${fileIdMatch[0]}` : url;
};

// Replace getDeterministicColor with getImportanceStyles
const getImportanceStyles = (importance) => {
  // Define different style configurations based on importance ranges
  if (importance >= 8) {
    return {
      borderStyle: 'border-l-4 border-t-4',
      borderColor: 'border-yellow-400',
      bgGradient: 'bg-gradient-to-r from-yellow-100/10 to-transparent'
    };
  } else if (importance >= 5) {
    return {
      borderStyle: 'border-l-4',
      borderColor: 'border-blue-400',
      bgGradient: 'bg-gradient-to-r from-blue-100/10 to-transparent'
    };
  } else if (importance >= 2) {
    return {
      borderStyle: 'border-l-2',
      borderColor: 'border-purple-400',
      bgGradient: 'bg-gradient-to-r from-purple-100/10 to-transparent'
    };
  } else {
    return {
      borderStyle: 'border-l',
      borderColor: 'border-gray-400',
      bgGradient: 'bg-gradient-to-r from-gray-100/10 to-transparent'
    };
  }
};

// Update the iframe component with preset size options and better controls
const ResizableEmbed = ({ url, initialHeight = 300 }) => {
  const [height, setHeight] = useState(initialHeight);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const presetSizes = {
    small: 250,
    medium: 450,
    large: 650,
    full: 850
  };

  const handleSizeChange = (size) => {
    setHeight(presetSizes[size]);
    setIsExpanded(size === 'full');
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
        <div className="size-controls bg-white dark:bg-gray-800 px-2 py-1 rounded-lg shadow-md flex items-center justify-between">
          <div className="flex space-x-2">
            <button 
              onClick={() => handleSizeChange('small')} 
              className={`size-btn ${height === presetSizes.small ? 'active' : ''}`}
              title="Small size"
            >
              S
            </button>
            <button 
              onClick={() => handleSizeChange('medium')} 
              className={`size-btn ${height === presetSizes.medium ? 'active' : ''}`}
              title="Medium size"
            >
              M
            </button>
            <button 
              onClick={() => handleSizeChange('large')} 
              className={`size-btn ${height === presetSizes.large ? 'active' : ''}`}
              title="Large size"
            >
              L
            </button>
            <button 
              onClick={() => handleSizeChange('full')} 
              className={`size-btn ${height === presetSizes.full ? 'active' : ''}`}
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
    const foundActivity = contestsAndActivities.find((activity) => activity.slug === slug);
    if (foundActivity) {
      setExpandedActivity(foundActivity);

      // Wait for state update and content expansion
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const element = document.getElementById(foundActivity.slug);
          if (element) {
            const offset = element.offsetTop - NAVBAR_HEIGHT - 20; // Added 20px padding
            window.scrollTo({
              top: offset,
              behavior: "smooth"
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
      navigator.clipboard.writeText(url).then(() => {
        alert("Link copied to clipboard!");
      }).catch(err => {
        console.error("Failed to copy the link:", err);
        alert("Unable to copy link. Please try again.");
      });
    } catch (err) {
      console.error("Clipboard API error:", err);
      alert("Clipboard operation failed. Please make sure the document is focused.");
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
          className="flex items-center gap-1 dark:text-gray-300 cursor-pointer hover:text-blue-400 text-xs sm:text-sm truncate"
          onClick={onClick}
        >
          <FaGlobe className="text-blue-400 flex-shrink-0" />
          <span className="truncate">{activity.mapData.venue}, {activity.mapData.city}/{activity.mapData.country}</span>
          
          {/* Tooltip */}
          <span className="invisible group-hover:visible absolute left-0 top-full mt-2 w-48 p-2 bg-gray-800 text-white text-sm rounded shadow-lg z-10">
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
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add this useEffect for tilt effect
  useEffect(() => {
    // Initialize tilt effect on all project cards
    const tiltElements = document.querySelectorAll(".tilt-card");
    if (!isMobile) {
      tiltElements.forEach(element => {
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

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8"
    >
      <motion.h2 
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        className="text-3xl font-bold tracking-tight text-center mb-12"
      >
        Past Project Samples
      </motion.h2>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {contestsAndActivities.map((activity, index) => {
          const isExpanded = expandedActivity === activity;
          const isMicro = activity.importance < 2;
          const isMinor = activity.importance >= 2 && activity.importance < 5;

          return (
            <motion.div
              id={activity.slug}
              key={activity.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`${
                isExpanded ? "col-span-1 sm:col-span-2 lg:col-span-4" : 
                isMicro ? "col-span-1" : 
                isMinor ? "col-span-1" : 
                "col-span-1 lg:col-span-2"
              } transition-all duration-300`}
            >
              <div 
                className={`tilt-card relative p-3 sm:p-4 rounded-lg shadow-lg bg-white dark:bg-gray-900/80 border-[3px] border-gray-300 overflow-hidden ${
                  activity.highlighted ? "highlight" : ""
                } ${!isExpanded ? `${getImportanceStyles(activity.importance).borderStyle} ${getImportanceStyles(activity.importance).borderColor}` : ""}`}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Replace the colored bar with a subtle gradient background */}
                {!isExpanded && (
                  <div className={`absolute inset-0 ${getImportanceStyles(activity.importance).bgGradient} pointer-events-none rounded-lg`} />
                )}
                
                {/* Remove the old colored bar div and continue with existing content */}
                <div className="relative z-20">
                  <div className="flex justify-between items-start flex-wrap">
                    <h3 className={`${
                      isMicro ? 'text-xs sm:text-sm' :
                      isMinor ? 'text-sm sm:text-base' : 
                      'text-base sm:text-lg'
                    } font-semibold mb-2 max-w-[70%]`}>
                      {activity.title}
                    </h3>
                    <div className="flex flex-col items-end gap-2 ml-auto">
                      {!isExpanded && (isMicro || isMinor) && (
                        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          isMicro ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : 
                          'bg-purple-200 text-purple-700 dark:bg-purple-700 dark:text-purple-200'
                        }`}>
                          {isMicro ? 'MICRO' : 'MINOR'}
                        </span>
                      )}
                      <button
                        onClick={() => toggleExpandedView(activity)}
                        className="px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
                      >
                        {isExpanded ? "Collapse" : "See more"}
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-hidden">
                    <LocationDisplay activity={activity} onClick={() => handleLocationClick(activity)} />
                    
                    <p className="mb-4 dark:text-gray-300 truncate">{activity.date}</p>
                    
                    {/* Display Short Description */}
                    <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-4 border-blue-400 dark:border-blue-500">
                      <div className="flex items-center mb-1">
                        <span className="text-xs uppercase tracking-wider text-blue-500 dark:text-blue-400 font-semibold">Summary</span>
                      </div>
                      <p className={`text-xs sm:text-sm text-gray-700 dark:text-gray-200 italic ${!isExpanded ? "line-clamp-2 sm:line-clamp-1" : ""}`}>
                        {activity.shortDescription}
                      </p>
                    </div>
                  </div>
                  
                  {/* Display Long Description if Expanded */}
                  {isExpanded && (
                    <div className="mt-4 overflow-hidden">
                      {activity.longDescription.split('\n').map((line, index) => (
                        <p className="dark:text-white mb-6" key={index}>{line}</p>
                      ))}
                      <div className="mt-4">
                        <button
                          onClick={() => handleCopyLink(activity.slug)}
                          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-500 mb-4"
                        >
                          Copy Link to this Project
                        </button>
                      </div>
                      
                      {/* Add Links */}
                      {activity.links && activity.links.length > 0 && (
                        <div className="mb-4 overflow-hidden">
                          <h4 className="font-semibold">Links:</h4>
                          <ul className="space-y-1">
                            {activity.links.map((link, index) => (
                              <li key={index} className="truncate">
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                  {link.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Add Technologies */}
                      {activity.technologies && activity.technologies.length > 0 && (
                        <div className="mt-4 mb-4 flex flex-wrap gap-2">
                          {activity.technologies.map((tech, i) => (
                            <span
                              key={i}
                              className="text-sm bg-gray-700 text-white px-3 py-1 rounded-full"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add Images or Embedded Content */}
                      {activity.images && activity.images.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-semibold">Images:</h4>
                          <div className="space-y-4">
                            {activity.images.map((image, index) => (
                              <img key={index} src={getGoogleDriveImageEmbedUrl(image)} alt={`Project image ${index + 1}`} className="w-full rounded-lg shadow-md" />
                            ))}
                          </div>
                        </div>
                      )}

                      {activity.gdrive_embed && activity.gdrive_embed.length > 0 && (
                        <div className="mb-4">
                          {activity.gdrive_embed.map((embedUrl, index) => (
                            <ResizableEmbed key={index} url={embedUrl} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default Projects;
