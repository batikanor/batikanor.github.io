const MarkerInfo = ({ marker, onClose, navigateWithRefresh, isFullscreen = false, children, isGameMode = false }) => {
  const containerClasses = isFullscreen
    ? "fixed top-40 right-16 z-50"
    : "fixed top-1/2 right-4 transform -translate-y-1/2 z-50";

  const contentClasses = `bg-black bg-opacity-75 text-white p-2 sm:p-4 rounded-lg shadow-lg ${
    isFullscreen ? "max-w-md" : "max-w-[150px] sm:max-w-xs"
  }`;

  return (
    <div className={containerClasses}>
      <div className={contentClasses}>
        <h2 className="text-base sm:text-xl text-white font-semibold mb-1 sm:mb-4">
          {marker.label || ' '}
        </h2>
        <div className="max-h-32 sm:max-h-64 overflow-y-auto space-y-1 sm:space-y-2">
          {(marker.activities || []).map((activity, index) => (
            <div key={index} className="p-1 sm:p-3 rounded-md text-[10px] sm:text-sm shadow-md bg-black bg-opacity-50">
              <strong>{activity.venue} - {activity.date}</strong><br />
              <span>{activity.title}</span>
              <button
                onClick={() => {
                  navigateWithRefresh(activity.slug);
                  onClose();
                }}
                className="text-blue-400 hover:underline ml-1 sm:ml-2 text-[10px] sm:text-sm"
              >
                View Project
              </button>
            </div>
          ))}
        </div>
        {children}
        {!isGameMode && (
          <button
            onClick={onClose}
            className="mt-1 sm:mt-4 px-2 py-0.5 sm:px-4 sm:py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs sm:text-base"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default MarkerInfo;