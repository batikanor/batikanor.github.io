"use client";

import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { contestsAndActivities } from "../data/contestsAndActivities";
import MarkerInfo from "./MarkerInfo";

const chronologicalActivities = [...contestsAndActivities]
  .filter((activity) => activity.mapData?.coordinates)
  .reverse();

// Function to generate a deterministic color based on the importance
const getDeterministicColor = (importance) => {
  // Define start and end colors (red to green)
  const startColor = { r: 255, g: 100, b: 100 }; // Lighter red
  const endColor = { r: 100, g: 255, b: 100 }; // Lighter green

  // Normalize importance to a 0-1 scale (assuming max importance is 10)
  const normalizedImportance = Math.min(importance / 10, 1);

  // Interpolate between colors
  const r = Math.round(
    startColor.r + (endColor.r - startColor.r) * normalizedImportance,
  );
  const g = Math.round(
    startColor.g + (endColor.g - startColor.g) * normalizedImportance,
  );
  const b = Math.round(
    startColor.b + (endColor.b - startColor.b) * normalizedImportance,
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

export default function AchievementMap({
  navigateWithRefresh,
  variant = "original",
}) {
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

    // Parse URL parameters for lat/lng
    const urlParams = new URLSearchParams(window.location.search);
    const lat = parseFloat(urlParams.get("lat"));
    const lng = parseFloat(urlParams.get("lng"));

    // Default map center and zoom
    let initialCenter = [35, 20];
    let initialZoom = 2;

    // If valid lat/lng found in URL, use those coordinates
    if (!isNaN(lat) && !isNaN(lng)) {
      initialCenter = [lat, lng];
      initialZoom = 12; // Zoom in much closer when focusing on a specific location
    }

    // Initialize map
    const map = L.map(mapRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 1,
      maxZoom: 18, // Increased from 8 to 18 for much deeper zoom
      scrollWheelZoom: false,
      doubleClickZoom: false,
      dragging: false,
      touchZoom: false,
      zoomControl: false,
      attributionControl: false,
    });

    const usesSatelliteTiles = variant === "satellite";
    const tileUrl = usesSatelliteTiles
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const tileAttribution = usesSatelliteTiles
      ? "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics"
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    const tileOptions = {
      attribution: tileAttribution,
      maxZoom: 20,
      className: usesSatelliteTiles ? "satellite-map-tiles" : "dark-map-tiles",
    };
    if (!usesSatelliteTiles) tileOptions.subdomains = "abcd";

    L.tileLayer(tileUrl, tileOptions).addTo(map);

    if (variant !== "original") {
      const routeCoordinates = chronologicalActivities.map((activity) => [
        activity.mapData.coordinates.lat,
        activity.mapData.coordinates.lng,
      ]);

      L.polyline(routeCoordinates, {
        color: variant === "satellite" ? "#fde68a" : "#f59e0b",
        weight: variant === "satellite" ? 8 : 7,
        opacity: variant === "satellite" ? 0.08 : 0.1,
        smoothFactor: 0.75,
        interactive: false,
        className: "project-route-halo",
      }).addTo(map);

      L.polyline(routeCoordinates, {
        color: variant === "satellite" ? "#fef3c7" : "#fbbf24",
        weight: variant === "satellite" ? 1.15 : 1.5,
        opacity: variant === "satellite" ? 0.56 : 0.62,
        dashArray: variant === "satellite" ? "2 11" : "4 10",
        lineCap: "round",
        lineJoin: "round",
        smoothFactor: 0.75,
        interactive: false,
        className: "project-route-flow",
      }).addTo(map);
    }

    // If we're focusing on a specific location, add a highlight marker
    if (!isNaN(lat) && !isNaN(lng)) {
      const highlightIcon = L.divIcon({
        html: `<div class="highlight-marker">
                 <div class="highlight-pulse"></div>
                 <div class="highlight-center"></div>
               </div>`,
        iconSize: [40, 40],
        className: "highlight-div-icon",
      });

      L.marker([lat, lng], { icon: highlightIcon }).addTo(map);
    }

    // Custom icon for major achievements
    const createCustomIcon = (count, type, maxImportance) => {
      if (variant === "journeys") {
        const size = type === "major" ? 42 : type === "medium" ? 34 : 28;
        return L.divIcon({
          html: `<div class="journey-beacon ${type}"><span class="journey-beacon-core"></span><span class="journey-beacon-count">${count}</span></div>`,
          iconSize: [size, size],
          className: "custom-div-icon",
        });
      }

      if (variant === "satellite") {
        const size = type === "major" ? 46 : type === "medium" ? 38 : 30;
        return L.divIcon({
          html: `<div class="satellite-beacon ${type}"><span class="satellite-beacon-orbit"></span><span class="satellite-beacon-core"></span><span class="satellite-beacon-count">${count}</span></div>`,
          iconSize: [size, size],
          className: "custom-div-icon",
        });
      }

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
              marker.locationData.maxImportance,
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

        if (variant === "journeys") {
          return L.divIcon({
            html: `<div class="journey-cluster ${className}"><span>${totalCount}</span><i></i></div>`,
            className: "custom-cluster-icon",
            iconSize: [size, size],
          });
        }

        if (variant === "satellite") {
          return L.divIcon({
            html: `<div class="satellite-cluster ${className}"><span>${totalCount}</span><i></i></div>`,
            className: "custom-cluster-icon",
            iconSize: [size, size],
          });
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
        location.maxImportance,
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
  }, [achievements, variant]);

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

        .satellite-map-tiles {
          filter: saturate(0.46) brightness(0.46) contrast(1.24)
            hue-rotate(-8deg);
        }

        .dark-map-tiles {
          filter: saturate(0.88) contrast(1.05);
        }

        .project-route-flow {
          animation: projectRouteFlow 7s linear infinite;
          filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.5));
        }

        .project-route-halo {
          filter: blur(3px);
        }

        @keyframes projectRouteFlow {
          to {
            stroke-dashoffset: -84;
          }
        }

        .journey-beacon,
        .satellite-beacon {
          position: relative;
          display: grid;
          width: 100%;
          height: 100%;
          place-items: center;
          border-radius: 999px;
        }

        .journey-beacon::before,
        .satellite-beacon::before {
          position: absolute;
          inset: 2px;
          border: 1px solid rgba(254, 243, 199, 0.74);
          border-radius: inherit;
          box-shadow:
            0 0 0 5px rgba(245, 158, 11, 0.1),
            0 0 24px rgba(245, 158, 11, 0.72);
          content: "";
          animation: beaconBreath 2.8s ease-in-out infinite;
        }

        .journey-beacon-core,
        .satellite-beacon-core {
          position: absolute;
          width: 44%;
          height: 44%;
          border: 1px solid #fff7d6;
          border-radius: inherit;
          background: radial-gradient(
            circle at 35% 30%,
            #fff7d6,
            #f59e0b 55%,
            #9a3412
          );
          box-shadow: 0 0 14px rgba(251, 191, 36, 0.92);
        }

        .journey-beacon-count,
        .satellite-beacon-count {
          position: relative;
          z-index: 2;
          color: #111827;
          font-size: 9px;
          font-weight: 900;
          text-shadow: 0 1px rgba(255, 255, 255, 0.3);
        }

        .satellite-beacon::before {
          border-color: rgba(224, 242, 254, 0.9);
          box-shadow:
            0 0 0 6px rgba(56, 189, 248, 0.1),
            0 0 30px rgba(125, 211, 252, 0.82);
        }

        .satellite-beacon-core {
          background: radial-gradient(
            circle at 35% 30%,
            #ffffff,
            #fde68a 45%,
            #38bdf8
          );
          box-shadow: 0 0 16px rgba(186, 230, 253, 0.95);
        }

        .satellite-beacon-orbit {
          position: absolute;
          width: 125%;
          height: 52%;
          border: 1px solid rgba(186, 230, 253, 0.58);
          border-radius: 50%;
          transform: rotate(-24deg);
        }

        @keyframes beaconBreath {
          0%,
          100% {
            opacity: 0.58;
            transform: scale(0.86);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        .journey-cluster,
        .satellite-cluster {
          position: relative;
          display: grid;
          width: 100%;
          height: 100%;
          place-items: center;
          border: 1px solid rgba(254, 243, 199, 0.84);
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.82);
          box-shadow:
            inset 0 0 18px rgba(245, 158, 11, 0.25),
            0 0 0 6px rgba(245, 158, 11, 0.1),
            0 0 32px rgba(245, 158, 11, 0.55);
          color: #fef3c7;
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          font-weight: 900;
        }

        .journey-cluster i,
        .satellite-cluster i {
          position: absolute;
          inset: -7px;
          border: 1px dashed rgba(251, 191, 36, 0.38);
          border-radius: inherit;
          animation: orbitCluster 12s linear infinite;
        }

        .satellite-cluster {
          border-color: rgba(224, 242, 254, 0.9);
          background: rgba(2, 6, 23, 0.78);
          box-shadow:
            inset 0 0 20px rgba(56, 189, 248, 0.25),
            0 0 0 7px rgba(56, 189, 248, 0.09),
            0 0 38px rgba(125, 211, 252, 0.62);
          color: #fef3c7;
        }

        .satellite-cluster i {
          animation-name: orbitSatellite;
          border-color: rgba(186, 230, 253, 0.48);
          border-style: solid;
          transform: scaleY(0.52) rotate(-18deg);
        }

        @keyframes orbitCluster {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes orbitSatellite {
          to {
            transform: scaleY(0.52) rotate(342deg);
          }
        }

        /* Highlight marker styles for focused location */
        .highlight-marker {
          position: relative;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .highlight-pulse {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: rgba(255, 165, 0, 0.3);
          animation: highlightPulse 2s ease-in-out infinite;
        }

        .highlight-center {
          position: relative;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff6b35, #f7931e);
          border: 3px solid white;
          box-shadow: 0 0 15px rgba(255, 107, 53, 0.8);
          z-index: 2;
        }

        @keyframes highlightPulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.3;
          }
          100% {
            transform: scale(0.8);
            opacity: 1;
          }
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

        @media (prefers-reduced-motion: reduce) {
          .project-route-flow,
          .journey-beacon::before,
          .satellite-beacon::before,
          .journey-cluster i,
          .satellite-cluster i {
            animation: none;
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
        data-map-study={variant}
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

        {variant === "original" && (
          <div className="absolute right-10 top-20 z-[1000]">
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
            </div>
          </div>
        )}
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
