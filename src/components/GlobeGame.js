/* eslint-disable react/no-unescaped-entities */
"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import dynamic from "next/dynamic";
import { debounce } from "lodash";
import { getCitiesAndLocations, contestsAndActivities } from "../data/contestsAndActivities";
import { NAVBAR_HEIGHT, MAP_HEIGHT } from '../constants/layout';
import MarkerInfo from './MarkerInfo';
import { useTheme } from 'next-themes';

// Dynamically import the GlobeWrapper component without server-side rendering
const Globe = dynamic(() => import("../components/GlobeWrapper"), { ssr: false });

// Performance settings
const POLYGON_RESOLUTION = 6;         // Resolution for polygon rendering
const POINT_RESOLUTION = 8;           // Resolution for point markers
const TRANSITION_DURATION = 0;        // Duration for transitions (0 for instant)

// Globe view distances
const INITIAL_GLOBE_ALTITUDE = 2.5;   // Starting distance (far)
const MAIN_GLOBE_ALTITUDE = 0.5;      // Final distance (closer)
const INITIAL_ZOOM_DURATION = 2000;   // Duration of initial zoom in milliseconds

// Minimum and maximum altitude for flying objects (like planes and particles)
const MIN_ALTITUDE = 0.01;  // Very close to globe surface
const MAX_ALTITUDE = 0.5;   // Half a globe radius above surface

// GDP Choropleth map specific altitudes
const GDP_BASE_ALTITUDE = 0.015;     // Base height for GDP choropleth countries
const GDP_HOVER_ALTITUDE = 0.025;    // Height when hovering over GDP choropleth countries
const GDP_RICH_BONUS = 0.008;        // Additional height for high GDP countries

// Regular map altitudes
const COUNTRY_BASE_ALTITUDE = 0.02;  // Base height for regular country borders
const COUNTRY_HOVER_ALTITUDE = 0.02; // Height when hovering over countries

// Label heights for different types
const CITY_LABEL_HEIGHT = 0.025;     // Height for city labels
const CITY_LABEL_HOVER = 0.035;      // Height for hovered city labels
const GDP_LABEL_HEIGHT = 0.045;      // Height for GDP choropleth labels
const CONTROL_LABEL_HEIGHT = 0.03;   // Height for control buttons/labels
const GAME_LABEL_HEIGHT = 0.035;     // Height for game-related labels

// Point (marker) heights
const CITY_POINT_HEIGHT = 0.015;     // Height for city points/markers
const CITY_POINT_HOVER = 0.025;      // Height for hovered city points
const CONTROL_POINT_HEIGHT = 0.02;   // Height for control points
const GAME_POINT_HEIGHT = 0.04;      // Height for game-related points

// Game-specific heights and speeds
const PLANE_ALTITUDE = 0.03;         // Height for plane
const COIN_ALTITUDE = 0.02;          // Height for coins
const PLANE_COLLECTION_RADIUS = 1;   // Distance to collect coins
const PLANE_SPEED = 24.0;            // Base movement speed

// Marker dimensions
const MARKER_RADIUS = 4;             // Base radius for markers in pixels

// Path and arc parameters
const PATH_ALTITUDE = 0.1;           // Maximum height of paths/arcs relative to globe radius

// Animation and transition timings (in milliseconds)
const CAMERA_TRANSITION_TIME = 1000;  // Time for camera movements

// TicTacToe game heights
const TICTACTOE_BASE_HEIGHT = 0.02;  // Base height for empty TicTacToe cells
const TICTACTOE_MARKED_HEIGHT = 0.03; // Height for marked TicTacToe cells

const PATHS_INSTEAD_OF_ARCS = true;

const PATHS_CONFIG = {
  pointsPerPath: 200,         // Points per path
  maxDeviation: 0.1,         // Maximum lateral deviation in degrees
  maxHeight: 0.905,          // Maximum height
  minHeight: 0.001,          // Minimum height for paths
  minDistance: 5,           // Minimum distance between markers to create a path
  pathColor: ['rgba(0,255,0,0.6)', 'rgba(255,0,0,0.6)'], // Start and end colors for path gradient
  changeInterval: 800,  // Reduced from 4000 to 2000 ms for faster updates
  fadeOutDuration: 0,    // Set to 0 to remove fade out animation
  pathOpacity: 1,       // Base opacity for paths
};

const CONTROL_SPACING = 2; // Spacing between controls

const scrollToElement = (elementId, offset = 0) => {
  const element = document.getElementById(elementId);
  if (element) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
};

// Helper function to create a small polygon around lat/lng
function createPolygon(lat, lng, objType, index, size = 1, rotation = 0) {
  // Create a more visible polygon shape
  const offset = size;
  const coords = [];
  
  if (objType === "plane") {
    // Create a plane-shaped polygon (arrow-like)
    const front = 1.5 * offset;
    const width = offset;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const points = [
      [0, front],      // nose
      [width, -offset], // right wing
      [0, -offset/2],  // body indent
      [-width, -offset],// left wing
      [0, front]       // back to nose
    ];

    // Rotate and translate points
    coords.push(...points.map(([x, y]) => [
      lng + (x * cos - y * sin),
      lat + (x * sin + y * cos)
    ]));
  } else {
    // Default diamond shape for coins and other objects
    coords.push(
      [lng, lat],
      [lng + offset, lat + offset],
      [lng + 2 * offset, lat],
      [lng + offset, lat - offset],
      [lng, lat]
    );
  }

  return {
    type: "Feature",
    properties: {
      objType,
      index,
      rotation
    },
    geometry: {
      type: "Polygon",
      coordinates: [coords]
    }
  };
}

// Function to generate a deterministic color based on the importance
const getDeterministicColor = (importance) => {
  // Define start and end colors (red to green)
  const startColor = { r: 255, g: 100, b: 100 };    // Lighter red
  const endColor = { r: 100, g: 255, b: 100 };    // Lighter green

  // Normalize importance to a 0-1 scale (assuming max importance is 10)
  const normalizedImportance = Math.min(importance / 10, 1);

  // Interpolate between colors
  const r = Math.round(startColor.r + (endColor.r - startColor.r) * normalizedImportance);
  const g = Math.round(startColor.g + (endColor.g - startColor.g) * normalizedImportance);
  const b = Math.round(startColor.b + (endColor.b - startColor.b) * normalizedImportance);

  return `rgba(${r}, ${g}, ${b}, 1)`;
};

export default function GlobeGame({ navigateWithRefresh, onProjectSelect }) {
  // State to ensure client-side rendering
  const [isClient, setIsClient] = useState(false);
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const [isMapModeChanging, setIsMapModeChanging] = useState(false);
  const [mapMode, setMapMode] = useState('osm'); // 'osm' (default), 'day', 'night'

  // Refs
  const globeContainerRef = useRef(null);
  const globeEl = useRef();
  // **Ref for Hover Timeout**
  const hoverTimeoutRef = useRef(null);

  // State for container dimensions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // State for marker interactions
  const [clickedMarker, setClickedMarker] = useState(null);

  // Game mode state
  // Possible values: 'ticTacToe', 'planeCollectCoins', false
  const [gameMode, setGameMode] = useState(false);
  const [hoveredArc, setHoveredArc] = useState(null);

  // Tic-Tac-Toe game state
  const [gameBoard, setGameBoard] = useState(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState("X");
  const [winner, setWinner] = useState(null);

  // Plane Collect Coins game state
  const [planePosition, setPlanePosition] = useState({ lat: 55.7558, lng: 37.6173 }); // Moscow, Russia
  const [keysPressed, setKeysPressed] = useState({
    w: false,
    a: false,
    s: false,
    d: false,
  });
  const animationFrameRef = useRef();

  // Coins state
  const [coins, setCoins] = useState([]);
  const [collectedCoins, setCollectedCoins] = useState(0);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [isMobile, setIsMobile] = useState(false);
  const [showMap, setShowMap] = useState(true); // Initially, show map for non-mobile
  const { resolvedTheme } = useTheme();
  const [isNavigating, setIsNavigating] = useState(false);
  const [showBorders, setShowBorders] = useState(false);
  const [showChoropleth, setShowChoropleth] = useState(false);
  const [countryData, setCountryData] = useState({ features: [] });
  const [hoveredPolygon, setHoveredPolygon] = useState(null);
  const [planeRotation, setPlaneRotation] = useState(0);
  const [polygonTransitionDuration, setPolygonTransitionDuration] = useState(0);
  const [isInitialZoom, setIsInitialZoom] = useState(true);

  // Sample GeoJSON data for the Tic-Tac-Toe polygons
  const sampleGeoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: [
        // 9 polygons in a 3x3 arrangement
        ...[...Array(9)].map((_, i) => {
          // This is just an example layout for polygons near Egypt-like coords
          const row = Math.floor(i / 3);
          const col = i % 3;

          // Adjust these values to position your 3x3 grid
          const baseLat = 24.5 + row * 2;
          const baseLng = 24.5 + col * 2;

          return {
            type: "Feature",
            properties: { name: "Egypt", index: i },
            geometry: {
              type: "Polygon",
              coordinates: [[
                [baseLng,       baseLat],
                [baseLng+1,     baseLat+0.9],
                [baseLng+2,     baseLat],
                [baseLng+2,     baseLat-0.9],
                [baseLng+1,     baseLat-1.8],
                [baseLng,       baseLat-0.9],
                [baseLng,       baseLat]
              ]]
            }
          };
        })
      ]
    }),
    []
  );

  // Create polygons for plane & coins
  // This will be used only if gameMode === "planeCollectCoins"
  const planeGameGeoJson = useMemo(() => {
    if (gameMode !== "planeCollectCoins") {
      return { type: "FeatureCollection", features: [] };
    }

    const features = [];

    // Create the plane polygon with current rotation
    features.push(createPolygon(
      planePosition.lat,
      planePosition.lng,
      "plane",
      "plane",
      1.5, // larger size
      planeRotation // use the rotation state
    ));

    // Each coin as a polygon
    coins.forEach((coin) => {
      features.push(createPolygon(coin.lat, coin.lng, "coin", coin.id, 1));
    });

    return { type: "FeatureCollection", features };
  }, [gameMode, planePosition, planeRotation, coins]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const citiesAndLocations = useMemo(() => getCitiesAndLocations(), []);

  // Add this to your state declarations
  const [cloudOpacity, setCloudOpacity] = useState(0.25);
  const [particles, setParticles] = useState([]);
  // Add this to your useMemo for polygons
  const cloudControlPolygons = useMemo(() => {
    const baseCoords = { lat: 34, lng: 19 }; // Mediterranean position
    
    // Map mode controls
    const mapControls = ['osm', 'day', 'night'].map((mode, index) => ({
      type: "Feature",
      properties: { 
        type: "mapControl",
        mode: mode,
        isActive: mapMode === mode,
        label: `Map: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
        labelHeight: baseCoords.lat + 1.6
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [baseCoords.lng + (index * CONTROL_SPACING), baseCoords.lat + 1],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.5, baseCoords.lat + 1.5],
          [baseCoords.lng + (index * CONTROL_SPACING) + 1, baseCoords.lat + 1],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.5, baseCoords.lat + 0.5],
          [baseCoords.lng + (index * CONTROL_SPACING), baseCoords.lat + 1]
        ]]
      }
    }));

    // Cloud controls
    const cloudControls = [0, 0.25, 0.5, 1].map((opacity, index) => ({
      type: "Feature",
      properties: { 
        type: "cloudControl",
        opacity: opacity,
        isActive: opacity === cloudOpacity,
        label: `Cloud: ${(opacity * 100).toFixed(0)}%`,
        labelHeight: baseCoords.lat + 0.8
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [baseCoords.lng + (index * CONTROL_SPACING), baseCoords.lat],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.2, baseCoords.lat + 0.3],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.4, baseCoords.lat + 0.4],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.6, baseCoords.lat + 0.35],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.8, baseCoords.lat + 0.25],
          [baseCoords.lng + (index * CONTROL_SPACING) + 1.0, baseCoords.lat + 0.15],
          [baseCoords.lng + (index * CONTROL_SPACING) + 1.1, baseCoords.lat],
          [baseCoords.lng + (index * CONTROL_SPACING) + 1.0, baseCoords.lat - 0.15],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.8, baseCoords.lat - 0.25],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.6, baseCoords.lat - 0.3],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.4, baseCoords.lat - 0.25],
          [baseCoords.lng + (index * CONTROL_SPACING) + 0.2, baseCoords.lat - 0.15],
          [baseCoords.lng + (index * CONTROL_SPACING), baseCoords.lat]
        ]]
      }
    }));

    // Controls for borders and choropleth
    const controls = [
      {
        type: "Feature",
        properties: { 
          type: "borderControl",
          isActive: showBorders,
          label: `Borders: ${showBorders ? 'ON' : 'OFF'}`,
          labelHeight: baseCoords.lat + 0.8
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [baseCoords.lng + (4.5 * CONTROL_SPACING), baseCoords.lat],
            [baseCoords.lng + (4.5 * CONTROL_SPACING) + 0.5, baseCoords.lat + 0.5],
            [baseCoords.lng + (4.5 * CONTROL_SPACING) + 1, baseCoords.lat],
            [baseCoords.lng + (4.5 * CONTROL_SPACING) + 0.5, baseCoords.lat - 0.5],
            [baseCoords.lng + (4.5 * CONTROL_SPACING), baseCoords.lat]
          ]]
        }
      },
      {
        type: "Feature",
        properties: { 
          type: "choroplethControl",
          isActive: showChoropleth,
          label: `GDP per capita: ${showChoropleth ? 'ON' : 'OFF'}`,
          labelHeight: baseCoords.lat + 0.8
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [baseCoords.lng + (7 * CONTROL_SPACING), baseCoords.lat],
            [baseCoords.lng + (7 * CONTROL_SPACING) + 0.5, baseCoords.lat + 0.5],
            [baseCoords.lng + (7 * CONTROL_SPACING) + 1, baseCoords.lat],
            [baseCoords.lng + (7 * CONTROL_SPACING) + 0.5, baseCoords.lat - 0.5],
            [baseCoords.lng + (7 * CONTROL_SPACING), baseCoords.lat]
          ]]
        }
      }
    ];

    // Return all controls
    return [...mapControls, ...cloudControls, ...controls];
  }, [cloudOpacity, showBorders, showChoropleth, mapMode]);

  // Add this new state declaration
  const [citiesGeoJSON, setCitiesGeoJSON] = useState({ features: [] });

  // Add this useEffect after your existing useEffects
  useEffect(() => {
    const loadCitiesData = async () => {
      try {
        const response = await fetch('/data/cities.geojson');
        const data = await response.json();
        setCitiesGeoJSON(data);
      } catch (error) {
        console.error('Error loading cities GeoJSON:', error);
        setCitiesGeoJSON({ features: [] });
      }
    };
    loadCitiesData();
  }, []);

  // Modify your existing polygonsData useMemo to include city polygons
  const polygonsData = useMemo(() => {
    // Get cities with achievements, normalize names (convert ü to u)
    const citiesWithAchievements = citiesAndLocations.map(loc => 
      loc.city.toUpperCase().replace(/Ü/g, 'U')
    );
    
    // Filter and transform city polygons
    const cityPolygons = citiesGeoJSON.features
      .filter(feature => citiesWithAchievements.includes(
        feature.properties.NAME.replace(/Ü/g, 'U')
      ))
      .map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          type: 'city',
          importance: citiesAndLocations.find(loc => 
            loc.city.toUpperCase().replace(/Ü/g, 'U') === feature.properties.NAME.replace(/Ü/g, 'U')
          )?.maxImportance || 0
        }
      }));

    // Always include game controls
    const gameControls = [
      {
        type: "Feature",
        properties: { 
          type: "gameControl",
          game: "ticTacToe",
          isActive: gameMode === "ticTacToe",
          label: "Tic-Tac-Toe",
          labelHeight: 33 // Adjusted for Mediterranean position
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [10 + (9.5 * CONTROL_SPACING), 32], // Using same base coordinates + offset
            [10 + (9.5 * CONTROL_SPACING) + 0.5, 32.5],
            [10 + (9.5 * CONTROL_SPACING) + 1, 32],
            [10 + (9.5 * CONTROL_SPACING) + 0.5, 31.5],
            [10 + (9.5 * CONTROL_SPACING), 32]
          ]]
        }
      },
      {
        type: "Feature",
        properties: { 
          type: "gameControl",
          game: "planeCollectCoins",
          isActive: gameMode === "planeCollectCoins",
          label: "Plane Game",
          labelHeight: 33 // Adjusted for Mediterranean position
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [8 + (12 * CONTROL_SPACING), 32], // Using same base coordinates + further offset
            [8 + (12 * CONTROL_SPACING) + 0.5, 32.5],
            [8 + (12 * CONTROL_SPACING) + 1, 32],
            [8 + (12 * CONTROL_SPACING) + 0.5, 31.5],
            [8 + (12 * CONTROL_SPACING), 32]
          ]]
        }
      }
    ];

    if (gameMode === "ticTacToe") {
      return [...gameControls, ...sampleGeoJson.features];
    } else if (gameMode === "planeCollectCoins") {
      return [...gameControls, ...planeGameGeoJson.features];
    } else {
      const controls = cloudControlPolygons;
      if (showBorders || showChoropleth) {
        return [...controls, ...gameControls, ...cityPolygons, ...countryData.features];
      }
      return [...controls, ...gameControls, ...cityPolygons];
    }
  }, [gameMode, sampleGeoJson.features, planeGameGeoJson.features, cloudControlPolygons, showBorders, showChoropleth, countryData, citiesGeoJSON]);

  useEffect(() => {
    // Detect mobile devices
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const handleDeviceChange = (event) => {
      setIsMobile(event.matches);
      setShowMap(!event.matches);
    };
    handleDeviceChange(mobileQuery);
    mobileQuery.addEventListener("change", handleDeviceChange);
    return () => {
      mobileQuery.removeEventListener("change", handleDeviceChange);
    };
  }, []);

  // **Fullscreen Toggle Function**
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (globeContainerRef.current.requestFullscreen) {
        globeContainerRef.current.requestFullscreen();
      } else if (globeContainerRef.current.webkitRequestFullscreen) {
        globeContainerRef.current.webkitRequestFullscreen();
      } else if (globeContainerRef.current.msRequestFullscreen) {
        globeContainerRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // **Handle Fullscreen Change Events**
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement === globeContainerRef.current) {
        setIsFullscreen(true);
      } else {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Add ref for joystick
  const joystickRef = useRef(null);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Move colorPalette up here, before markers
  const colorPalette = ["blue", "green", "orange", "purple", "red", "yellow", "pink", "cyan", "lime", "magenta"];

  // Now markers can use the deterministic color
  const markers = useMemo(() => {
    // Show markers for ALL cities, not just those without polygons
    const baseMarkers = citiesAndLocations
      .map((location) => ({
        id: `city-${location.city}`,
        lat: location.coordinates.lat,
        lng: location.coordinates.lng,
        label: location.city,
        labelText: location.city.replace(/ü/g, 'ue'),
        size: location.maxImportance >= 5 ? MARKER_RADIUS * 7 : MARKER_RADIUS * 5,  // Using our global constant
        color: getDeterministicColor(location.maxImportance),
        icon: "",
        animation: location.maxImportance >= 5 ? "pulsate" : "none",
        labelLat: location.coordinates.lat,
        labelLng: location.coordinates.lng,
        labelSize: location.maxImportance >= 5 ? 1.2 : 1,
        labelColor: location.maxImportance >= 5 ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.95)',
        activities: location.activities.map(activity => ({
          venue: activity.venue,
          date: activity.date,
          title: activity.title,
          slug: activity.slug,
        })),
      }));

    return baseMarkers;
  }, [citiesAndLocations]);

  // Replace the Joystick component with this div
  const renderJoystick = () => {
    if (gameMode !== "planeCollectCoins" || !isMobile) return null;

    const handleTouchStart = (e) => {
      e.preventDefault();
      setIsDragging(true);
      
      // Reset joystick position when touch starts
      const touch = e.touches[0];
      const joystick = e.target;
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      setJoystickPosition({
        x: touch.clientX - centerX,
        y: touch.clientY - centerY
      });
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const joystick = e.target;
      const rect = joystick.getBoundingClientRect();
      
      // Calculate center of the joystick container
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate distance from center
      let deltaX = touch.clientX - centerX;
      let deltaY = touch.clientY - centerY;
      
      // Limit the joystick movement to a certain radius
      const radius = 40;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance > radius) {
        deltaX = (deltaX / distance) * radius;
        deltaY = (deltaY / distance) * radius;
      }
      
      setJoystickPosition({ x: deltaX, y: deltaY });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setJoystickPosition({ x: 0, y: 0 });
    };

    return (
      <div className="fixed z-50 select-none touch-none"
        style={{
          left: '50%',
          bottom: '100px',
          transform: 'translateX(-50%)',
        }}>
        {/* Joystick container */}
        <div
          ref={joystickRef}
          style={{
            width: '120px',
            height: '120px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            border: '2px solid rgba(255, 255, 255, 0.4)',
            position: 'relative',
            touchAction: 'none'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Joystick knob */}
          <div
            style={{
              width: '40px',
              height: '40px',
              background: 'rgba(255, 255, 255, 0.8)',
              borderRadius: '50%',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${joystickPosition.x}px), calc(-50% + ${joystickPosition.y}px))`,
              transition: isDragging ? 'none' : 'transform 0.2s'
            }}
          />
        </div>
      </div>
    );
  };

  // Get container dimensions after client renders
  useEffect(() => {
    if (globeContainerRef.current) {
      const { clientWidth, clientHeight } = globeContainerRef.current;
      setDimensions({ width: clientWidth, height: clientHeight });
    }
    setIsClient(true);
  }, []);

  // Set initial viewpoint each time gameMode changes
  useEffect(() => {
    if (!globeEl.current) return;

    if (gameMode === "planeCollectCoins") {
      globeEl.current.pointOfView(
        { 
          lat: planePosition.lat, 
          lng: planePosition.lng, 
          altitude: MAIN_GLOBE_ALTITUDE
        },
        CAMERA_TRANSITION_TIME
      );
    } else if (gameMode === "ticTacToe") {
      globeEl.current.pointOfView(
        { lat: 26, lng: 30, altitude: MAIN_GLOBE_ALTITUDE },
        CAMERA_TRANSITION_TIME
      );
    } else {
      // Default view
      globeEl.current.pointOfView(
        { lat: 41.0082, lng: 28.9784, altitude: MAIN_GLOBE_ALTITUDE },
        CAMERA_TRANSITION_TIME
      );
    }
  }, [gameMode, planePosition]);

  // Arcs (just a demo)
  const arcsAndPaths = useMemo(() => {
    if (!PATHS_INSTEAD_OF_ARCS) {
      // Original arcs logic
      const arcsArray = [];
      for (let i = 0; i < markers.length - 2; i++) {
        arcsArray.push({
          airline: `Route ${i + 1}`,
          srcIata: markers[i].label,
          dstIata: markers[i + 1].label,
          srcAirport: { lat: markers[i].lat, lng: markers[i].lng },
          dstAirport: { lat: markers[i + 1].lat, lng: markers[i + 1].lng },
          arcColor: [`rgba(0, 255, 0, 0.3)`, `rgba(255, 0, 0, 0.3)`],
        });
      }
      return arcsArray;
    } else {
      const pathsArray = [];
      
      if (PATHS_CONFIG.randomizeConnections) {
        // Create random connections
        for (let i = 0; i < PATHS_CONFIG.numPaths; i++) {
          const startIdx = Math.floor(Math.random() * markers.length);
          let endIdx;
          do {
            endIdx = Math.floor(Math.random() * markers.length);
          } while (startIdx === endIdx);

          const startMarker = markers[startIdx];
          const endMarker = markers[endIdx];

          // Calculate distance between markers
          const distance = Math.sqrt(
            Math.pow(startMarker.lat - endMarker.lat, 2) +
            Math.pow(startMarker.lng - endMarker.lng, 2)
          );

          // Only create path if markers are far enough apart
          if (distance >= PATHS_CONFIG.minDistance) {
            let currentLat = startMarker.lat;
            let currentLng = startMarker.lng;
            let currentAlt = 0;

            const path = [[currentLat, currentLng, currentAlt]];

            for (let j = 0; j < PATHS_CONFIG.pointsPerPath; j++) {
              const progress = j / PATHS_CONFIG.pointsPerPath;
              const latBias = (endMarker.lat - currentLat) * progress;
              const lngBias = (endMarker.lng - currentLng) * progress;

              currentLat += latBias + (Math.random() * 2 - 1) * PATHS_CONFIG.maxDeviation;
              currentLng += lngBias + (Math.random() * 2 - 1) * PATHS_CONFIG.maxDeviation;
              currentAlt += (Math.random() * 2 - 1) * PATHS_CONFIG.maxHeight;
              currentAlt = Math.max(0, currentAlt);

              path.push([currentLat, currentLng, currentAlt]);
            }

            path.push([endMarker.lat, endMarker.lng, 0]);
            pathsArray.push(path);
          }
        }
      } else {
        // Original sequential logic...
        for (let i = 0; i < markers.length - 2; i++) {
          const startLat = markers[i].lat;
          const startLng = markers[i].lng;
          const endLat = markers[i + 1].lat;
          const endLng = markers[i + 1].lng;

          let currentLat = startLat;
          let currentLng = startLng;
          let currentAlt = 0;

          const path = [];
          path.push([currentLat, currentLng, currentAlt]);

          // Generate random points between start and end
          for (let j = 0; j < PATHS_CONFIG.pointsPerPath; j++) {
            // Bias the random movement towards the destination
            const latBias = (endLat - currentLat) / (PATHS_CONFIG.pointsPerPath - j);
            const lngBias = (endLng - currentLng) / (PATHS_CONFIG.pointsPerPath - j);

            currentLat += latBias + (Math.random() * 2 - 1) * PATHS_CONFIG.maxDeviation;
            currentLng += lngBias + (Math.random() * 2 - 1) * PATHS_CONFIG.maxDeviation;
            currentAlt += (Math.random() * 2 - 1) * PATHS_CONFIG.maxHeight;
            currentAlt = Math.max(0, currentAlt);

            path.push([currentLat, currentLng, currentAlt]);
          }

          // Ensure the path ends at the destination
          path.push([endLat, endLng, 0]);
          pathsArray.push(path);
        }
      }
      return pathsArray;
    }
  }, [markers, PATHS_INSTEAD_OF_ARCS]);

  const handleCloseInfoWindow = () => {
    setClickedMarker(null);
  };

  // Simplified point click handler
  const onPointClick = (point) => {
    if (point) {
      setClickedMarker(point);
    }
  };

  // Calculate the winner of Tic Tac Toe
  const calculateWinner = (board) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (let line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  };

  // Handle polygon click for Tic-Tac-Toe
  const handleHexagonClick = (hexIndex) => {
    if (winner || gameBoard[hexIndex]) return;
    const newBoard = [...gameBoard];
    newBoard[hexIndex] = currentPlayer;
    setGameBoard(newBoard);

    const gameWinner = calculateWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
    } else if (!newBoard.includes(null)) {
      setWinner("Draw");
    } else {
      setCurrentPlayer(currentPlayer === "X" ? "O" : "X");
    }
  };

  const resetGame = () => {
    setGameBoard(Array(9).fill(null));
    setCurrentPlayer("X");
    setWinner(null);
    setGameMode(false);
    setPlanePosition({ lat: 55.7558, lng: 37.6173 });
    setCoins([]);
    setCollectedCoins(0);
    setElapsedTime(0);
    setGameStartTime(null);
    setClickedMarker(null);
    setPolygonTransitionDuration(0);
  };

  // Helper for polygon center
  const getPolygonCenter = (geometry) => {
    const coords = geometry.coordinates[0];
    const latitudes = coords.map((c) => c[1]);
    const longitudes = coords.map((c) => c[0]);
    const lat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
    const lng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;
    return { lat, lng };
  };

  // Generate random coins for plane game
  const generateRandomCoins = () => {
    const newCoins = [];
    for (let i = 0; i < 20; i++) {
      const lat = Math.random() * 180 - 90;
      const lng = Math.random() * 360 - 180;
      newCoins.push({ lat, lng, id: `coin-${i}` });
    }
    setCoins(newCoins);
  };

  // Modify the state declarations
  const [pathState, setPathState] = useState({
    currentCityIndex: 0,
    currentPath: null
  });

  // Replace generateNewPaths function
  const generateNewPaths = useCallback(() => {
    const locations = citiesAndLocations;
    
    setPathState(prevState => {
      // Get current start city
      const startLocation = locations[prevState.currentCityIndex];
      
      // Get random end city (different from start)
      let endIdx;
      do {
        endIdx = Math.floor(Math.random() * locations.length);
      } while (endIdx === prevState.currentCityIndex);
      
      const endLocation = locations[endIdx];
      
      // Create path between current city and random next city
      let currentLat = startLocation.coordinates.lat;
      let currentLng = startLocation.coordinates.lng;
      let currentAlt = PATHS_CONFIG.minHeight;
      
      const path = [];
      path.push([currentLat, currentLng, currentAlt]);
      
      // Generate points between start and end
      for (let j = 0; j < PATHS_CONFIG.pointsPerPath; j++) {
        const progress = j / PATHS_CONFIG.pointsPerPath;
        const latBias = (endLocation.coordinates.lat - currentLat) * progress;
        const lngBias = (endLocation.coordinates.lng - currentLng) * progress;
        
        currentLat += latBias + (Math.random() * 2 - 1) * PATHS_CONFIG.maxDeviation;
        currentLng += lngBias + (Math.random() * 2 - 1) * PATHS_CONFIG.maxDeviation;
        currentAlt = PATHS_CONFIG.minHeight + Math.sin(progress * Math.PI) * PATHS_CONFIG.maxHeight;
        
        path.push([currentLat, currentLng, currentAlt]);
      }
      
      path.push([endLocation.coordinates.lat, endLocation.coordinates.lng, PATHS_CONFIG.minHeight]);
      
      return {
        currentCityIndex: endIdx,
        currentPath: path
      };
    });
  }, [citiesAndLocations]);

  // Modify the useEffect for path generation
  useEffect(() => {
    if (!PATHS_INSTEAD_OF_ARCS || gameMode) return;

    // Initial path generation
    generateNewPaths();

    // Set up interval for path regeneration
    const interval = setInterval(generateNewPaths, PATHS_CONFIG.changeInterval);

    return () => clearInterval(interval);
  }, [generateNewPaths, gameMode]);

  // Add these constants at the top of your component
  const ACCELERATION = 0.02;
  const DECELERATION = 0.98;
  const MAX_SPEED = 1;

  // Add these refs at the top with other refs
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const planePositionRef = useRef({ lat: 55.7558, lng: 37.6173 });
  const lastUpdateTime = useRef(performance.now());
  const frameId = useRef(null);

  // Replace the keyboard event handlers useEffect and plane movement useEffect with this new version
  useEffect(() => {
    if (gameMode !== "planeCollectCoins") return;

    let keys = { w: false, a: false, s: false, d: false };
    let frameId = null;
    let lastTime = performance.now();

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        e.preventDefault();
        keys[key] = true;
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        e.preventDefault();
        keys[key] = false;
      }
    };

    const updatePlanePosition = () => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Calculate movement direction
      let moveX = 0;
      let moveY = 0;

      if (keys.w) moveY += 1;
      if (keys.s) moveY -= 1;
      if (keys.a) moveX -= 1;
      if (keys.d) moveX += 1;

      // Add joystick input for mobile
      if (isDragging && (joystickPosition.x !== 0 || joystickPosition.y !== 0)) {
        moveX += joystickPosition.x / 40;
        moveY -= joystickPosition.y / 40;
      }

      // Only update if there's movement
      if (moveX !== 0 || moveY !== 0) {
        // Calculate angle and update rotation
        const angle = Math.atan2(moveY, moveX);
        const newRotation = (angle * (180 / Math.PI)) - 90;
        setPlaneRotation(newRotation);

        // Calculate new position with increased speed
        const speed = PLANE_SPEED * deltaTime;
        let newLat = planePosition.lat + moveY * speed;
        let newLng = planePosition.lng + moveX * speed;

        // Wrap around longitude
        if (newLng > 180) newLng -= 360;
        if (newLng < -180) newLng += 360;

        // Clamp latitude
        newLat = Math.max(-85, Math.min(85, newLat));

        // Update position
        setPlanePosition({ lat: newLat, lng: newLng });

        // Check coin collection
        setCoins(prevCoins => {
          const remainingCoins = prevCoins.filter(coin => {
            const dist = Math.sqrt(
              Math.pow(coin.lat - newLat, 2) + 
              Math.pow(coin.lng - newLng, 2)
            );
            if (dist < PLANE_COLLECTION_RADIUS) {
              setCollectedCoins(prev => prev + 1);
              return false;
            }
            return true;
          });
          return remainingCoins;
        });
      }

      frameId = requestAnimationFrame(updatePlanePosition);
    };

    // Add event listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Start animation loop
    frameId = requestAnimationFrame(updatePlanePosition);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [gameMode, planePosition, isDragging, joystickPosition]);

  // Add this function to create particle effects
  const createCoinCollectionEffect = (lat, lng) => {
    const newParticles = Array.from({ length: 10 }, () => ({
      id: Math.random(),
      lat,
      lng,
      velocity: {
        x: (Math.random() - 0.5) * 0.2,
        y: (Math.random() - 0.5) * 0.2
      },
      life: 1
    }));

    setParticles(prev => [...prev, ...newParticles]);
  };

  // Add particle animation effect
  useEffect(() => {
    if (particles.length === 0) return;

    const updateParticles = () => {
      setParticles(prev => 
        prev.map(p => ({
          ...p,
          lat: p.lat + p.velocity.y,
          lng: p.lng + p.velocity.x,
          life: p.life - 0.02
        })).filter(p => p.life > 0)
      );
    };

    const particleInterval = setInterval(updateParticles, 16);
    return () => clearInterval(particleInterval);
  }, [particles]);

  // Timer
  useEffect(() => {
    let timerInterval;
    if (gameMode === "planeCollectCoins") {
      if (!gameStartTime) {
        setGameStartTime(Date.now());
      }
      timerInterval = setInterval(() => {
        setElapsedTime(Date.now() - (gameStartTime || Date.now()));
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [gameMode, gameStartTime]);

  // Start plane game
  const startPlaneGame = () => {
    setGameMode("planeCollectCoins");
    setCollectedCoins(0);
    setElapsedTime(0);
    setGameStartTime(Date.now());
    generateRandomCoins();
  };

  // Check if all coins collected
  useEffect(() => {
    if (gameMode === "planeCollectCoins" && coins.length === 0 && collectedCoins === 20) {
      // Player got them all
      setGameMode(false);
    }
  }, [coins, collectedCoins, gameMode]);

  // Find an initial location from your data
  const initialLocation = useMemo(() => {
    const activities = getCitiesAndLocations();
    const highlighted = contestsAndActivities.find(a => a.highlighted);
    if (highlighted && highlighted.mapData) {
      return {
        lat: highlighted.mapData.coordinates.lat,
        lng: highlighted.mapData.coordinates.lng,
        altitude: isInitialZoom ? INITIAL_GLOBE_ALTITUDE : MAIN_GLOBE_ALTITUDE
      };
    }
    // fallback
    return activities[0]
      ? { lat: activities[0].coordinates.lat, lng: activities[0].coordinates.lng, altitude: isInitialZoom ? INITIAL_GLOBE_ALTITUDE : MAIN_GLOBE_ALTITUDE }
      : { lat: 41.0082, lng: 28.9784, altitude: isInitialZoom ? INITIAL_GLOBE_ALTITUDE : MAIN_GLOBE_ALTITUDE };
  }, [isInitialZoom]);

  // Add this new function near your other handlers
  const handleGlobeTouch = (event) => {
    if (!gameMode === "planeCollectCoins" || !isFullscreen || !isMobile) return;

    // Get touch coordinates relative to the globe container
    const globeRect = globeContainerRef.current.getBoundingClientRect();
    const centerX = globeRect.width / 2;
    const centerY = globeRect.height / 2;
    
    // Calculate direction based on touch position relative to center
    const touchX = event.touches[0].clientX - globeRect.left;
    const touchY = event.touches[0].clientY - globeRect.top;
    
    // Calculate direction vector
    const dirX = touchX - centerX;
    const dirY = centerY - touchY; // Inverted because Y grows downward in screen coords
    
    // Normalize the vector
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    const normalizedX = dirX / length;
    const normalizedY = dirY / length;
    
    // Update plane position
    const speed = 0.5;
    let { lat, lng } = planePosition;
    
    lng += normalizedX * speed;
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    
    lat += normalizedY * speed;
    if (lat > 90) lat = 90;
    if (lat < -90) lat = -90;
    
    setPlanePosition({ lat, lng });
    
    // Check coin collection (same logic as other movement handlers)
    setCoins((prevCoins) => {
      return prevCoins.filter((coin) => {
        const dist = Math.sqrt((coin.lat - lat) ** 2 + (coin.lng - lng) ** 2);
        if (dist < 10) {
          setCollectedCoins((prev) => prev + 1);
          return false;
        }
        return true;
      });
    });

    // Check for marker proximity
    markers.forEach((marker) => {
      const dist = Math.sqrt((marker.lat - lat) ** 2 + (marker.lng - lng) ** 2);
      if (dist < 2) {
        setClickedMarker(marker);
      }
    });
  };

  // Add a toggle button for mobile map visibility
  const toggleMap = () => {
    setShowMap(prev => !prev);
  };

  // Add this to your polygon click handler
  const handlePolygonClick = (polygon) => {
    if (polygon.properties.type === "city") {
      const cityData = citiesAndLocations.find(loc => 
        loc.city.toUpperCase().replace(/Ü/g, 'U') === polygon.properties.NAME.replace(/Ü/g, 'U')
      );
      if (cityData) {
        setClickedMarker({
          ...cityData,
          lat: polygon.geometry.coordinates[0][0][1], // Use first coordinate's latitude
          lng: polygon.geometry.coordinates[0][0][0], // Use first coordinate's longitude
          label: cityData.city,
          activities: cityData.activities
        });
      }
      return;
    }

    if (polygon.properties.type === "mapControl") {
      setIsMapModeChanging(true);
      setMapMode(polygon.properties.mode);
    } else if (polygon.properties.type === "cloudControl") {
      setCloudOpacity(polygon.properties.opacity);
    } else if (polygon.properties.type === "borderControl") {
      setShowBorders(prev => {
        const newValue = !prev;
        if (newValue) {
          setShowChoropleth(false);
          setPolygonTransitionDuration(0);
        }
        return newValue;
      });
    } else if (polygon.properties.type === "choroplethControl") {
      setShowChoropleth(prev => {
        const newValue = !prev;
        if (newValue) {
          setShowBorders(false);
          setPolygonTransitionDuration(1000);
        } else {
          setPolygonTransitionDuration(0);
        }
        return newValue;
      });
    } else if (polygon.properties.type === "gameControl") {
      const game = polygon.properties.game;
      if (game === "ticTacToe") {
        if (gameMode === "ticTacToe") {
          resetGame();
        } else {
          setGameMode("ticTacToe");
        }
      } else if (game === "planeCollectCoins") {
        if (gameMode === "planeCollectCoins") {
          resetGame();
        } else {
          startPlaneGame();
        }
      }
    } else if (gameMode === "ticTacToe") {
      handleHexagonClick(polygon.properties.index);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/ne_110m_admin_0_countries.geojson');
        const data = await response.json();
        setCountryData(data);
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
        setCountryData({ features: [] });
      }
    };
    loadData();
  }, []);

  const handlePolygonHover = (polygon) => {
    if (!polygon || polygon.properties?.type) return; // Ignore control polygons
    if (gameMode) return; // Ignore during games
    if (!showChoropleth && !showBorders) return; // Only show hover effects when choropleth or borders are active
    setHoveredPolygon(polygon);
  };

  return (
    <div className="relative w-full">
      {/* Loading overlay */}
      {showMap && (!isGlobeReady || isMapModeChanging) && (
        <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" style={{ height: '700px' }}>
          <div className="text-white text-xl">Loading Globe...</div>
        </div>
      )}

      {/* Move toggle button for mobile to top */}
      {isMobile && (
        <>
          <button
            onClick={toggleMap}
            className="py-2 px-4 font-bold text-lg rounded transition-colors duration-300 shadow-lg mx-auto block w-auto"
          >
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
          <p className=" mb-2 text-xs text-center mt-2">
            Desktop version is recommended.
          </p>
        </>
      )}

      {gameMode === "ticTacToe" && !winner && (
        <div className={`text-lg sm:text-xl font-semibold
          ${isFullscreen ? 'absolute top-40 right-16 bg-black bg-opacity-75 p-4 rounded' : 'mb-4'}`}>
          Current Player:{" "}
          <span className={currentPlayer === "X" ? "text-red-500" : "text-blue-500"}>
            {currentPlayer}
          </span>
        </div>
      )}

      {gameMode === "planeCollectCoins" && (
        <div className={`text-lg sm:text-xl font-semibold text-center 
          ${isFullscreen ? 'absolute top-40 right-16 bg-black bg-opacity-75 p-4 rounded' : 'mb-4'}`}>
          <br />
          <p>
            Use <span className="font-mono">W</span> (North),{" "}
            <span className="font-mono">A</span> (West),{" "}
            <span className="font-mono">S</span> (South),{" "}
            <span className="font-mono">D</span> (East) to fly.
          </p>
          <p className="mt-2">Collected Coins: {collectedCoins} / 20</p>
          <p className="mt-2">
            Time Elapsed: {(elapsedTime / 1000).toFixed(1)} seconds
          </p>
        </div>
      )}

      {showMap && (
        <div
          ref={globeContainerRef}
          className={`relative w-full h-[700px] sm:h-[800px] md:h-[900px] globe-container ${!isGlobeReady ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}
        >
          <div className={`text-white absolute ${isFullscreen ? 'top-4 right-16' : 'top-4 left-4'} bg-black bg-opacity-75 p-2 sm:p-4 rounded shadow-lg z-10 text-[10px] sm:text-sm md:text-base max-w-[200px] sm:max-w-none`}>
            <ul>
              <li>
                <span className="text-red-500">Red Markers:</span> Cities with minor achievements
              </li>
              <li>
                <span className="text-green-500">Green Markers:</span> Cities with major achievements
              </li>
              {showChoropleth && (
                <li>
                  <span className="text-red-500">Red Intensity:</span> GDP per capita
                </li>
              )}
            </ul>
            <p>
              ToDo: Fill the map with achievements
            </p>
          </div>

          <Globe
            onGlobeLoad={(globe) => {
              globeEl.current = globe;
              setIsNavigating(false);

              // check URL query params
              const params = new URLSearchParams(window.location.search);
              const lat = parseFloat(params.get("lat"));
              const lng = parseFloat(params.get("lng"));

              if (!isNaN(lat) && !isNaN(lng)) {
                setTimeout(() => {
                  globe.pointOfView({ lat, lng, altitude: MAIN_GLOBE_ALTITUDE }, INITIAL_ZOOM_DURATION);
                  window.history.replaceState({}, "", "/");
                }, 100);
              } else if (isInitialZoom) {
                // Start the initial zoom animation
                setTimeout(() => {
                  globe.pointOfView(
                    { 
                      ...initialLocation,
                      altitude: MAIN_GLOBE_ALTITUDE 
                    },
                    INITIAL_ZOOM_DURATION
                  );
                  setIsInitialZoom(false);
                }, 100);
              }

              // Set globe as ready after a short delay to ensure all components are loaded
              setTimeout(() => {
                setIsGlobeReady(true);
                setIsMapModeChanging(false);
              }, 500);
            }}
            key={mapMode} // Force complete remount when map mode changes
            initialView={initialLocation}
            width={isFullscreen ? window.innerWidth : dimensions.width}
            height={isFullscreen ? window.innerHeight : dimensions.height}
            enableZoom={true}
            enablePanning={!isNavigating}
            enableRotate={!isNavigating}
            globeImageUrl={mapMode === 'osm' ? null : mapMode === 'night' 
              ? "//unpkg.com/three-globe/example/img/earth-night.jpg" 
              : "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"}
            globeTileEngineUrl={mapMode === 'osm' 
              ? ((x, y, l) => `https://tile.openstreetmap.org/${l}/${x}/${y}.png`)
              : null}
            globeImageVisible={mapMode !== 'osm'}
            bumpImageUrl={mapMode === 'osm' ? null : "//unpkg.com/three-globe/example/img/earth-topology.png"}
            backgroundImageUrl={null}
            backgroundColor="rgba(0,0,0,0)"
            pointsData={markers}
            pointsMerge={false}
            pointSize={(point) => {
              if (clickedMarker && clickedMarker.label === point.label) {
                return point.size * 1.3; // 30% larger when clicked
              }
              return point.size;
            }}
            pointColor={(point) => {
              if (clickedMarker && clickedMarker.label === point.label) {
                // Brighter when clicked
                const color = point.color.match(/\d+/g);
                return mapMode === 'osm' 
                  ? `rgba(${color[0]}, ${Math.min(parseInt(color[1]) + 50, 255)}, ${color[2]}, 0.6)`
                  : `rgba(${color[0]}, ${Math.min(parseInt(color[1]) + 50, 255)}, ${color[2]}, 1)`
              }
              // Semi-transparent in OSM mode
              if (mapMode === 'osm') {
                const color = point.color.match(/\d+/g);
                return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6)`;
              }
              return point.color;
            }}
            pointLabel={(point) => `${point.icon || ""} ${point.label}`}
            labelsData={[
              ...markers,
              ...polygonsData.filter(d => d.properties?.type === "mapControl" ||
                                         d.properties?.type === "cloudControl" || 
                                         d.properties?.type === "borderControl" || 
                                         d.properties?.type === "choroplethControl" ||
                                         d.properties?.type === "gameControl")
            ]}
            labelLat={d => {
              if (d.properties?.type === "mapControl" ||
                  d.properties?.type === "cloudControl" || 
                  d.properties?.type === "borderControl" || 
                  d.properties?.type === "choroplethControl" ||
                  d.properties?.type === "gameControl") {
                return d.properties.labelHeight;
              }
              return d.labelLat;
            }}
            labelLng={d => {
              if (d.properties?.type === "mapControl" ||
                  d.properties?.type === "cloudControl" || 
                  d.properties?.type === "borderControl" || 
                  d.properties?.type === "choroplethControl" ||
                  d.properties?.type === "gameControl") {
                return d.geometry.coordinates[0][0][0];
              }
              return d.labelLng;
            }}
            labelText={d => {
              if (d.properties?.type === "mapControl" ||
                  d.properties?.type === "cloudControl" || 
                  d.properties?.type === "borderControl" || 
                  d.properties?.type === "choroplethControl" ||
                  d.properties?.type === "gameControl") {
                return d.properties.label;
              }
              return d.labelText;
            }}
            labelSize={d => {
              if (d.properties?.type === "gameControl") return 0.3; // Slightly larger for game controls
              if (d.properties?.type) return 0.2;
              return 0.3;
            }}
            labelColor={d => {
              if (d.properties?.type === "mapControl") {
                return mapMode === 'osm' ? "black" : (d.properties.isActive ? "purple" : "white");
              }
              if (d.properties?.type === "cloudControl" || 
                  d.properties?.type === "borderControl" || 
                  d.properties?.type === "choroplethControl") {
                return mapMode === 'osm' ? "black" : "white";
              }
              if (d.properties?.type === "gameControl") {
                return mapMode === 'osm' ? "black" : (d.properties.isActive ? "purple" : "white");
              }
              // For city markers, make transparent in OSM mode, white otherwise
              if (mapMode === 'osm') {
                return 'rgba(0, 0, 0, 0)'; // Transparent in OSM mode
              }
              return d.labelColor || "white";
            }}
            labelDotRadius={0}
            labelAltitude={(point) => {
              // For control labels (map mode, cloud controls, etc.)
              if (point.properties?.type === "mapControl" ||
                  point.properties?.type === "cloudControl" || 
                  point.properties?.type === "borderControl" || 
                  point.properties?.type === "choroplethControl") {
                return CONTROL_LABEL_HEIGHT;
              }

              // For game controls
              if (point.properties?.type === "gameControl") {
                return GAME_LABEL_HEIGHT;
              }

              // For GDP choropleth labels
              if (showChoropleth && point.properties?.GDP_MD_EST) {
                return GDP_LABEL_HEIGHT;
              }

              // For city markers
              if (clickedMarker && clickedMarker.label === point.label) {
                return CITY_LABEL_HOVER;
              }
              return CITY_LABEL_HEIGHT;
            }}
            pointAltitude={(point) => {
              // For control points
              if (point.properties?.type === "mapControl" ||
                  point.properties?.type === "cloudControl" || 
                  point.properties?.type === "borderControl" || 
                  point.properties?.type === "choroplethControl") {
                return CONTROL_POINT_HEIGHT;
              }

              // For game controls
              if (point.properties?.type === "gameControl") {
                return GAME_POINT_HEIGHT;
              }

              // For city markers
              if (clickedMarker && clickedMarker.label === point.label) {
                return CITY_POINT_HOVER;
              }
              return CITY_POINT_HEIGHT;
            }}
            pointResolution={POINT_RESOLUTION}
            pointTransitionDuration={TRANSITION_DURATION}
            onPointClick={onPointClick}
            {...(PATHS_INSTEAD_OF_ARCS ? {
              pathsData: pathState.currentPath ? [pathState.currentPath] : [],
              pathColor: () => ['rgba(0,255,0,0.6)', 'rgba(255,0,0,0.6)'],
              pathDashLength: 0.1,
              pathDashGap: 0.004,
              pathDashAnimateTime: 100000,
              pathPointAlt: pnt => Math.min(pnt[2] * 0.3, 0.005),
              pathTransitionDuration: TRANSITION_DURATION  // Reduced from 1000 to 500 ms for faster transitions
            } : {
              arcsData: arcsAndPaths,
              arcStartLat: (d) => d.srcAirport.lat,
              arcStartLng: (d) => d.srcAirport.lng,
              arcEndLat: (d) => d.dstAirport.lat,
              arcEndLng: (d) => d.dstAirport.lng,
              arcColor: (d) => hoveredArc === d
                ? [`rgba(0, 255, 0, 0.9)`, `rgba(255, 0, 0, 0.9)`]
                : d.arcColor,
              arcDashLength: 0.4,
              arcDashGap: 0.2,
              arcDashAnimateTime: 1500
            })}
            onArcHover={setHoveredArc}
            // Show TicTacToe polygons OR plane polygons
            polygonsData={polygonsData}
            polygonId={d => d.properties.index || d.properties.objType + '-' + d.properties.index}
            polygonsTransitionDuration={polygonTransitionDuration}
            polygonCapColor={(d) => {
              // Handle plane game polygons first
              if (d.properties.objType === "plane") {
                return `rgba(255, 69, 0, 0.8)`;
              }
              if (d.properties.objType === "coin") {
                return `rgba(255, 215, 0, ${0.6 + Math.sin(Date.now() / 300) * 0.3})`;
              }
              if (d.properties.objType === "particle") {
                return `rgba(255, 215, 0, ${d.properties.life})`;
              }

              // Handle city polygons
              if (d.properties.type === "city") {
                const importance = d.properties.importance;
                const color = getDeterministicColor(importance);
                // Make city polygons more opaque
                const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
                if (rgbaMatch) {
                  return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, 0.8)`; // Increased opacity to 0.8
                }
                return color;
              }

              // Handle control polygons
              if (d.properties.type === "mapControl") {
                return d.properties.isActive ? "purple" : "gray";
              }
              if (d.properties.type === "cloudControl") {
                return d.properties.isActive ? "orange" : "gray";
              }
              if (d.properties.type === "borderControl" || d.properties.type === "choroplethControl") {
                return d.properties.isActive ? "green" : "gray";
              }
              if (d.properties.type === "gameControl") {
                return d.properties.isActive ? "purple" : "gray";
              }

              // Handle borders mode
              if (showBorders && !showChoropleth && d.properties?.ISO_A2) {
                return `rgba(100, 100, 100, 0.3)`;  // Light gray for borders mode
              }

              // Handle choropleth coloring
              if (showChoropleth && d.properties?.GDP_MD_EST) {
                const gdpValue = d.properties.GDP_MD_EST;
                const popValue = d.properties.POP_EST || 1;
                const gdpPerCapita = gdpValue * 1000000 / popValue;
                
                // Create more distinct ranges for GDP per capita
                let intensity, redValue, greenValue;
                
                if (gdpPerCapita < 1000) {
                  intensity = 0.3;
                  redValue = 255;
                  greenValue = 200;
                } else if (gdpPerCapita < 5000) {
                  intensity = 0.4;
                  redValue = 220;
                  greenValue = 150;
                } else if (gdpPerCapita < 15000) {
                  intensity = 0.5;
                  redValue = 180;
                  greenValue = 100;
                } else if (gdpPerCapita < 30000) {
                  intensity = 0.6;
                  redValue = 140;
                  greenValue = 50;
                } else if (gdpPerCapita < 50000) {
                  intensity = 0.7;
                  redValue = 100;
                  greenValue = 25;
                } else {
                  intensity = 0.8;
                  redValue = 60;
                  greenValue = 0;
                }

                return `rgba(${redValue}, ${greenValue}, 0, ${intensity})`;
              }

              // Default color for controls
              if (d.properties?.type) {
                return 'gray';
              }

              // Default transparent for other cases
              return 'rgba(0, 0, 0, 0.1)';
            }}
            polygonSideColor={() => "rgba(0, 0, 0, 0.1)"}
            polygonStrokeColor={() => "#000"}
            polygonAltitude={(d) => {
              // Handle plane game altitude first
              if (d.properties.objType === "plane") {
                return PLANE_ALTITUDE;
              }
              if (d.properties.objType === "coin") {
                return COIN_ALTITUDE;
              }
              
              // Handle city polygons - keep them more visible
              if (d.properties.type === "city") {
                return hoveredPolygon === d ? CITY_POINT_HOVER : CITY_POINT_HEIGHT;
              }

              // Handle other polygon types
              if (gameMode === "ticTacToe" && d.properties.index !== undefined) {
                return gameBoard[d.properties.index] ? TICTACTOE_MARKED_HEIGHT : TICTACTOE_BASE_HEIGHT;
              }

              // Handle choropleth mode with GDP-based heights
              if (showChoropleth && d.properties?.GDP_MD_EST) {
                const gdpValue = d.properties.GDP_MD_EST;
                const popValue = d.properties.POP_EST || 1;
                const gdpPerCapita = gdpValue * 1000000 / popValue;
                
                // Add extra height for richer countries
                const gdpBonus = gdpPerCapita > 30000 ? GDP_RICH_BONUS : 0;
                
                return hoveredPolygon === d 
                  ? GDP_HOVER_ALTITUDE + gdpBonus 
                  : GDP_BASE_ALTITUDE + gdpBonus;
              }

              // Handle regular borders mode
              if (showBorders && d.properties?.ISO_A2) {
                return hoveredPolygon === d 
                  ? COUNTRY_HOVER_ALTITUDE 
                  : COUNTRY_BASE_ALTITUDE;
              }

              return MIN_ALTITUDE;
            }}
            polygonResolution={POLYGON_RESOLUTION}
            onPolygonClick={handlePolygonClick}
            onGlobeClick={handleGlobeTouch}
            onGlobeTouchStart={handleGlobeTouch}
            onGlobeTouchMove={handleGlobeTouch}
            cloudOpacity={cloudOpacity}
            onPolygonHover={handlePolygonHover}
            polygonLabel={(d) => {
              if (d.properties?.type === "city") {
                const cityData = citiesAndLocations.find(loc => 
                  loc.city.toUpperCase().replace(/Ü/g, 'U') === d.properties.NAME.replace(/Ü/g, 'U')
                );
                if (cityData) {
                  return `
                    <div class="bg-black bg-opacity-75 p-2 rounded">
                      <b>${cityData.city}</b><br />
                      ${cityData.activities.length} achievement${cityData.activities.length !== 1 ? 's' : ''}
                    </div>
                  `;
                }
              }
              if (d.properties?.type || gameMode) return null; // No labels for controls or during games
              if (!showChoropleth) return null;
              if (!d.properties?.ADMIN) return null;
              
              const gdpValue = d.properties?.GDP_MD_EST || 0;
              const popValue = d.properties?.POP_EST || 0;
              
              return `
                <div class="bg-black bg-opacity-75 p-2 rounded">
                  <b>${d.properties.ADMIN} ${d.properties.ISO_A2 ? `(${d.properties.ISO_A2})` : ''}</b><br />
                  GDP: <i>${gdpValue.toLocaleString()}</i> M$<br/>
                  Population: <i>${popValue.toLocaleString()}</i>
                </div>
              `;
            }}
          />

          {renderJoystick()}

          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 bg-gray-700 text-white rounded-full p-2 opacity-75 hover:opacity-100 transition-opacity"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? "X" : "⛶"}
          </button>

          {/* Marker Info - Click only */}
          {(clickedMarker || gameMode === "planeCollectCoins") && (
            <MarkerInfo
              marker={clickedMarker || {
                label: "Plane Game Status",
                description: "Collect all coins to win!"
              }}
              onClose={handleCloseInfoWindow}
              navigateWithRefresh={navigateWithRefresh}
              isFullscreen={isFullscreen}
              isGameMode={gameMode !== false}
            >
              {gameMode === "planeCollectCoins" && (
                <div className={`mt-4 text-center ${isMobile ? 'text-xs' : ''}`}>
                  <p>Plane game is ongoing!</p>
                  {!isMobile && (
                    <p className="mb-4">
                      Use <span className="font-mono">W</span> (North),{" "}
                      <span className="font-mono">A</span> (West),{" "}
                      <span className="font-mono">S</span> (South),{" "}
                      <span className="font-mono">D</span> (East) to fly.
                    </p>
                  )}
                  <p>Collected Coins: {collectedCoins} / 20</p>
                  <p className="mt-2">Time Elapsed: {(elapsedTime / 1000).toFixed(1)} seconds</p>
                  <button
                    onClick={resetGame}
                    className={`mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors ${isMobile ? 'text-xs' : 'text-sm sm:text-base'}`}
                  >
                    End Game
                  </button>
                </div>
              )}
              {gameMode === "ticTacToe" && (
                <div className="mt-10 mb-4 text-lg sm:text-xl font-semibold text-center">
                  <p>Tic-Tac-Toe game is ongoing!</p>
                  <button
                    onClick={resetGame}
                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    End Game
                  </button>
                </div>
              )}
            </MarkerInfo>
          )}

          {/* Overlay for TicTacToe symbols */}
          {gameMode === "ticTacToe" && (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {sampleGeoJson.features.map((feature, index) => {
                const { lat, lng } = getPolygonCenter(feature.geometry);
                const screen = globeEl.current
                  ? globeEl.current.getScreenCoords(lat, lng)
                  : { x: 0, y: 0 };

                if (
                  !screen ||
                  screen.x < 50 ||
                  screen.x > dimensions.width - 50 ||
                  screen.y < 50 ||
                  screen.y > dimensions.height - 50
                ) {
                  return null;
                }
                const style = {
                  position: "absolute",
                  left: screen.x + "px",
                  top: screen.y + "px",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  color: gameBoard[index] === "X" ? "red" : "blue",
                  fontSize: "32px",
                  fontWeight: "bold",
                  textShadow: "0 0 5px black",
                };
                return (
                  <div key={index} style={style}>
                    {gameBoard[index]}
                  </div>
                );
              })}
            </div>
          )}

          {/* Winner message - show for both mobile and desktop */}
          {winner && gameMode === "ticTacToe" && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[9999]">
              <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md mx-auto text-center">
                <h2 className="text-2xl text-white font-semibold mb-4">
                  {winner === "Draw"
                    ? "It's a Draw!"
                    : `Player ${winner} Wins!`}
                </h2>
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  onClick={resetGame}
                >
                  End Game
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plane Collect Coins - All coins collected message */}
      {gameMode === false && collectedCoins >= 20 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md mx-auto text-center">
            <h2 className="text-2xl text-white font-semibold mb-4">
              Congratulations! You collected all coins in {(elapsedTime / 1000).toFixed(1)}s.
            </h2>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={resetGame}
            >
              End Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
