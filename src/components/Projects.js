import React, { useState, useEffect } from "react";
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

// Function to generate a deterministic color based on the slug
const getDeterministicColor = (slug) => {
  const colors = ["#FF6347", "#4682B4", "#32CD32", "#FFD700", "#8A2BE2", "#FF69B4", "#00CED1", "#FF4500"];
  let hash = 0;
  // Create a simple hash from the slug
  for (let i = 0; i < slug?.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Get a deterministic index based on the hash
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
const Projects = () => {
  const [expandedActivity, setExpandedActivity] = useState(null);

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
          className="flex items-center gap-2 dark:text-gray-300 cursor-pointer hover:text-blue-400"
          onClick={onClick}
        >
          <FaGlobe className="text-blue-400" />
          {activity.mapData.venue}, {activity.mapData.city}/{activity.mapData.country}
          
          {/* Tooltip */}
          <span className="invisible group-hover:visible absolute left-0 top-full mt-2 w-48 p-2 bg-gray-800 text-white text-sm rounded shadow-lg z-10">
            Click to view location on the map
          </span>
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
        Past Project Samples
      </h2>


      {/* Activities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
        {contestsAndActivities.map((activity) => {
          const isExpanded = expandedActivity === activity;
          const isMinor = activity.importance < 5;

          return (
            <div
              id={activity.slug} 
              key={activity.slug}
              className={`${
                isExpanded ? "col-span-1 sm:col-span-2 lg:col-span-4" : isMinor ? "col-span-1 sm:col-span-1 lg:col-span-1" : "col-span-1 sm:col-span-2 lg:col-span-2"
              } transition-all duration-300`}
            >
              <div className={`relative p-4 rounded-lg shadow-lg border border-gray-600 ${
                activity.highlighted ? "highlight" : ""
              }`}>
                
                {/* Deterministic colored bar at the top */}
                {!isExpanded && (
                  <div
                    style={{ backgroundColor: getDeterministicColor(activity.slug) }}
                    className="absolute top-0 left-0 right-0 h-2 rounded-t-lg"
                  >
                    {isMinor && <span className="minor-achievement">MINOR ACHIEVEMENT</span>}
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <h3 className={`${
                    isMinor ? 'text-sm sm:text-lg' : 'text-lg sm:text-2xl'
                  } font-semibold mb-2`}>
                    {activity.title}
                  </h3>
                  <button
                    onClick={() => toggleExpandedView(activity)}
                    className="px-3 py-1 rounded hover:bg-gray-500"
                  >
                    {isExpanded ? "Collapse" : "See more"}
                  </button>
                </div>
                
                <LocationDisplay activity={activity} onClick={() => handleLocationClick(activity)} />
                
                <p className="mb-4 dark:text-gray-300">{activity.date}</p>
                
                {/* Display Short Description */}
                {!isMinor && <p className="mb-4 dark:text-gray-200">{activity.shortDescription}</p>}
                
                {/* Display Long Description if Expanded */}
                {isExpanded && (
                  <>
                    {activity.longDescription.split('\n').map((line, index) => (
                      <p className="dark:text-white" key={index}>{line}</p>
                    ))}
                    <br/>
                    <button
                      onClick={() => handleCopyLink(activity.slug)}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-500 mb-4"
                    >
                      Copy Link to this Project
                    </button>
                    
                    {/* Add Links */}
                    {activity.links && activity.links.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold">Links:</h4>
                        <ul>
                          {activity.links.map((link, index) => (
                            <li key={index}>
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
                        {activity.images.map((image, index) => (
                          <img key={index} src={getGoogleDriveImageEmbedUrl(image)} alt={`Project image ${index + 1}`} className="mb-2" />
                        ))}
                      </div>
                    )}

                    {activity.gdrive_embed && activity.gdrive_embed.length > 0 && (
                      <div className="mb-4">
                        {activity.gdrive_embed.map((embedUrl, index) => (
                          <iframe 
                            key={index} 
                            src={getGoogleDriveEmbedUrl(embedUrl)} 
                            className="w-full h-64 mb-2" 
                            frameBorder="0" 
                            allowFullScreen
                          ></iframe>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Projects;