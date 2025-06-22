"use client";

import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { FaGlobe } from "react-icons/fa";
import { contestsAndActivities } from "../data/contestsAndActivities";
import MarkerInfo from "./MarkerInfo";

// Function to generate a deterministic color based on the importance
const getDeterministicColor = (importance) => {
  // Define start and end colors (red to green)
  const startColor = { r: 255, g: 100, b: 100 }; // Lighter red
  const endColor = { r: 100, g: 255, b: 100 }; // Lighter green

  // Normalize importance to a 0-1 scale (assuming max importance is 10)
  const normalizedImportance = Math.min(importance / 10, 1);

  // Interpolate between colors
  const r = Math.round(
    startColor.r + (endColor.r - startColor.r) * normalizedImportance
  );
  const g = Math.round(
    startColor.g + (endColor.g - startColor.g) * normalizedImportance
  );
  const b = Math.round(
    startColor.b + (endColor.b - startColor.b) * normalizedImportance
  );

  return `rgb(${r}, ${g}, ${b})`;
};

// Fix for default markers in Next.js
if (typeof window !== "undefined") {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

// Process the real data from contestsAndActivities
const processAchievements = () => {
  const venueMap = new Map();

  contestsAndActivities.forEach((activity) => {
    // Group by venue + city + country to ensure each venue gets its own marker
    const key = `${activity.mapData.venue}-${activity.mapData.city}-${activity.mapData.country}`;
    if (!venueMap.has(key)) {
      venueMap.set(key, {
        city: activity.mapData.city,
        country: activity.mapData.country,
        coords: [
          activity.mapData.coordinates.lat,
          activity.mapData.coordinates.lng,
        ],
        venue: activity.mapData.venue,
        achievements: [],
        activities: [],
        totalImportance: 0,
        count: 0,
      });
    }

    const venueData = venueMap.get(key);
    venueData.achievements.push({
      title: activity.title,
      date: activity.date,
      importance: activity.importance,
      shortDescription: activity.shortDescription,
    });

    venueData.activities.push({
      title: activity.title,
      venue: activity.mapData.venue,
      date: activity.date,
      slug: activity.slug,
    });

    venueData.totalImportance += activity.importance;
    venueData.count += 1;
  });

  return Array.from(venueMap.values()).map((venue) => ({
    ...venue,
    type:
      venue.totalImportance >= 15
        ? "major"
        : venue.totalImportance >= 8
        ? "medium"
        : "minor",
    averageImportance: venue.totalImportance / venue.count,
    maxImportance: Math.max(...venue.achievements.map((a) => a.importance)),
    label: `${venue.venue}, ${venue.city}`, // Changed to show venue + city instead of just city
  }));
};

export default function AchievementMap({ navigateWithRefresh, onToggle3D }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [achievements] = useState(processAchievements());
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);

  useEffect(() => {
    if (
      !mapRef.current ||
      mapInstanceRef.current ||
      typeof window === "undefined"
    )
      return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [35, 20],
      zoom: 2,
      minZoom: 1,
      maxZoom: 18, // Increased from 8 to 18 for much deeper zoom
      scrollWheelZoom: false,
      doubleClickZoom: false,
      dragging: false,
      touchZoom: false,
      zoomControl: false,
      attributionControl: false,
    });

    // Add dark theme tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }
    ).addTo(map);

    // Custom icon for major achievements
    const createCustomIcon = (count, type, maxImportance) => {
      const color = getDeterministicColor(maxImportance);
      const iconHtml = `<div class="custom-marker ${type}" style="background: ${color}; border-color: ${color};"><span class="marker-count">${count}</span></div>`;
      const size = type === "major" ? 50 : type === "medium" ? 40 : 30;
      return L.divIcon({
        html: iconHtml,
        iconSize: [size, size],
        className: "custom-div-icon",
      });
    };

    // Create marker cluster group
    const markerClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50, // Reduced from 80 to 50 - markers need to be closer to cluster
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 8, // Reduced from 10 to 8 - disable clustering earlier when zooming in
      iconCreateFunction: function (cluster) {
        const childCount = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();

        // Calculate total counts and importance from all markers in cluster
        let totalCount = 0;
        let totalImportance = 0;
        let maxImportance = 0;
        markers.forEach((marker) => {
          if (marker.locationData) {
            totalCount += marker.locationData.count; // Sum of all achievement counts
            totalImportance += marker.locationData.totalImportance;
            maxImportance = Math.max(
              maxImportance,
              marker.locationData.maxImportance
            );
          }
        });

        const color = getDeterministicColor(maxImportance);

        // Determine cluster size based on total achievement count (not marker count)
        let size = 40;
        let className = "marker-cluster-small";
        if (totalCount > 10) {
          size = 50;
          className = "marker-cluster-medium";
        }
        if (totalCount > 20) {
          size = 60;
          className = "marker-cluster-large";
        }

        return L.divIcon({
          html: `<div class="marker-cluster ${className}" style="background: ${color}; border-color: ${color};">
                   <span>${totalCount}</span>
                 </div>`,
          className: "custom-cluster-icon",
          iconSize: [size, size],
        });
      },
    });

    // Add markers to cluster group
    achievements.forEach((location) => {
      const icon = createCustomIcon(
        location.count,
        location.type,
        location.maxImportance
      );
      const marker = L.marker(location.coords, { icon });

      // Store location data on marker for cluster calculations
      marker.locationData = location;

      // Simple click handler like 3D map - no popup, direct navigation
      marker.on("click", () => {
        setSelectedMarker(location);
      });

      markerClusterGroup.addLayer(marker);
    });

    // Add cluster group to map
    map.addLayer(markerClusterGroup);

    // Remove global function - not needed anymore
    mapInstanceRef.current = map;
    setIsMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setIsMapReady(false);
      }
    };
  }, [achievements]);

  // Update map settings when expanded/fullscreen state changes
  useEffect(() => {
    if (mapInstanceRef.current && isMapReady) {
      const map = mapInstanceRef.current;

      if (isExpanded) {
        // Keep zoom unchanged - no zoom changes on hover
        map.scrollWheelZoom.enable();
        map.doubleClickZoom.enable();
        map.dragging.enable();
        map.touchZoom.enable();

        if (!map.zoomControl) {
          map.zoomControl = L.control.zoom();
          map.zoomControl.addTo(map);
        }
      } else {
        // Keep zoom unchanged - no zoom changes on hover
        map.scrollWheelZoom.disable();
        map.doubleClickZoom.disable();
        map.dragging.disable();
        map.touchZoom.disable();

        if (map.zoomControl) {
          map.removeControl(map.zoomControl);
          map.zoomControl = null;
        }
      }
    }
  }, [isExpanded, isMapReady]);

  const handleMouseEnter = () => {
    setIsExpanded(true);
    // Trigger map resize after expansion animation completes
    if (mapInstanceRef.current) {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 750); // Match the transition duration
    }
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
    // Trigger map resize after contraction animation completes
    if (mapInstanceRef.current) {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 750); // Match the transition duration
    }
  };

  const getMapHeight = () => {
    return "600px"; // Keep consistent height - no expansion on hover
  };

  return (
    <div className="relative">
      <style jsx global>{`
        .custom-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          animation: pulse 2s infinite;
          font-weight: bold;
          border: 3px solid;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }

        .marker-count {
          font-size: 14px;
          color: white;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
        }

        .custom-marker.medium .marker-count {
          font-size: 12px;
        }

        .custom-marker.minor .marker-count {
          font-size: 10px;
        }

        /* Marker cluster styles */
        .marker-cluster {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-weight: bold;
          border: 3px solid;
          color: white;
          font-size: 14px;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
          animation: pulse 2s infinite;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .marker-cluster:hover {
          transform: scale(1.1);
        }

        .marker-cluster-small {
          width: 40px;
          height: 40px;
        }

        .marker-cluster-medium {
          width: 50px;
          height: 50px;
          font-size: 16px;
        }

        .marker-cluster-large {
          width: 60px;
          height: 60px;
          font-size: 18px;
        }

        /* Override default cluster styles */
        .leaflet-cluster-anim .leaflet-marker-icon,
        .leaflet-cluster-anim .leaflet-marker-shadow {
          transition: all 0.3s ease-out;
        }

        .leaflet-markercluster-group {
          animation: none !important;
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
          }
        }

        .leaflet-container {
          background: theme("colors.dark-background-secondary");
          font-family: inherit;
        }

        .leaflet-control-zoom {
          border: 1px solid theme("colors.accent-hover / 30%") !important;
          background: theme("colors.dark-background / 90%") !important;
        }

        .leaflet-control-zoom a {
          background: theme("colors.dark-background / 90%") !important;
          color: theme("colors.accent-hover") !important;
          border-color: theme("colors.accent-hover / 30%") !important;
        }

        .leaflet-control-zoom a:hover {
          background: theme("colors.accent-hover / 20%") !important;
        }
      `}</style>

      <div
        className={`
          relative overflow-hidden rounded-3xl transition-all duration-700
          ${
            isExpanded
              ? "ring-2 ring-orange-500/80"
              : "ring-1 ring-dark-border/50"
          }
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Map Container */}
        <div
          ref={mapRef}
          className="transition-all duration-700 rounded-2xl"
          style={{
            height: getMapHeight(),
            width: "100%",
          }}
        />

        {/* Control Buttons Container */}
        <div className="absolute top-6 right-10 z-[1000] flex justify-between items-start gap-10">
          {/* Left side buttons */}
          <div className="flex flex-col gap-3">
            {/* 3D Globe Toggle Button */}
            <button
              onClick={onToggle3D}
              className="group relative bg-gradient-to-r from-accent-dark to-accent-darker hover:from-accent-darker hover:to-accent-dark text-text-on-accent px-3 sm:px-4 py-2 rounded-full font-medium transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <FaGlobe className="text-base sm:text-lg animate-spin-slow" />
              <span className="text-xs sm:text-sm font-semibold">
                Switch to 3D Globe
              </span>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-hover rounded-full animate-ping"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full"></div>
            </button>
          </div>

          {/* Right side - Legend - Hidden on mobile */}
          <div className="hidden sm:block bg-black/80 backdrop-blur-sm rounded-lg p-3 text-sm">
            <div className="mb-2 text-center">
              <span className="text-white font-semibold text-xs">
                Achievement Importance
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: getDeterministicColor(9) }}
              >
                9+
              </div>
              <span className="text-dark-foreground-secondary text-xs">
                High Impact
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: getDeterministicColor(6) }}
              >
                6
              </div>
              <span className="text-dark-foreground-secondary text-xs">
                Medium Impact
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: getDeterministicColor(3) }}
              >
                3
              </div>
              <span className="text-dark-foreground-secondary text-xs">
                Lower Impact
              </span>
            </div>
            <div className="text-center text-xs text-gray-400 border-t border-gray-600 pt-2">
              Red → Yellow → Green
            </div>
          </div>
        </div>
      </div>

      {/* MarkerInfo component for detailed project view */}
      {selectedMarker && (
        <MarkerInfo
          marker={selectedMarker}
          onClose={() => setSelectedMarker(null)}
          navigateWithRefresh={navigateWithRefresh}
        />
      )}
    </div>
  );
}
