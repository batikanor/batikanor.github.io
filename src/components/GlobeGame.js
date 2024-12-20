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
import { Joystick } from "react-joystick-component"; // Import Joystick
import { getCitiesAndLocations, contestsAndActivities } from "../data/contestsAndActivities"; // Adjust path as needed
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
  const [showMap, setShowMap] = useState(true); // Initially, do not show the map on mobile

  // Sample GeoJSON data for Egypt positioned polygons (3x3 grid)
  const sampleGeoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: [
        // Row 1
        {
          type: "Feature",
          properties: { name: "Egypt", index: 0 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [24.5, 24.5],
                [25.5, 25.4],
                [26.5, 24.5],
                [26.5, 23.6],
                [25.5, 22.7],
                [24.5, 23.6],
                [24.5, 24.5],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Egypt", index: 1 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [26.5, 24.5],
                [27.5, 25.4],
                [28.5, 24.5],
                [28.5, 23.6],
                [27.5, 22.7],
                [26.5, 23.6],
                [26.5, 24.5],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Egypt", index: 2 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [28.5, 24.5],
                [29.5, 25.4],
                [30.5, 24.5],
                [30.5, 23.6],
                [29.5, 22.7],
                [28.5, 23.6],
                [28.5, 24.5],
              ],
            ],
          },
        },
        // Row 2
        {
          type: "Feature",
          properties: { name: "Egypt", index: 3 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [24.5, 26.5],
                [25.5, 27.4],
                [26.5, 26.5],
                [26.5, 25.6],
                [25.5, 24.7],
                [24.5, 25.6],
                [24.5, 26.5],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Egypt", index: 4 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [26.5, 26.5],
                [27.5, 27.4],
                [28.5, 26.5],
                [28.5, 25.6],
                [27.5, 24.7],
                [26.5, 25.6],
                [26.5, 26.5],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Egypt", index: 5 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [28.5, 26.5],
                [29.5, 27.4],
                [30.5, 26.5],
                [30.5, 25.6],
                [29.5, 24.7],
                [28.5, 25.6],
                [28.5, 26.5],
              ],
            ],
          },
        },
        // Row 3
        {
          type: "Feature",
          properties: { name: "Egypt", index: 6 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [24.5, 28.5],
                [25.5, 29.4],
                [26.5, 28.5],
                [26.5, 27.6],
                [25.5, 26.7],
                [24.5, 27.6],
                [24.5, 28.5],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Egypt", index: 7 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [26.5, 28.5],
                [27.5, 29.4],
                [28.5, 28.5],
                [28.5, 27.6],
                [27.5, 26.7],
                [26.5, 27.6],
                [26.5, 28.5],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Egypt", index: 8 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [28.5, 28.5],
                [29.5, 29.4],
                [30.5, 28.5],
                [30.5, 27.6],
                [29.5, 26.7],
                [28.5, 27.6],
                [28.5, 28.5],
              ],
            ],
          },
        },
      ],
    }),
    []
  );

  const [isFullscreen, setIsFullscreen] = useState(false);
  const citiesAndLocations = useMemo(() => getCitiesAndLocations(), []);

  // Ensure the Globe is only rendered on the client-side
  // useEffect(() => {
  //   setIsClient(true);
  //   setIsMobile(/Mobi|Android/i.test(navigator.userAgent)); // Detect mobile devices
  //   setShowMap(!isMobile);
  // }, []);

  useEffect(() => {
    // Use matchMedia to detect mobile devices
    const mobileQuery = window.matchMedia("(max-width: 768px)"); // Adjust as per your mobile breakpoint
    const handleDeviceChange = (event) => {
      setIsMobile(event.matches);
      setShowMap(!event.matches); // Show map by default for non-mobile devices
    };
  
    // Initial check
    handleDeviceChange(mobileQuery);
  
    // Add listener for screen size changes
    mobileQuery.addEventListener("change", handleDeviceChange);
  
    // Clean up the listener on component unmount
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
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange); // Safari
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Handle Joystick movement
  const handleJoystickMove = (event) => {
    const { x, y } = event;
    const speed = 0.2;

    let { lat, lng } = planePosition;

    // Correctly handle up (y > 0) and down (y < 0)
    if (y > 0) {
      lat += speed; // Move up when y is positive
      if (lat > 90) lat = 90;
    } else if (y < 0) {
      lat -= speed; // Move down when y is negative
      if (lat < -90) lat = -90;
    }

    // Correctly handle left (x < 0) and right (x > 0)
    if (x < 0) {
      lng -= speed; // Move left when x is negative
      if (lng < -180) lng += 360;
    } else if (x > 0) {
      lng += speed; // Move right when x is positive
      if (lng > 180) lng -= 360;
    }

    setPlanePosition({ lat, lng });
  };

  // Handle Joystick stop (reset movement)
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
  }, [isClient]);

  // Set the point of view based on game mode - ONLY ON INITIAL MOUNT
  useEffect(() => {
    if (globeEl.current) {
      if (gameMode === "planeCollectCoins") {
        globeEl.current.pointOfView(
          { lat: planePosition.lat, lng: planePosition.lng, altitude: 0.3 },
          1000
        );
      } else if (gameMode === "ticTacToe") {
        globeEl.current.pointOfView(
          { lat: 26, lng: 30, altitude: 2 }, // Egypt coordinates
          1000
        );
      } else {
        globeEl.current.pointOfView(
          { lat: 41.0082, lng: 28.9784, altitude: 2 }, // Istanbul coordinates
          1000
        );
      }
    }
  }, [gameMode]); // Remove planePosition dependency

  // Convert locations to marker format for the globe component
  const colorPalette = ["blue", "green", "orange", "purple", "red", "yellow", "pink", "cyan", "lime", "magenta"]; // Add more colors if needed

  const markers = useMemo(() => {
    // console.log(citiesAndLocations);
    return citiesAndLocations.map((location, index) => ({
      id: index,
      lat: location.coordinates.lat,
      lng: location.coordinates.lng,
      label: location.city,
      size: location.isMajorCity ? 20 : 15,
      color: location.isMajorCity ? "gold" : colorPalette[index % colorPalette.length],
      // icon: location.isMajorCity ? "🏙️" : "📍",
      icon: '',
      animation: location.isMajorCity ? "pulsate" : "none",
      labelLat: location.coordinates.lat,
      labelLng: location.coordinates.lng,
      labelText: location.city,
      labelSize: 0.7, // Adjust label size
      labelColor: location.maxImportance > 4 ? "rgba(255, 165, 0, 0.75)" : 'pink',  // Optional: color for labels
      
      activities: location.activities.map(activity => ({
        venue: activity.venue,
        date: activity.date,
        title: activity.title,
        slug: activity.slug,
      })),
    }));
  }, [citiesAndLocations]);
  

  const arcs = useMemo(() => {
    return markers.slice(0, -1).map((marker, i) => ({
      airline: `Route ${i + 1}`,
      srcIata: marker.label,
      dstIata: markers[i + 1].label,
      srcAirport: { lat: marker.lat, lng: marker.lng },
      dstAirport: { lat: markers[i + 1].lat, lng: markers[i + 1].lng },
      arcColor: [`rgba(0, 255, 0, 0.3)`, `rgba(255, 0, 0, 0.3)`],
    }));
  }, [markers]);
  

  // Debounced hover handler to improve performance
  const handlePointHover = useMemo(
    () =>
      debounce((point) => {
        if (point) {
          setHoveredMarker(point);
        }
      }, 100),
    []
  );

  // Add a separate handler for closing the info window
  const handleCloseInfoWindow = () => {
    setHoveredMarker(null);
  };

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      handlePointHover.cancel();
    };
  }, [handlePointHover]);

  // Calculate the winner of the Tic Tac Toe game
  const calculateWinner = (board) => {
    const lines = [
      [0, 1, 2], // Rows
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6], // Columns
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8], // Diagonals
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

  // Handle polygon (hexagon) clicks for Tic-Tac-Toe
  const handleHexagonClick = (hexIndex) => {
    if (winner || gameBoard[hexIndex]) return; // Ignore if game over or cell occupied

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

  // Reset the game
  const resetGame = () => {
    setGameBoard(Array(9).fill(null));
    setCurrentPlayer("X");
    setWinner(null);
    setGameMode(false);
    setPlanePosition({ lat: 55.7558, lng: 37.6173 }); // Reset plane to Moscow
    setCoins([]);
    setCollectedCoins(0);
    setElapsedTime(0);
    setGameStartTime(null);
  };

  // Helper function to get the center of a polygon
  const getPolygonCenter = (geometry) => {
    const coordinates = geometry.coordinates[0];
    const latitudes = coordinates.map((coord) => coord[1]);
    const longitudes = coordinates.map((coord) => coord[0]);
    const lat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
    const lng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;
    return { lat, lng };
  };

  // Generate 20 random coins on the globe
  const generateRandomCoins = () => {
    const newCoins = [];
    for (let i = 0; i < 20; i++) {
      const lat = Math.random() * 180 - 90; // Latitude between -90 and 90
      const lng = Math.random() * 360 - 180; // Longitude between -180 and 180
      newCoins.push({ lat, lng, id: i });
    }
    setCoins(newCoins);
  };

  // Handle Plane Movement with WASD using Continuous Movement
  useEffect(() => {
    if (gameMode !== "planeCollectCoins") return;

    const speed = 0.9; // Degrees per frame

    const updatePlanePosition = () => {
      let { lat, lng } = planePosition;
      let moved = false;

      if (keysPressed.w) {
        lat += speed;
        if (lat > 90) lat = 90;
        moved = true;
      }
      if (keysPressed.s) {
        lat -= speed;
        if (lat < -90) lat = -90;
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
        if (globeEl.current) {
          globeEl.current.pointOfView(
            { lat, lng, altitude: 2 },
            500
          );
        }

        // Check for coin collection
        setCoins((prevCoins) => {
          const remainingCoins = prevCoins.filter((coin) => {
            const distance = Math.sqrt(
              Math.pow(coin.lat - lat, 2) +
              Math.pow(coin.lng - lng, 2)
            );
            if (distance < 10) { // Threshold distance for collection
              setCollectedCoins((prev) => prev + 1);
              return false; // Remove the coin
            }
            return true;
          });
          return remainingCoins;
        });

        // **New Logic: Check for Proximity to Markers**
        markers.forEach(marker => {
          const distance = Math.sqrt(
            Math.pow(marker.lat - lat, 2) +
            Math.pow(marker.lng - lng, 2)
          );
          if (distance < 2 && !triggeredMarkers.includes(marker.id)) {
            setClickedMarker(marker);
            setTriggeredMarkers(prev => [...prev, marker.id]);
          }
        });
      }

      animationFrameRef.current = requestAnimationFrame(updatePlanePosition);
    };

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(updatePlanePosition);

    // Clean up on unmount or game mode change
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameMode, keysPressed, planePosition, markers, triggeredMarkers]);

  // Keyboard event handlers for continuous movement
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

    // Clean up
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameMode]);

  // Plane Marker
  const planeMarker = useMemo(
    () => ({
      lat: planePosition.lat,
      lng: planePosition.lng,
      label: "You are flying the plane!",
      icon: "✈️", // Plane emoji
      size: 20, // Larger size for visibility
      color: "orange",
    }),
    [planePosition]
  );
  
  const coinMarkers = useMemo(
    () => coins.map((coin) => ({
      lat: coin.lat,
      lng: coin.lng,
      label: "A shiny coin to collect!",
      icon: "🪙", // Coin emoji
      size: 10, // Size for coins
      color: "yellow",
      id: coin.id,
    })),
    [coins]
  );
  
  // All markers including the plane and coins
  const allMarkers = useMemo(() => {
    if (gameMode === "planeCollectCoins") {
      return [...markers, planeMarker, ...coinMarkers];
    }
    return markers;
  }, [markers, gameMode, planeMarker, coinMarkers]);

  // Timer Effect
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

  // Start Plane Collect Coins Game
  const startPlaneGame = () => {
    setGameMode("planeCollectCoins");
    setCollectedCoins(0);
    setElapsedTime(0);
    setGameStartTime(Date.now());
    generateRandomCoins();
    setTriggeredMarkers([]); // Reset triggered markers
  };

  // Check if all coins are collected
  useEffect(() => {
    if (gameMode === "planeCollectCoins" && coins.length === 0 && collectedCoins === 20) {
      // Player has collected all coins
      setGameMode(false);
    }
  }, [coins, collectedCoins, gameMode]);

  // Get the initial location from your activities data
  const initialLocation = useMemo(() => {
    const activities = getCitiesAndLocations();
    // You can choose any activity, for example the first highlighted one
    const highlightedActivity = contestsAndActivities.find(activity => activity.highlighted);
    if (highlightedActivity && highlightedActivity.mapData) {
      return {
        lat: highlightedActivity.mapData.coordinates.lat,
        lng: highlightedActivity.mapData.coordinates.lng,
        altitude: 0.5
      };
    }
    // Fallback to first activity if no highlighted one exists
    return activities[0] ? {
      lat: activities[0].coordinates.lat,
      lng: activities[0].coordinates.lng,
      altitude: 0.5
    } : { lat: 41.0082, lng: 28.9784, altitude: 0.5 }; // Default to Istanbul if no activities
  }, []);

  // const handleProjectClick = (slug) => {
  //   const foundActivity = contestsAndActivities.find((activity) => activity.slug === slug);
  //   if (foundActivity) {
  //     setHoveredMarker(null); // Close the hover menu first
      
  //     // Call the parent's onProjectSelect to update expanded state
  //     onProjectSelect(foundActivity);
      
  //     // If in fullscreen, exit first
  //     if (isFullscreen && document.exitFullscreen) {
  //       document.exitFullscreen().then(() => {
  //         requestAnimationFrame(() => {
  //           requestAnimationFrame(() => {
  //             scrollToElement(slug, MAP_HEIGHT + NAVBAR_HEIGHT);
  //             // scrollToElement(slug, NAVBAR_HEIGHT + MAP_HEIGHT + 20);
  //           });
  //         });
  //       });
  //     } else {
  //       requestAnimationFrame(() => {
  //         requestAnimationFrame(() => {
  //           scrollToElement(slug, MAP_HEIGHT + NAVBAR_HEIGHT);
  //           // scrollToElement(slug, NAVBAR_HEIGHT + MAP_HEIGHT + 20);
  //         });
  //       });
  //     }
  //   }
  // };

  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const slug = hash.replace("#", "");
        const activity = contestsAndActivities.find(a => a.slug === slug);
        
        if (activity && activity.mapData && globeEl.current) {
          // Focus on the location with animation
          globeEl.current.pointOfView({
            lat: activity.mapData.coordinates.lat,
            lng: activity.mapData.coordinates.lng,
            altitude: 0.5
          }, 1000);
        }
      }
    };

    // Handle initial load
    handleHashChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [contestsAndActivities]);

  useEffect(() => {
    if (globeEl.current && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const lat = parseFloat(params.get('lat'));
      const lng = parseFloat(params.get('lng'));
      
      if (!isNaN(lat) && !isNaN(lng)) {
        globeEl.current.pointOfView(
          { lat, lng, altitude: 1 },
          1000
        );
        
        // Clear the URL parameters after focusing
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  const { resolvedTheme } = useTheme();

  return (
    
    <div>

      {/* Display Current Player or Instructions */}
      {gameMode === "ticTacToe" && !winner && (
        <div className="mb-4 text-lg sm:text-xl font-semibold">
          Current Player:{" "}
          <span
            className={`${
              currentPlayer === "X" ? "text-red-500" : "text-blue-500"
            }`}
          >
            {currentPlayer}
          </span>
        </div>
      )}

      {gameMode === "planeCollectCoins" && (
        <div className="mb-4 text-lg sm:text-xl font-semibold text-center">
          <br/>
          <p>
            Use <span className="font-mono">W</span> (North),{" "}
            <span className="font-mono">A</span> (West),{" "}
            <span className="font-mono">S</span> (South),{" "}
            <span className="font-mono">D</span> (East) to fly the plane.
          </p>
          <p className="mt-2">
            Collected Coins: {collectedCoins} / 20
          </p>
          <p className="mt-2">
            Time Elapsed: {(elapsedTime / 1000).toFixed(1)} seconds
          </p>
        </div>
      )}
      {gameMode === "planeCollectCoins" && isMobile && (
        <div
          className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50"
          style={{ zIndex: 9999 }}  // Set a very high z-index to appear on top
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
      {/* Show Button on Mobile to Display the Map */}
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

      {/* Spinnable Earth - Render only on the client */}
      { showMap &&(
        <div
          ref={globeContainerRef}
          className="relative w-full h-[700px] sm:h-[800px] md:h-[900px] globe-container"
        >
          <div className="bsolute top-4 left-4 bg-opacity-75 p-4 rounded shadow-lg z-50">
          {/* <h3 className="font-semibold mb-2">Legend</h3> */}
          <ul>
            <li>
              <span className="text-pink-500">Pink Text:</span> Cities with only minor achievements.
            </li>
            <li>
              <span className="text-yellow-500">Yellow Text:</span> Cities with at least one OK achievement.
            </li>
            {/* Add more legend items as needed */}
          </ul>
          <p>ToDo: Fill the map with <span className="text-yellow-500"> yellow</span></p>
        </div>
          <Globe
            onGlobeLoad={(globe) => {
              globeEl.current = globe;
              setIsNavigating(false);
              
              // Check URL parameters after globe is loaded
              const params = new URLSearchParams(window.location.search);
              const lat = parseFloat(params.get('lat'));
              const lng = parseFloat(params.get('lng'));
              
              if (!isNaN(lat) && !isNaN(lng)) {
                setTimeout(() => {
                  globe.pointOfView(
                    { lat, lng, altitude: 0.4 },
                    1000
                  );
                  
                  // Clear the URL parameters after focusing
                  window.history.replaceState({}, '', '/');
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
            pointsData={allMarkers}
            pointSize={(point) =>
              hoveredMarker && hoveredMarker.label === point.label
                ? point.size + 5
                : point.size
            }
            pointColor="color"
            // pointLabel={(point) => `${point.icon} ${point.label}`}
            pointLabel={(point) => {
              return `${point.icon} ${point.label}`;
            }}
            
            labelsData={allMarkers}
            labelLat={(point) => point.labelLat}
            labelLng={(point) => point.labelLng}
            labelText={(point) => point.labelText.replace("ü", "ue")}
            labelSize={(point) => 0.3}
            // labelColor={(point) => point.labelColor || "white"}
            // Inside the GlobeGame component, where you render the labels
            labelColor={(point) => point.maxImportance < 5 ? "pink" : (point.labelColor || "white")}
            // labelColor={(point) => "green"}

            labelResolution={2}
            // pointAltitude={0.05} // Increased altitude from 0.01 to 0.05
            pointAltitude={0.01} // Increased altitude from 0.01 to 0.05

            pointResolution={4} // Increased resolution for smoother markers
            onPointClick={(point, event) => {
              setClickedMarker(point);
            }}
            onPointHover={handlePointHover}
            // Arcs properties
            arcsData={arcs}
            arcStartLat={(d) => d.srcAirport.lat}
            arcStartLng={(d) => d.srcAirport.lng}
            arcEndLat={(d) => d.dstAirport.lat}
            arcEndLng={(d) => d.dstAirport.lng}
            // arcLabel={(d) => `${d.airline}: ${d.srcIata} → ${d.dstIata}`}
            // arcColor={(d) => d.arcColor}
            arcColor={(d) =>
              hoveredArc === d
                ? [`rgba(0, 255, 0, 0.9)`, `rgba(255, 0, 0, 0.9)`]
                : d.arcColor
            }
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={1500}
            onArcHover={(hoverArc) =>
              setHoveredArc(hoverArc) // Example state to handle hover effects
            }
            
            // Custom Polygons Layer
            polygonsData={gameMode === "ticTacToe" ? sampleGeoJson.features : []}
            polygonCapColor={(d) =>
              d.properties.index !== undefined
                ? gameBoard[d.properties.index]
                  ? gameBoard[d.properties.index] === "X"
                    ? "rgba(255, 0, 0, 0.6)" // Red for X
                    : "rgba(0, 0, 255, 0.6)" // Blue for O
                  : "rgba(255, 165, 0, 0.6)" // Orange for empty
                : "rgba(0, 0, 0, 0)" // Transparent
            }
            polygonSideColor={() => "rgba(0, 0, 0, 0.1)"}
            polygonStrokeColor={() => "#000"}
            polygonAltitude={(d) => {
              if (d.properties.index === undefined) return 0;

              // Extract the latitude from the polygon's geometry
              // Using the center latitude for better accuracy
              const { lat } = getPolygonCenter(d.geometry);
              const latitudeRadians = (lat * Math.PI) / 180;
              const scalingFactor = Math.cos(latitudeRadians);

              // Determine altitude based on game state and apply scaling
              return gameBoard[d.properties.index]
                ? 0.02 * scalingFactor
                : 0.01 * scalingFactor;
            }}
            polygonResolution={6} // Ensures hexagonal shape
            onPolygonClick={(polygon, event, coords) => {
              if (gameMode === "ticTacToe") {
                const hexIndex = polygon.properties.index;
                handleHexagonClick(hexIndex);
              }
            }}
            onPolygonHover={(polygon, prevPolygon) => {
              // Optional: Handle hover events (e.g., highlight)
            }}
          />

          {/* **Fullscreen Button** */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 bg-gray-700 text-white rounded-full p-2 opacity-75 hover:opacity-100 transition-opacity"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? "❎" : "⛶"}
          </button>

          {/* Modal Popup for Marker Click (Now Inside Fullscreen Container) */}
          {clickedMarker && isFullscreen && (
            <MarkerInfo
              marker={clickedMarker}
              onClose={() => setClickedMarker(null)}
              navigateWithRefresh={navigateWithRefresh}
              isFullscreen={true}
            />
          )}

          {/* Overlay for Game Symbols */}
          {gameMode === "ticTacToe" && (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {sampleGeoJson.features.map((feature, index) => {
                const { lat, lng } = getPolygonCenter(feature.geometry);
                const screenCoords = globeEl.current
                  ? globeEl.current.getScreenCoords(lat, lng)
                  : { x: 0, y: 0 };

                // Ensure screenCoords are valid and within the visible viewport
                if (
                  !screenCoords ||
                  screenCoords.x < 50 ||
                  screenCoords.x > dimensions.width - 50 ||
                  screenCoords.y < 50 ||
                  screenCoords.y > dimensions.height - 50
                )
                  return null;

                const style = {
                  position: "absolute",
                  left: `${screenCoords.x}px`,
                  top: `${screenCoords.y}px`,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none", // Prevent blocking interactions
                  color:
                    gameBoard[index] === "X" ? "red" : "blue",
                  fontSize: "32px", // Increased font size for better visibility
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

  {/* Side Bubble for Hovered Marker */}
  {hoveredMarker && (
    <MarkerInfo
      marker={hoveredMarker}
      onClose={handleCloseInfoWindow}
      navigateWithRefresh={navigateWithRefresh}
      isFullscreen={false}
    />
  )}


      {/* Winner Notification for Tic-Tac-Toe */}
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
              onClick={() => resetGame()}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Winner Notification for Plane Collect Coins */}
      {gameMode === false && collectedCoins >= 20 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md mx-auto text-center">
            <h2 className="text-2xl font-semibold mb-4">
              Congratulations! You collected all coins in {(elapsedTime / 1000).toFixed(1)} seconds.
            </h2>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => resetGame()}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
      {/* Toggle Buttons for Games */}
      <br/>
      { showMap &&(
      <div className="flex flex-wrap space-x-4 mb-4 justify-center">
        <button
          onClick={() => setGameMode("ticTacToe")}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-purple-600 transition m-2"
        >
          Play Tic-Tac-Toe in Egypt
        </button>
        <button
          onClick={startPlaneGame}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-green-600 transition m-2"
        >
          Play Plane Collect Coins (WIP)
        </button>
        {gameMode && (
          <button
            onClick={() => resetGame()}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition m-2"
          >
            Exit Game
          </button>
        )}
      </div>)}
    </div>
  );
}
