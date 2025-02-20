import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { contestsAndActivities } from '../data/contestsAndActivities';

// Function to convert Google Drive link to embeddable format for videos and documents
const getGoogleDriveEmbedUrl = (url) => {
  if (url.includes('youtube.com/embed/')) return url;
  const fileIdMatch = url.match(/[-\w]{25,}/);
  return fileIdMatch ? `https://drive.google.com/file/d/${fileIdMatch[0]}/preview` : url;
};

// Function to convert Google Drive link to embeddable image format
const getGoogleDriveImageEmbedUrl = (url) => {
  const fileIdMatch = url.match(/[-\w]{25,}/);
  return fileIdMatch ? `https://drive.google.com/uc?export=view&id=${fileIdMatch[0]}` : url;
};

const ResizableEmbed = ({ url, initialHeight = 300 }) => {
  const [height, setHeight] = useState(initialHeight);
  const resizeRef = useRef(null);

  useEffect(() => {
    const resizeHandle = resizeRef.current;
    if (!resizeHandle) return;

    let startY = 0;
    let startHeight = 0;

    const handleMouseDown = (e) => {
      startY = e.clientY;
      startHeight = height;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
      const delta = e.clientY - startY;
      setHeight(Math.max(200, startHeight + delta)); // Minimum height of 200px
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    resizeHandle.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizeHandle.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [height]);

  return (
    <div className="relative mb-4">
      <iframe 
        src={getGoogleDriveEmbedUrl(url)} 
        className="w-full border-0 rounded-lg"
        style={{ height: `${height}px` }}
        allowFullScreen
      />
      <div 
        ref={resizeRef}
        className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200 hover:bg-gray-300 cursor-ns-resize"
        title="Drag to resize"
      />
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
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <motion.div
      className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[200]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragListener={isMobile} // Enable drag on the entire component for mobile
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-700 w-[95vw] sm:w-[90vw] max-w-[800px] max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header with drag handle - only used on desktop */}
        <div 
          className="sticky top-0 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-green-500/20 dark:from-blue-500/20 dark:to-green-500/20 rounded-t-lg flex justify-between items-center z-10"
          onPointerDown={(e) => !isMobile && dragControls.start(e)}
          style={{ cursor: isMobile ? 'default' : 'move' }}
        >
          <h3 className="font-bold text-gray-800 dark:text-white text-base sm:text-lg">Project Details</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(95vh-3rem)] sm:max-h-[calc(90vh-3rem)]">
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Title */}
            <div className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
              {activity.title}
            </div>
            
            {/* Rest of the content with mobile-adjusted sizes */}
            <div className="space-y-2 sm:space-y-3 text-sm sm:text-base text-gray-600 dark:text-gray-300">
              <div>
                <strong className="text-gray-700 dark:text-gray-200">Venue:</strong> {activity.mapData?.venue}, {activity.mapData?.city}/{activity.mapData?.country}
              </div>
              <div>
                <strong className="text-gray-700 dark:text-gray-200">Date:</strong> {activity.date}
              </div>
            </div>

            {/* Short Description */}
            {activity.shortDescription && (
              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200">Summary</h4>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">{activity.shortDescription}</p>
              </div>
            )}

            {/* Long Description */}
            {activity.longDescription && (
              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200">Details</h4>
                {activity.longDescription.split('\n').map((line, i) => (
                  <p key={i} className="text-sm sm:text-base text-gray-600 dark:text-gray-300">{line}</p>
                ))}
              </div>
            )}

            {/* Technologies */}
            {activity.technologies && activity.technologies.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200">Technologies</h4>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {activity.technologies.map((tech, i) => (
                    <span
                      key={i}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm bg-gray-700 text-white rounded-full"
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
                <h4 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200">Links</h4>
                <ul className="space-y-1">
                  {activity.links.map((link, i) => (
                    <li key={i}>
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sm sm:text-base text-blue-500 hover:text-blue-600 hover:underline"
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
                <h4 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200">Images</h4>
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
                <h4 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200">Additional Content</h4>
                <div className="space-y-3 sm:space-y-4">
                  {activity.gdrive_embed.map((embedUrl, i) => (
                    <ResizableEmbed key={i} url={embedUrl} initialHeight={250} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const MarkerInfo = ({ marker, onClose, navigateWithRefresh, isFullscreen = false, children, isGameMode = false }) => {
  const dragControls = useDragControls();
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Add mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleActivityClick = (activity) => {
    const fullActivity = contestsAndActivities.find(a => a.slug === activity.slug);
    setSelectedActivity(fullActivity);
  };

  const containerClasses = isFullscreen
    ? "fixed top-40 right-16 z-[100]"
    : "fixed top-1/2 right-4 transform -translate-y-1/2 z-[100]";

  const contentClasses = `relative p-4 rounded-lg shadow-lg bg-white dark:bg-gray-900/40 border-[3px] border-gray-300 ${
    isFullscreen ? "max-w-md" : "max-w-[200px] sm:max-w-xs"
  }`;

  return (
    <>
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
                  className="absolute top-0 left-0 right-0 h-8 cursor-move bg-gradient-to-r from-blue-500/20 to-green-500/20 dark:from-blue-500/20 dark:to-green-500/20 rounded-t-lg"
                  onPointerDown={(e) => dragControls.start(e)}
                />
              )}
              
              {/* Content */}
              <h2 className={`text-base sm:text-xl font-semibold mb-1 sm:mb-4 relative text-gray-800 dark:text-white ${!isMobile ? 'pt-6' : ''}`}>
                {marker.label || ' '}
              </h2>
              <div className="max-h-32 sm:max-h-64 overflow-y-auto space-y-2 sm:space-y-3 relative">
                {(marker.activities || []).map((activity, index) => (
                  <div 
                    key={index}
                    onClick={() => handleActivityClick(activity)}
                    className="p-3 rounded-md text-[10px] sm:text-sm shadow-md bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer"
                  >
                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                      {activity.venue} - {activity.date}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      {activity.title}
                    </div>
                  </div>
                ))}
              </div>
              {children}
              {!isGameMode && (
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg text-sm sm:text-base font-medium w-full cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedActivity && (
          <ProjectDetailsPopup 
            activity={selectedActivity} 
            onClose={() => setSelectedActivity(null)} 
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default MarkerInfo;