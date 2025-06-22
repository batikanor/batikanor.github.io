"use client";

import L from "leaflet";
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
  const cityMap = new Map();

  contestsAndActivities.forEach((activity) => {
    const key = `${activity.mapData.city}-${activity.mapData.country}`;
    if (!cityMap.has(key)) {
      cityMap.set(key, {
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

    const cityData = cityMap.get(key);
    cityData.achievements.push({
      title: activity.title,
      date: activity.date,
      importance: activity.importance,
      shortDescription: activity.shortDescription,
    });

    cityData.activities.push({
      title: activity.title,
      venue: activity.mapData.venue,
      date: activity.date,
      slug: activity.slug,
    });

    cityData.totalImportance += activity.importance;
    cityData.count += 1;
  });

  return Array.from(cityMap.values()).map((city) => ({
    ...city,
    type:
      city.totalImportance >= 15
        ? "major"
        : city.totalImportance >= 8
        ? "medium"
        : "minor",
    averageImportance: city.totalImportance / city.count,
    maxImportance: Math.max(...city.achievements.map((a) => a.importance)),
    label: `${city.city}, ${city.country}`,
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
      maxZoom: 8,
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

    // Add markers
    achievements.forEach((location) => {
      const icon = createCustomIcon(
        location.count,
        location.type,
        location.maxImportance
      );
      const marker = L.marker(location.coords, { icon }).addTo(map);

      // Simple click handler like 3D map - no popup, direct navigation
      marker.on("click", () => {
        setSelectedMarker(location);
      });
    });

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
        map.setZoom(3);
        map.scrollWheelZoom.enable();
        map.doubleClickZoom.enable();
        map.dragging.enable();
        map.touchZoom.enable();

        if (!map.zoomControl) {
          map.zoomControl = L.control.zoom();
          map.zoomControl.addTo(map);
        }
      } else {
        map.setZoom(2);
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
    if (isExpanded) return "800px";
    return "600px"; // Increased from 400px
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
          ${isExpanded ? "ring-2 ring-accent/50" : "ring-1 ring-dark-border/50"}
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
        <div className="absolute top-6 left-4 sm:left-16 right-6 z-[1000] flex justify-between items-start">
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
