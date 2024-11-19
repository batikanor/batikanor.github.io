"use client";
import { useEffect, useState, useRef, useCallback } from 'react';

// Define map dimensions
const MAP_WIDTH = 100;
const MAP_HEIGHT = 100;
const CELL_SIZE = 5; // Size of each cell in pixels
const PLAYER_SIZE = 16; // Size of players (radius in pixels)

export default function GamePage() {
  const [nickname, setNickname] = useState('');
  const [players, setPlayers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const divRef = useRef(null);
  const canvasRef = useRef(null);

  // Function to hash a nickname to a unique color
  const hashToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Convert hash to RGB color
    const r = (hash >> 16) & 0xff;
    const g = (hash >> 8) & 0xff;
    const b = hash & 0xff;
    return `rgb(${r},${g},${b})`;
  };

  // Function to get the opposite color for text
  const getContrastingColor = (rgb) => {
    // Extract RGB values
    const [r, g, b] = rgb
      .match(/\d+/g)
      .map(Number)
      .map((x) => 255 - x); // Invert the RGB values
    return `rgb(${r},${g},${b})`;
  };

  // Function to join the game by setting the nickname and initiating connection
  const joinGame = () => {
    const trimmedNickname = nickname.trim();
    if (trimmedNickname !== '') {
      setIsConnecting(true);
      setError(null); // Reset any previous errors
      setPlayers([]);  // Reset players list
      // Initiate WebSocket connection
      setSocket(new WebSocket('wss://p2977a99x8.execute-api.us-east-1.amazonaws.com/production'));
    } else {
      setError("Nickname cannot be empty.");
    }
  };

  // Effect to handle WebSocket connection setup
  useEffect(() => {
    if (socket) {
      // Handle WebSocket connection opening
      socket.onopen = () => {
        console.log("WebSocket connection established");
        setIsConnected(true);
        setIsConnecting(false);
        setError(null); // Clear any previous errors

        // Send the nickname as a separate message
        const message = {
          action: 'message',
          type: 'setNickname',
          nickname: nickname
        };
        socket.send(JSON.stringify(message));
        console.log("Sent setNickname message:", message);

        // Focus the div to capture key presses
        if (divRef.current) {
          divRef.current.focus();
        }
      };

      // Listen for incoming messages
      socket.onmessage = (event) => {
        console.log("Received message:", event.data);
        try {
          const data = JSON.parse(event.data);
          // Update players list when data is received
          if (data.players) {
            setPlayers(data.players);
          }
        } catch (err) {
          console.error("Error parsing message:", err);
        }
      };

      // Handle errors
      socket.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("WebSocket encountered an error. Please try again.");
        setIsConnecting(false);
      };

      // Handle connection close
      socket.onclose = (event) => {
        console.warn("WebSocket closed:", event);
        setSocket(null); // Allow reconnection attempts
        setIsConnected(false);
        setIsConnecting(false);
        if (event.code !== 1000) { // 1000 means a normal closure
          setError("WebSocket connection closed unexpectedly.");
        }
      };

      // Cleanup on component unmount
      return () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, 'Component unmounted');
          console.log("WebSocket connection closed due to component unmount.");
        }
      };
    }
  }, [socket, nickname]);

  // Function to send key press events with "action" set to "message"
  const handleKeyPress = useCallback((e) => {
    const validKeys = ['w', 'a', 's', 'd'];
    const key = e.key.toLowerCase();
    if (validKeys.includes(key)) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const message = {
          action: 'message',
          type: 'keypress',
          key: key
        };
        socket.send(JSON.stringify(message));
        console.log("Sent keypress message:", message);
      }
      e.preventDefault(); // Prevent default scrolling behavior
    }
  }, [socket]);

  // Attach keydown listener
  useEffect(() => {
    if (isConnected) {
      const currentDiv = divRef.current;
      if (currentDiv) {
        currentDiv.addEventListener('keydown', handleKeyPress);
      }
      return () => {
        if (currentDiv) {
          currentDiv.removeEventListener('keydown', handleKeyPress);
        }
      };
    }
  }, [isConnected, handleKeyPress]);

  // Render the map using HTML Canvas for better performance
  useEffect(() => {
    if (isConnected && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Set canvas dimensions
      canvas.width = MAP_WIDTH * CELL_SIZE;
      canvas.height = MAP_HEIGHT * CELL_SIZE;

      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Optional: Draw grid lines for better visibility
      ctx.strokeStyle = '#e0e0e0';
      for (let x = 0; x <= MAP_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE, 0);
        ctx.lineTo(x * CELL_SIZE, MAP_HEIGHT * CELL_SIZE);
        ctx.stroke();
      }
      for (let y = 0; y <= MAP_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL_SIZE);
        ctx.lineTo(MAP_WIDTH * CELL_SIZE, y * CELL_SIZE);
        ctx.stroke();
      }

      // Draw players
      players.forEach(player => {
        const { nickname, location } = player;
        const { x, y } = location;

        // Ensure coordinates are within bounds
        if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
          // Compute player's unique color
          const color = hashToColor(nickname);
          const contrastingColor = getContrastingColor(color);

          // Draw player as a larger circle
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(
            x * CELL_SIZE + CELL_SIZE / 2,
            y * CELL_SIZE + CELL_SIZE / 2,
            PLAYER_SIZE, // Use global PLAYER_SIZE
            0,
            2 * Math.PI
          );
          ctx.fill();

          // Draw player's full nickname centered in the circle
          ctx.fillStyle = contrastingColor;
          ctx.font = `${PLAYER_SIZE / 2}px Arial`; // Font size relative to player size
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            nickname,
            x * CELL_SIZE + CELL_SIZE / 2,
            y * CELL_SIZE + CELL_SIZE / 2
          );
        }
      });
    }
  }, [players, isConnected]);

  return (
    <div 
      ref={divRef}
      tabIndex={0} 
      style={{ 
        outline: 'none', 
        padding: '20px', 
        maxWidth: '800px', 
        margin: '0 auto', 
        fontFamily: 'Arial, sans-serif' 
      }}
    >
      {isConnected ? (
        <>
          <h2>2D Map</h2>
          <div style={{ 
            border: '1px solid #000', 
            width: MAP_WIDTH * CELL_SIZE, 
            height: MAP_HEIGHT * CELL_SIZE, 
            position: 'relative',
            marginBottom: '20px',
          }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>
          <p>Use W (up), A (left), S (down), D (right) keys to move.</p>
          {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2>Join the Game</h2>
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                joinGame();
              }
            }}
            style={{ 
              padding: '10px', 
              fontSize: '16px', 
              width: '100%', 
              boxSizing: 'border-box',
              color: '#000',           // Set text color to black
              backgroundColor: '#fff', // Set background to white
              border: '1px solid #ccc',// Add a border for better visibility
              borderRadius: '4px',     // Optional: rounded corners
            }}
          />
          <button 
            onClick={joinGame} 
            disabled={nickname.trim() === ''}
            style={{
              padding: '10px 20px',
              marginTop: '10px',
              fontSize: '16px',
              cursor: nickname.trim() === '' ? 'not-allowed' : 'pointer',
              backgroundColor: nickname.trim() === '' ? '#ccc' : '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            {isConnecting ? 'Connecting...' : 'Join Game'}
          </button>
          {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
