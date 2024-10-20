// src/app/page.js
"use client";
import dynamic from "next/dynamic";
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import { debounce } from "lodash";

// Step 2: Dynamically import the GlobeWrapper component without ref forwarding
const Globe = dynamic(() => import("../components/GlobeWrapper"), { ssr: false });

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const globeContainerRef = useRef(null);
  const globeEl = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [clickedMarker, setClickedMarker] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [gameMode, setGameMode] = useState(false); // Game mode state
  const [gameBoard, setGameBoard] = useState(Array(9).fill(null)); // 3x3 Tic Tac Toe
  const [currentPlayer, setCurrentPlayer] = useState("X");
  const [winner, setWinner] = useState(null);

  // Corrected GeoJSON data for Custom Polygons Layer with proper hexagons
  const sampleGeoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: [
        // Row 1
        {
          type: "Feature",
          properties: { name: "Antarctica", index: 0 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [10, -75],
                [12, -73],
                [15, -73],
                [17, -75],
                [15, -77],
                [12, -77],
                [10, -75],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Antarctica", index: 1 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [20, -75],
                [22, -73],
                [25, -73],
                [27, -75],
                [25, -77],
                [22, -77],
                [20, -75],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Antarctica", index: 2 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [30, -75],
                [32, -73],
                [35, -73],
                [37, -75],
                [35, -77],
                [32, -77],
                [30, -75],
              ],
            ],
          },
        },
        // Row 2
        {
          type: "Feature",
          properties: { name: "Antarctica", index: 3 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [10, -80],
                [12, -78],
                [15, -78],
                [17, -80],
                [15, -82],
                [12, -82],
                [10, -80],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Antarctica", index: 4 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [20, -80],
                [22, -78],
                [25, -78],
                [27, -80],
                [25, -82],
                [22, -82],
                [20, -80],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Antarctica", index: 5 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [30, -80],
                [32, -78],
                [35, -78],
                [37, -80],
                [35, -82],
                [32, -82],
                [30, -80],
              ],
            ],
          },
        },
        // Row 3
        {
          type: "Feature",
          properties: { name: "Antarctica", index: 6 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [10, -85],
                [12, -83],
                [15, -83],
                [17, -85],
                [15, -87],
                [12, -87],
                [10, -85],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Antarctica", index: 7 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [20, -85],
                [22, -83],
                [25, -83],
                [27, -85],
                [25, -87],
                [22, -87],
                [20, -85],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Antarctica", index: 8 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [30, -85],
                [32, -83],
                [35, -83],
                [37, -85],
                [35, -87],
                [32, -87],
                [30, -85],
              ],
            ],
          },
        },
      ],
    }),
    []
  );

  // This ensures the Globe is only rendered on the client-side
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

  // Set the point of view when the globe component is ready
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.pointOfView(
        { lat: -90, lng: 0, altitude: 3 }, // Focus on Antarctica with higher altitude for better visibility
        1000
      );
    }
  }, [globeEl]);

  // Markers for the globe with increased size and adjusted altitude
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
      if (
        board[a] &&
        board[a] === board[b] &&
        board[a] === board[c]
      ) {
        return board[a];
      }
    }
    return null;
  };

  // Handle hexagon clicks for the game
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
  };

  // Helper function to get the center of a polygon
  const getPolygonCenter = (geometry) => {
    const coordinates = geometry.coordinates[0];
    const latitudes = coordinates.map((coord) => coord[1]);
    const longitudes = coordinates.map((coord) => coord[0]);
    const lat =
      latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
    const lng =
      longitudes.reduce((a, b) => a + b, 0) / longitudes.length;
    return { lat, lng };
  };

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

        {/* Toggle Button for Game */}
        <button
          onClick={() => setGameMode((prev) => !prev)}
          className="mb-4 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition"
        >
          {gameMode ? "End Game" : "Play Tic-Tac-Toe in Antarctica"}
        </button>

        {/* Display Current Player */}
        {gameMode && !winner && (
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

        {/* Spinnable Earth - Render only on the client */}
        {isClient && (
          <div
            ref={globeContainerRef}
            className="relative w-full max-w-2xl h-[700px] sm:h-[800px] md:h-[900px]"
          >
            <Globe
              ref={globeEl}
              width={dimensions.width}
              height={dimensions.height}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              backgroundColor="rgba(0,0,0,0)"
              pointsData={markers}
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
              polygonsData={gameMode ? sampleGeoJson.features : []}
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
              polygonAltitude={(d) =>
                d.properties.index !== undefined
                  ? gameBoard[d.properties.index]
                    ? 0.02
                    : 0.01
                  : 0
              }
              polygonResolution={6} // Ensures hexagonal shape
              onPolygonClick={(polygon, event, coords) => {
                if (gameMode) {
                  const hexIndex = polygon.properties.index;
                  handleHexagonClick(hexIndex);
                }
              }}
              onPolygonHover={(polygon, prevPolygon) => {
                // Optional: Handle hover events (e.g., highlight)
              }}
            />
            {/* Overlay for Game Symbols */}
            {gameMode && (
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

        {/* Winner Notification */}
        {winner && (
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
