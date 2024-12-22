/* eslint-disable react/no-unescaped-entities */
"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
import { debounce } from "lodash";
import { Joystick } from "react-joystick-component";
import { getCitiesAndLocations, contestsAndActivities } from "../data/contestsAndActivities";
import { NAVBAR_HEIGHT, MAP_HEIGHT } from '../constants/layout';
import MarkerInfo from './MarkerInfo';
import { useTheme } from 'next-themes';

// Dynamically import the GlobeWrapper component without server-side rendering
const Globe = dynamic(() => import("../components/GlobeWrapper"), { ssr: false });

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
function createPolygon(lat, lng, objType, index) {
  // This produces a small diamond-shaped polygon around (lat, lng)
  const offset = 1.0;
  return {
    type: "Feature",
    properties: {
      objType,
      index
    },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [lng,        lat],
        [lng+offset, lat+offset],
        [lng+2*offset, lat],
        [lng+offset, lat-offset],
        [lng,        lat]
      ]]
    }
  };
}

export default function GlobeGame({ navigateWithRefresh, onProjectSelect }) {
  // State to ensure client-side rendering
  const [isClient, setIsClient] = useState(false);

  // Refs
  const globeContainerRef = useRef(null);
  const globeEl = useRef();
  // **Ref for Hover Timeout**
  const hoverTimeoutRef = useRef(null);

  // State for container dimensions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // State for marker interactions
  const [clickedMarker, setClickedMarker] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);

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
  const [triggeredMarkers, setTriggeredMarkers] = useState([]);

  const [isMobile, setIsMobile] = useState(false);
  const [showMap, setShowMap] = useState(true); // Initially, show map for non-mobile

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

    // The single plane polygon
    features.push(createPolygon(planePosition.lat, planePosition.lng, "plane", 9999));

    // Each coin as a polygon
    coins.forEach((coin, idx) => {
      features.push(createPolygon(coin.lat, coin.lng, "coin", idx));
    });

    return { type: "FeatureCollection", features };
  }, [gameMode, planePosition, coins]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const citiesAndLocations = useMemo(() => getCitiesAndLocations(), []);

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

  // Handle Joystick movement (for mobile)
  const handleJoystickMove = (event) => {
    const { x, y } = event;
    const speed = 0.2;

    let { lat, lng } = planePosition;
    if (y > 0) {
      lat += speed; // Up
      if (lat > 90) lat = 90;
    } else if (y < 0) {
      lat -= speed; // Down
      if (lat < -90) lat = -90;
    }
    if (x < 0) {
      lng -= speed; // Left
      if (lng < -180) lng += 360;
    } else if (x > 0) {
      lng += speed; // Right
      if (lng > 180) lng -= 360;
    }
    setPlanePosition({ lat, lng });
  };

  const handleJoystickStop = () => {
    setKeysPressed({
      w: false,
      a: false,
      s: false,
      d: false,
    });
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
        { lat: planePosition.lat, lng: planePosition.lng, altitude: 0.3 },
        1000
      );
    } else if (gameMode === "ticTacToe") {
      globeEl.current.pointOfView(
        { lat: 26, lng: 30, altitude: 0.4 },
        1000
      );
    } else {
      // Default
      globeEl.current.pointOfView(
        { lat: 41.0082, lng: 28.9784, altitude: 0.6 },
        1000
      );
    }
  }, [gameMode]);

  // Convert locations to marker format
  const colorPalette = ["blue", "green", "orange", "purple", "red", "yellow", "pink", "cyan", "lime", "magenta"];

  const markers = useMemo(() => {
    const baseMarkers = citiesAndLocations.map((location, index) => ({
      id: `city-${index}`,
      lat: location.coordinates.lat,
      lng: location.coordinates.lng,
      label: location.city,
      size: location.isMajorCity ? 20 : 15,
      color: location.isMajorCity ? "gold" : colorPalette[index % colorPalette.length],
      icon: "",
      animation: location.isMajorCity ? "pulsate" : "none",
      labelLat: location.coordinates.lat,
      labelLng: location.coordinates.lng,
      labelText: location.city,
      labelSize: 0.7,
      labelColor: location.maxImportance > 4 ? "rgba(255, 165, 0, 0.75)" : 'pink',
      activities: location.activities.map(activity => ({
        venue: activity.venue,
        date: activity.date,
        title: activity.title,
        slug: activity.slug,
      })),
    }));

    // Add a marker for Tic-Tac-Toe on Cyprus
    baseMarkers.push({
      id: "tic-tac-toe-marker",
      lat: 35.1264,
      lng: 33.4299,
      label: "Tic-Tac-Toe",
      size: 25,
      color: "white",
      icon: "🎮",
      labelLat: 35.1264,
      labelLng: 33.4299,
      labelText: "Tic-Tac-Toe",
      labelSize: 1,
      labelColor: "white",
    });

    // Only add the “Plane Collect Coins” marker if NOT currently in plane game
    if (gameMode !== "planeCollectCoins") {
      baseMarkers.push({
        id: "plane-collect-marker",
        lat: 34.0,
        lng: 33.0,
        label: "Plane Collect Coins",
        size: 25,
        color: "white",
        icon: "✈️",
        labelLat: 34.0,
        labelLng: 33.0,
        labelText: "Plane Collect Coins",
        labelSize: 1,
        labelColor: "white",
      });
    }

    return baseMarkers;
  }, [citiesAndLocations, gameMode]);

  // Arcs (just a demo)
  const arcs = useMemo(() => {
    // Example arcs from marker[i] to marker[i+1]
    // Adjust to your liking or remove if you don't need arcs
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
  }, [markers]);

  // Debounced hover handler
  const handlePointHover = useMemo(
    () =>
      debounce((point) => {
        if (!isFullscreen && point) {
          setHoveredMarker(point);
        }
      }, 100),
    [isFullscreen]
  );

  const handleCloseInfoWindow = () => {
    setHoveredMarker(null);
  };

  useEffect(() => {
    return () => {
      handlePointHover.cancel();
    };
  }, [handlePointHover]);

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
    setTriggeredMarkers([]);
    setHoveredMarker(null);
    setClickedMarker(null);
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

  // Handle plane movement with WASD
  useEffect(() => {
    if (gameMode !== "planeCollectCoins") return;

    const speed = 0.9; // degrees per frame
    const updatePlanePosition = () => {
      let { lat, lng } = planePosition;
      let moved = false;

      if (keysPressed.w) {
        lat = Math.min(lat + speed, 90);
        moved = true;
      }
      if (keysPressed.s) {
        lat = Math.max(lat - speed, -90);
        moved = true;
      }
      if (keysPressed.a) {
        lng -= speed;
        if (lng < -180) lng += 360;
        moved = true;
      }
      if (keysPressed.d) {
        lng += speed;
        if (lng > 180) lng -= 360;
        moved = true;
      }

      if (moved) {
        setPlanePosition({ lat, lng });

        // Move globe POV
        if (globeEl.current) {
          globeEl.current.pointOfView({ lat, lng, altitude: 2 }, 500);
        }

        // Check coin collection
        setCoins((prevCoins) => {
          return prevCoins.filter((coin) => {
            const dist = Math.sqrt((coin.lat - lat) ** 2 + (coin.lng - lng) ** 2);
            if (dist < 10) {
              setCollectedCoins((prev) => prev + 1);
              return false; // remove coin
            }
            return true;
          });
        });

        // Check for marker proximity
        markers.forEach((marker) => {
          const dist = Math.sqrt((marker.lat - lat) ** 2 + (marker.lng - lng) ** 2);
          if (dist < 2 && !triggeredMarkers.includes(marker.id)) {
            setClickedMarker(marker);
            setTriggeredMarkers((prev) => [...prev, marker.id]);
          }
        });
      }
      animationFrameRef.current = requestAnimationFrame(updatePlanePosition);
    };

    animationFrameRef.current = requestAnimationFrame(updatePlanePosition);
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameMode, keysPressed, planePosition, markers, triggeredMarkers]);

  // Keyboard event handlers
  useEffect(() => {
    if (gameMode !== "planeCollectCoins") return;
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        e.preventDefault();
        setKeysPressed((prev) => ({ ...prev, [key]: true }));
      }
    };
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        e.preventDefault();
        setKeysPressed((prev) => ({ ...prev, [key]: false }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameMode]);

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
    setTriggeredMarkers([]);
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
        altitude: 0.5
      };
    }
    // fallback
    return activities[0]
      ? { lat: activities[0].coordinates.lat, lng: activities[0].coordinates.lng, altitude: 0.5 }
      : { lat: 41.0082, lng: 28.9784, altitude: 0.5 };
  }, []);

  // On point click
  const onPointClick = (point) => {
    if (point.label === "Tic-Tac-Toe") {
      if (gameMode === "ticTacToe") {
        resetGame();
      } else {
        setGameMode("ticTacToe");
        setClickedMarker(null);
      }
    } else if (point.label === "Plane Collect Coins") {
      if (gameMode === "planeCollectCoins") {
        resetGame();
      } else {
        startPlaneGame();
        setClickedMarker(point);
      }
    } else {
      setClickedMarker(point);
    }
  };

  const { resolvedTheme } = useTheme();
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <div>
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

      {gameMode === "planeCollectCoins" && isMobile && (
        <div
          className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50"
          style={{ zIndex: 9999 }}
        >
          <Joystick
            size={100}
            baseColor="gray"
            stickColor="blue"
            move={handleJoystickMove}
            stop={handleJoystickStop}
          />
        </div>
      )}

      {!showMap && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShowMap(true)}
            className="px-4 py-2 border rounded hover:bg-blue-600 transition"
          >
            Show Map of Achievements
          </button>
        </div>
      )}

      {showMap && (
        <div
          ref={globeContainerRef}
          className="relative w-full h-[700px] sm:h-[800px] md:h-[900px] globe-container"
        >
          <div className={`text-white absolute ${isFullscreen ? 'top-4 right-16' : 'top-4 left-4'} bg-black bg-opacity-75 p-4 rounded shadow-lg z-50`}>
            <ul>
              <li>
                <span className="text-pink-500">Pink Text:</span> minor achievements
              </li>
              <li>
                <span className="text-yellow-500">Yellow Text:</span> at least one OK achievement
              </li>
            </ul>
            <p>
              ToDo: Fill the map with <span className="text-yellow-500">yellow</span>
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
                  globe.pointOfView({ lat, lng, altitude: 0.4 }, 1000);
                  window.history.replaceState({}, "", "/");
                }, 100);
              }
            }}
            initialView={initialLocation}
            width={isFullscreen ? window.innerWidth : dimensions.width}
            height={isFullscreen ? window.innerHeight : dimensions.height}
            enableZoom={!isNavigating}
            enablePanning={!isNavigating}
            enableRotate={!isNavigating}
            globeImageUrl={
              resolvedTheme === "dark"
                ? "//unpkg.com/three-globe/example/img/earth-night.jpg"
                : "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            }
            backgroundColor="rgba(0,0,0,0)"
            pointsData={markers}
            // Force a complete re-render of points each time
            pointsMerge={false}
            pointSize={(point) =>
              hoveredMarker && hoveredMarker.label === point.label
                ? point.size + 5
                : point.size
            }
            pointColor="color"
            pointLabel={(point) => `${point.icon || ""} ${point.label}`}
            labelsData={markers}
            labelLat={(point) => point.labelLat}
            labelLng={(point) => point.labelLng}
            labelText={(point) => point.labelText?.replace("ü", "ue")}
            labelSize={() => 0.3}
            labelColor={(point) => 
              point.maxImportance < 5 ? "pink" : (point.labelColor || "white")
            }
            labelResolution={2}
            pointAltitude={0.01}
            pointResolution={4}
            onPointClick={onPointClick}
            onPointHover={handlePointHover}
            arcsData={arcs}
            arcStartLat={(d) => d.srcAirport.lat}
            arcStartLng={(d) => d.srcAirport.lng}
            arcEndLat={(d) => d.dstAirport.lat}
            arcEndLng={(d) => d.dstAirport.lng}
            arcColor={(d) =>
              hoveredArc === d
                ? [`rgba(0, 255, 0, 0.9)`, `rgba(255, 0, 0, 0.9)`]
                : d.arcColor
            }
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={1500}
            onArcHover={setHoveredArc}
            // Show TicTacToe polygons OR plane polygons
            polygonsData={
              gameMode === "ticTacToe"
                ? sampleGeoJson.features
                : gameMode === "planeCollectCoins"
                ? planeGameGeoJson.features
                : []
            }
            polygonCapColor={(d) => {
              if (gameMode === "ticTacToe") {
                const idx = d.properties.index;
                if (idx === undefined) return "rgba(0,0,0,0)";
                if (gameBoard[idx]) {
                  // "X" => red, "O" => blue
                  return gameBoard[idx] === "X"
                    ? "rgba(255, 0, 0, 0.6)"
                    : "rgba(0, 0, 255, 0.6)";
                }
                return "rgba(255, 165, 0, 0.6)";
              } else if (gameMode === "planeCollectCoins") {
                return d.properties.objType === "plane"
                  ? "rgba(255, 0, 0, 0.6)"     // plane in red
                  : "rgba(255, 215, 0, 0.6)"; // coins in gold
              }
              return "rgba(0,0,0,0)";
            }}
            polygonSideColor={() => "rgba(0, 0, 0, 0.1)"}
            polygonStrokeColor={() => "#000"}
            polygonAltitude={(d) => {
              // For Tic-Tac-Toe, keep the slight raise
              if (gameMode === "ticTacToe" && d.properties.index !== undefined) {
                return gameBoard[d.properties.index] ? 0.02 : 0.01;
              }
              // For Plane/Coins, use a fixed altitude
              if (gameMode === "planeCollectCoins") {
                return 0.01;
              }
              return 0;
            }}
            polygonResolution={6}
            onPolygonClick={(polygon) => {
              if (gameMode === "ticTacToe") {
                const hexIndex = polygon.properties.index;
                handleHexagonClick(hexIndex);
              }
              // ignore clicks for plane polygons
            }}
            polygonsTransitionDuration={600}
          />

          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 bg-gray-700 text-white rounded-full p-2 opacity-75 hover:opacity-100 transition-opacity"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? "X" : "⛶"}
          </button>

          {/* Marker Info - Show in both fullscreen and non-fullscreen modes */}
          {((clickedMarker && isFullscreen) || (hoveredMarker && !isFullscreen)) && (
            <MarkerInfo
              marker={clickedMarker || hoveredMarker}
              onClose={() => isFullscreen ? setClickedMarker(null) : handleCloseInfoWindow()}
              navigateWithRefresh={navigateWithRefresh}
              isFullscreen={isFullscreen}
              isGameMode={gameMode !== false}
            >
              {gameMode === "planeCollectCoins" && (
                <div className="mt-10 mb-4 text-lg sm:text-xl font-semibold text-center">
                  <p>Plane game is ongoing!</p>
                  <p>Collected Coins: {collectedCoins} / 20</p>
                  <p className="mt-2">Time Elapsed: {(elapsedTime / 1000).toFixed(1)} seconds</p>
                  <button
                    onClick={resetGame}
                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
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
        </div>
      )}

      {/* Tic-Tac-Toe winner message */}
      {winner && gameMode === "ticTacToe" && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md mx-auto text-center">
            <h2 className="text-2xl font-semibold mb-4">
              {winner === "Draw"
                ? "It's a Draw!"
                : `Player ${winner} Wins!`}
            </h2>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={resetGame}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Plane Collect Coins - All coins collected message */}
      {gameMode === false && collectedCoins >= 20 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md mx-auto text-center">
            <h2 className="text-2xl font-semibold mb-4">
              Congratulations! You collected all coins in {(elapsedTime / 1000).toFixed(1)}s.
            </h2>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={resetGame}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
