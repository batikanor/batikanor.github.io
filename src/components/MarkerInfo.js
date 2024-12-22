const MarkerInfo = ({ marker, onClose, navigateWithRefresh, isFullscreen = false, children }) => {
  const containerClasses = isFullscreen
    ? "fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
    : "fixed top-1/2 right-4 transform -translate-y-1/2 z-50";

  const contentClasses = `bg-[var(--mainpanel-background-light)] dark:bg-[var(--mainpanel-background-dark)] text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] p-6 rounded-lg shadow-lg ${
    isFullscreen ? "max-w-md" : "max-w-xs"
  }`;

  return (
    <div className={containerClasses}>
      <div className={contentClasses}>
        <h2 className="text-xl font-semibold mb-4">
          {marker.label || ' '}
        </h2>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {(marker.activities || []).map((activity, index) => (
            <div key={index} className="p-3 rounded-md text-sm shadow-md ]">
              <strong>{activity.venue} - {activity.date}</strong><br />
              <span>{activity.title}</span>
              <button
                onClick={() => {
                  navigateWithRefresh(activity.slug);
                  onClose();
                }}
                className="text-blue-400 hover:underline ml-2"
              >
                View Project
              </button>
            </div>
          ))}
        </div>
        {children}
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default MarkerInfo;