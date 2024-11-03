import React, { useState, useEffect } from "react";
import "./Projects.css";
import { contestsAndActivities } from "../data/contestsAndActivities";

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

  // Expand item based on URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const slug = hash.replace("#", "");  
      const foundActivity = contestsAndActivities.find((activity) => activity.slug === slug);
      if (foundActivity) {
        setExpandedActivity(foundActivity);
      }
    }
  }, []);
  

  const toggleExpandedView = (activity) => {
    setExpandedActivity(activity === expandedActivity ? null : activity);
  };

  const handleCopyLink = (slug) => {
    const url = `${window.location.origin}${window.location.pathname}#${slug}`;
    
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
  
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold tracking-tight text-center mb-12 text-white">
        Past Project Samples
      </h2>

      {/* Links to jump to specific sections */}
      {/* <div className="mb-6">
        {contestsAndActivities.map((activity) => (
          <a
            key={activity.slug}
            href={`#project-${activity.slug}`}
            onClick={() => setExpandedActivity(activity)} // Expand on click
            className="text-blue-400 hover:underline block mb-2"
          >
            {activity.title}
          </a>
        ))}
      </div> */}

      {/* Activities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        {contestsAndActivities.map((activity) => {
          const isExpanded = expandedActivity === activity;

          return (
            <div
              id={activity.slug} 
              key={activity.slug}
              className={`${
                isExpanded ? "col-span-1 sm:col-span-2" : ""
              } transition-all duration-300`}
            >
              {/* <div className="relative p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-600"> */}
              <div className={`relative p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-600 ${
                  activity.highlighted ? "highlight" : ""
                }`}>

                {/* Deterministic colored bar at the top */}
                {!isExpanded && (
                  <div
                    style={{ backgroundColor: getDeterministicColor(activity.slug) }}
                    className="absolute top-0 left-0 right-0 h-2 rounded-t-lg"
                  ></div>
                )}
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-semibold mb-2 text-white">
                    {activity.title}
                  </h3>
                  <button
                    onClick={() => toggleExpandedView(activity)}
                    className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600"
                  >
                    {isExpanded ? "Collapse" : "See more"}
                  </button>
                </div>
                <p className="text-gray-300">{activity.location}</p>
                <p className="text-gray-400 mb-4">{activity.date}</p>

                {/* Display Short Description */}
                <p className="text-gray-300 mb-4">{activity.shortDescription}</p>

                {/* Display Long Description if Expanded */}
                {isExpanded && (
                  <>
                    <p className="text-gray-300 mb-4">{activity.longDescription}</p>

                    {/* Copy Link Button */}
                    <button
                      onClick={() => handleCopyLink(activity.slug)}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-500 mb-4"
                    >
                      Copy Link to this Project
                    </button>
                  </>
                )}

                {/* Used Technologies */}
                {activity.technologies && (
                  <div className="mt-4 mb-4 flex flex-wrap">
                    {activity.technologies.map((tech, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-700 text-white px-2 py-1 rounded-full mr-2 mb-2"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                {/* Display Links */}
                {activity.links && (
                  <div className="mt-4">
                    {activity.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline block"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}

                {/* Embed Google Drive Media if Available */}
                {isExpanded && activity.gdrive_embed && (
                  <div className="mt-6 space-y-4">
                    {activity.gdrive_embed.map((embedUrl, i) => (
                      <ResizePanel key={i} direction="s" style={{ marginBottom: "1rem", height: "30vh" }}>
                        <iframe
                          src={getGoogleDriveEmbedUrl(embedUrl)}
                          width="100%"
                          height="1000"
                          allow="autoplay"
                          className="rounded-lg"
                          frameBorder="0"
                          allowFullScreen
                          title={`${activity.title} Google Drive Embed ${i + 1}`}
                        ></iframe>
                      </ResizePanel>
                    ))}
                  </div>
                )}

                {/* Display Images if Available */}
                {isExpanded && activity.images && (
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activity.images.map((image, i) => (
                      <img
                        key={i}
                        src={getGoogleDriveImageEmbedUrl(image)}
                        alt={`Image for ${activity.title}`}
                        className="w-full h-auto rounded-lg shadow-lg"
                      />
                    ))}
                  </div>
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