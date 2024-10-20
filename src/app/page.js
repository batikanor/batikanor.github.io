"use client";

import dynamic from "next/dynamic";
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import { debounce } from "lodash";

// Dynamically import the GlobeWrapper component without server-side rendering
const Globe = dynamic(() => import("../components/GlobeWrapper"), { ssr: false });

export default function Home() {
  // State to ensure client-side rendering
  const [isClient, setIsClient] = useState(false);

  // Refs
  const globeContainerRef = useRef(null);
  const globeEl = useRef();

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

  // Ensure the Globe is only rendered on the client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

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
          { lat: planePosition.lat, lng: planePosition.lng, altitude: 2 },
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

  // Markers for the globe
  const markers = useMemo(
    () => [
      {
        lat: 41.0082, // Istanbul
        lng: 28.9784,
        label: "BSc Computer Science, Turkish German University",
        size: 15, // Increased size from 10 to 15
        color: "red",
        description:
          "Studied BSc Computer Science at the Turkish German University in Istanbul.",
      },
      {
        lat: 48.1351, // Munich
        lng: 11.582,
        label: "MSc Informatics, Technical University of Munich",
        size: 15, // Increased size from 10 to 15
        color: "blue",
        description:
          "Currently pursuing MSc Informatics at the Technical University of Munich.",
      },
      // Add more markers here as needed
    ],
    []
  );

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
        setHoveredMarker(point);
      }, 100), // 100ms debounce delay
    []
  );

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
      }

      animationFrameRef.current = requestAnimationFrame(updatePlanePosition);
    };

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(updatePlanePosition);

    // Clean up on unmount or game mode change
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameMode, keysPressed, planePosition]);

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
          <p className="text-xl sm:text-2xl mt-4">Batıkan Bora Ormancı</p>
        </header>

        {/* Toggle Buttons for Games */}
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
            <p>
              Use <span className="font-mono">W</span> (Up),{" "}
              <span className="font-mono">A</span> (Left),{" "}
              <span className="font-mono">S</span> (Down),{" "}
              <span className="font-mono">D</span> (Right) to fly the plane.
            </p>
            <p className="mt-2">
              Collected Coins: {collectedCoins} / 20
            </p>
            <p className="mt-2">
              Time Elapsed: {(elapsedTime / 1000).toFixed(1)} seconds
            </p>
          </div>
        )}

        {/* Spinnable Earth - Render only on the client */}
        {isClient && (
          <div
            ref={globeContainerRef}
            className="relative w-full max-w-2xl h-[700px] sm:h-[800px] md:h-[900px]"
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
              width={dimensions.width}
              height={dimensions.height}
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
              arcStroke={1.5}
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

        {/* Overlay UI for Plane Collect Coins */}
        {/* {gameMode === "planeCollectCoins" && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col items-center justify-start p-4">
            <div className="bg-gray-800 bg-opacity-70 text-white px-4 py-2 rounded mb-2">
              Collected Coins: {collectedCoins} / 20
            </div>
            <div className="bg-gray-800 bg-opacity-70 text-white px-4 py-2 rounded">
              Time Elapsed: {(elapsedTime / 1000).toFixed(1)} seconds
            </div>
          </div>
        )} */}

        {/* Side Bubble for Hovered Marker */}
        {hoveredMarker && (
          <div className="fixed top-1/2 right-4 transform -translate-y-1/2 bg-gray-800 text-white p-6 rounded-lg shadow-lg max-w-xs z-50 transition-opacity duration-300">
            <h2 className="text-xl font-semibold">
              {hoveredMarker.label}
            </h2>
            <p className="mt-2">{hoveredMarker.description}</p>
          </div>
        )}

        {/* Modal Popup for Marker Click */}
        {clickedMarker && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md mx-auto">
              <p className="text-lg font-semibold">
                {clickedMarker.description}
              </p>
              <button
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => setClickedMarker(null)}
              >
                Close
              </button>
            </div>
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

        {/* Divider */}
        <hr className="w-full border-t border-gray-300 my-8" />

        {/* Description Content */}
        <p className="text-center max-w-lg text-base sm:text-lg leading-relaxed">
          The fourth letter of my name &quot;ı&quot; (i without a dot) is
          pronounced the way &quot;e&quot; is pronounced while saying
          &quot;folder&quot;.
        </p>
      </main>
    </div>
  );
}
