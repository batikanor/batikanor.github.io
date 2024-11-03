/* eslint-disable react/no-unescaped-entities */

"use client";

import dynamic from "next/dynamic";
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import { debounce } from "lodash";
import Projects from "../components/Projects"; // Adjust path based on your folder structure
import CV from "./cv/page";
import { Joystick } from "react-joystick-component"; // Import Joystick
import { getCitiesAndLocations } from "../data/contestsAndActivities"; // Adjust path as needed

// Dynamically import the GlobeWrapper component without server-side rendering
const Globe = dynamic(() => import("../components/GlobeWrapper"), { ssr: false });

export default function Home() {
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
  useEffect(() => {
    setIsClient(true);
    setIsMobile(/Mobi|Android/i.test(navigator.userAgent)); // Detect mobile devices
  }, []);

  const navigateWithRefresh = (slug) => {
    const url = `${window.location.origin}${window.location.pathname}#${slug}`;
    window.location.href = url;
    window.location.reload(); // Forces a page refresh
  };
  
  // **Fullscreen Toggle Function**
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (globeContainerRef.current.requestFullscreen) {
        globeContainerRef.current.requestFullscreen();
      } else if (globeContainerRef.current.webkitRequestFullscreen) { // Safari
        globeContainerRef.current.webkitRequestFullscreen();
      } else if (globeContainerRef.current.msRequestFullscreen) { // IE11
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

  // Set the point of view based on game mode
  useEffect(() => {
    if (globeEl.current) {
      if (gameMode === "planeCollectCoins") {
        // Focus on plane's current position when Plane Collect Coins is active
        globeEl.current.pointOfView(
          { lat: planePosition.lat, lng: planePosition.lng, altitude: 0.3 },
          1000
        );
      } else if (gameMode === "ticTacToe") {
        // Focus on Egypt when Tic-Tac-Toe is active
        globeEl.current.pointOfView(
          { lat: 26, lng: 30, altitude: 2 }, // Egypt coordinates
          1000
        );
      } else {
        // Default view (Istanbul)
        globeEl.current.pointOfView(
          { lat: 41.0082, lng: 28.9784, altitude: 2 }, // Istanbul coordinates
          1000
        );
      }
    }
  }, [gameMode, planePosition]);

  // Convert locations to marker format for the globe component
  // Convert locations to marker format for the globe component, skipping any without coordinates
  // Convert locations to marker format for the globe component, skipping any without coordinates
  const colorPalette = ["blue", "green", "orange", "purple", "red", "yellow", "pink", "cyan", "lime", "magenta"]; // Add more colors if needed

  const markers = useMemo(() => {
    return citiesAndLocations.map((location, index) => ({
      id: index,
      lat: location.coordinates.lat,
      lng: location.coordinates.lng,
      label: location.city,
      size: 15,
      color: colorPalette[index % colorPalette.length], // Assign unique color for each city
      activities: location.activities.map(activity => ({
        venue: activity.venue,
        date: activity.date,
        title: activity.title,
        slug: activity.slug, // Add the slug here
      })),
    }));
  }, [citiesAndLocations]);
  
  // const markers = useMemo(
  //   () => [
  //     {
  //       id: 0,
  //       lat: 41.0082, // Istanbul
  //       lng: 28.9784,
  //       label: "School & Achievements in Istanbul",
  //       size: 15,
  //       color: "red",
  //       description: `School:<br/>- BSc Computer Engineering, Turkish-German University<br/><br/>Achievements in Istanbul:<br/>- Mentored Quantum Programming Workshop (2021)<br/>- 3rd Place at BESTIstanbul Big Data Solutions Hackathon (2019)`,
  //     },
  //     {
  //       id: 1,
  //       lat: 48.1351, // Munich
  //       lng: 11.582,
  //       label: "School & Achievements in Munich",
  //       size: 20,
  //       color: "blue",
  //       description: `School:<br/>- MSc Informatics, Technical University of Munich<br/><br/>Achievements in Munich:<br/>- 2nd Place at Bayer AI Innovation Hackathon (2024)<br/>- 1st Place at Thüga Solutions Hackathon (2024)<br/>- 2nd Place (team) & 1st Place (individual) at TUM AI Makeathon (2024)<br/>- 1st Place at EthMunich Hackathon (2023)`,
  //     },
  //     {
  //       id: 2,
  //       lat: 47.3769, // Zurich
  //       lng: 8.5417,
  //       label: "Achievements in Zurich",
  //       size: 20,
  //       color: "green",
  //       description: `Achievements:<br/>- 1st Place & Audience Award at SwissHacks (2024)`,
  //     },
  //     {
  //       id: 3,
  //       lat: 41.3851, // Barcelona
  //       lng: 2.1734,
  //       label: "Achievements in Barcelona",
  //       size: 20,
  //       color: "orange",
  //       description: `Achievements:<br/>- 3rd Place at HackUPC (Sponsor: Intersystems) (2024)`,
  //     },
  //     {
  //       id: 4,
  //       lat: 51.3397, // Leipzig
  //       lng: 12.3731,
  //       label: "Achievements in Leipzig",
  //       size: 20,
  //       color: "purple",
  //       description: `Achievements:<br/>- 2nd Place at DSAG Jahreskongress AI Ideathon Leipzig (2024)`,
  //     },
  //     {
  //       id: 5,
  //       lat: 49.0069, // Karlsruhe
  //       lng: 8.4037,
  //       label: "Achievements in Karlsruhe",
  //       size: 20,
  //       color: "yellow",
  //       description: `Achievements:<br/>- 1st Place at MSG Code & Create Hackathon (2023)`,
  //     },
  //     {
  //       id: 6,
  //       lat: 53.8655, // Lübeck
  //       lng: 10.6866,
  //       label: "Achievements in Lübeck",
  //       size: 20,
  //       color: "pink",
  //       description: `Achievements:<br/>- 2nd Place at Dräger Hackathon (2023)`,
  //     },
  //   ],
  //   []
  // );
  
  // Generate arcs between markers
  const arcs = useMemo(
    () =>
      markers.slice(0, -1).map((marker, i) => ({
        startLat: marker.lat,
        startLng: marker.lng,
        endLat: markers[i + 1].lat,
        endLng: markers[i + 1].lng,
        color: [marker.color, markers[i + 1].color],
      })),
    [markers]
  );

  // Debounced hover handler to improve performance
  const handlePointHover = useMemo(
    () =>
      debounce((point, prevPoint) => {
        if (point) {
          setHoveredMarker(point);
          
          // **Clear existing timeout if any**
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          
          // **Set a new timeout to clear hoveredMarker after 10 seconds**
          hoverTimeoutRef.current = setTimeout(() => {
            setHoveredMarker(null);
            hoverTimeoutRef.current = null;
          }, 10000); // 10000 milliseconds = 10 seconds
        } else {
          // Optionally, you can decide whether to clear the marker immediately when not hovering
          // For now, we'll let the timeout handle it
        }
      }, 100), // 100ms debounce delay
    []
  );


  // Clean up debounce and timeout on unmount
  useEffect(() => {
    return () => {
      handlePointHover.cancel();
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
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
      label: "✈️", // Plane emoji
      size: 20, // Larger size for visibility
      color: "orange",
      description: "You are flying the plane!",
    }),
    [planePosition]
  );

  // Coin Markers
  const coinMarkers = useMemo(
    () => coins.map((coin) => ({
      lat: coin.lat,
      lng: coin.lng,
      label: "🪙", // Coin emoji
      size: 10, // Size for coins
      color: "yellow",
      description: "A shiny coin to collect!",
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

  return (
    <div>
      <main className="flex flex-col items-center justify-center">
        {/* Header and Menu */}
        <header className="text-center">
          <br />

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">
            Batikanor
          </h1>
          <p className="text-xl sm:text-m mt-4">Welcome!</p>
          <p className="text-l sm:text-m mt-4">Some of my achievements are highlighted on the map below!</p>
          <p className="text-l sm:text-m mt-4">Scroll down to learn about my past projects!</p>
        </header>


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
        {/* Spinnable Earth - Render only on the client */}
        {isClient && (
          <div
            ref={globeContainerRef}
            // className="relative w-full max-w-2xl h-[700px] sm:h-[800px] md:h-[900px]"
            className="relative w-full h-[700px] sm:h-[800px] md:h-[900px]"

          >
            <Globe
              onGlobeLoad={(globe) => {
                globeEl.current = globe;
              }}
              initialView={
                gameMode === "planeCollectCoins"
                  ? { lat: planePosition.lat, lng: planePosition.lng, altitude: 2 }
                  : undefined // Let GlobeWrapper handle initialView for other modes
              }
              width={isFullscreen ? window.innerWidth : dimensions.width}
              height={isFullscreen ? window.innerHeight : dimensions.height}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              backgroundColor="rgba(0,0,0,0)"
              pointsData={allMarkers}
              pointSize={(point) =>
                hoveredMarker && hoveredMarker.label === point.label
                  ? point.size + 5
                  : point.size
              }
              pointColor="color"
              pointLabel={(point) => `${point.label}`}
              pointAltitude={0.05} // Increased altitude from 0.01 to 0.05
              pointResolution={4} // Increased resolution for smoother markers
              onPointClick={(point, event) => {
                setClickedMarker(point);
              }}
              onPointHover={handlePointHover}
              // Arcs properties
              arcsData={arcs}
              arcColor="color"
              arcStroke={0.5}
              arcDashLength={0.25}
              arcDashGap={0.2}
              arcDashInitialGap={() => Math.random()}
              arcDashAnimateTime={1500}
              arcsTransitionDuration={0}
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
            {/* Clicked Marker Pop-up (Only in Fullscreen Mode) */}
            {clickedMarker && isFullscreen && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md mx-auto">
                  <h2 className="text-lg font-semibold mb-4">
                    {clickedMarker.label}
                  </h2>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {clickedMarker.activities.map((activity, index) => (
                      <div key={index} className="bg-gray-700 p-3 rounded-md text-sm shadow-md">
                        <strong>{activity.venue} - {activity.date}</strong><br />
                        <span>{activity.title}</span>
                        <button
                          onClick={() => {
                            navigateWithRefresh(activity.slug);
                            setClickedMarker(null); // Close pop-up after click
                          }}
                          className="text-blue-400 hover:underline ml-2"
                        >
                          View Project
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => setClickedMarker(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
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
        {/* Hovered Marker Pop-up */}
        {hoveredMarker && (
          <div className="fixed top-1/2 right-4 transform -translate-y-1/2 bg-gray-800 text-white p-6 rounded-lg shadow-lg max-w-xs z-50 transition-opacity duration-300">
            <h2 className="text-xl font-semibold mb-4">
              {hoveredMarker.label}
            </h2>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {hoveredMarker.activities.map((activity, index) => (
                <div key={index} className="bg-gray-700 p-3 rounded-md text-sm shadow-md">
                  <strong>{activity.venue} - {activity.date}</strong><br />
                  <span>{activity.title}</span>
                  <button
                    onClick={() => {
                      navigateWithRefresh(activity.slug);
                      setHoveredMarker(null); // Close pop-up after click
                    }}
                    className="text-blue-400 hover:underline ml-2"
                  >
                    View Project
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setHoveredMarker(null)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Close
            </button>
          </div>
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
        </div>

        {/* Divider */}
        <hr className="w-full border-t border-gray-300 my-8" />

        {/* Description Content */}
        <p className="text-center max-w-lg text-base sm:text-lg leading-relaxed">
          The fourth letter of my name &apos;ı&apos; (i without a dot) is
          pronounced the way &apos;e&apos; is pronounced while saying
          &apos;folder&apos;.
        </p>
        <hr className="w-full border-t border-gray-300 my-8" />

        <Projects />
        <hr className="w-full border-t border-gray-300 my-8" />

        <CV />


        <br/>
        <br/>
        <br/>
        <p className="text-lg text-gray-300 mb-4">
          Are you looking for my old homepage? You can find it on{" "}
          <a
            href="http://batikanor.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            here
          </a>.
        </p>
        <br/>
        <br/>
        <br/>

      </main>
    </div>
  );
}
