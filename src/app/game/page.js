"use client";
import { useEffect, useState, useRef } from 'react';

export default function GamePage() {
  const [nickname, setNickname] = useState('');
  const [players, setPlayers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const divRef = useRef(null);

  // Function to join the game by setting the nickname and initiating connection
  const joinGame = () => {
    const trimmedNickname = nickname.trim();
    if (trimmedNickname !== '') {
      setNickname(trimmedNickname);
      setIsConnecting(true);
      setError(null); // Reset any previous errors
      setPlayers([]);  // Reset players list
    } else {
      setError("Nickname cannot be empty.");
    }
  };

  // Effect to handle WebSocket connection when isConnecting becomes true
  useEffect(() => {
    if (isConnecting && socket === null) {
      // **Critical Fix**: Ensure no trailing slash in the WebSocket URL
      const wsUrl = `wss://p2977a99x8.execute-api.us-east-1.amazonaws.com/production`;
      console.log("Attempting to connect to WebSocket:", wsUrl);
      
      const newSocket = new WebSocket(wsUrl);

      // Handle WebSocket connection opening
      newSocket.onopen = () => {
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
        newSocket.send(JSON.stringify(message));
        console.log("Sent setNickname message:", message);

        // Focus the div to capture key presses
        if (divRef.current) {
          divRef.current.focus();
        }
      };

      // Listen for incoming messages
      newSocket.onmessage = (event) => {
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
      newSocket.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("WebSocket encountered an error. Please try again.");
      };

      // Handle connection close
      newSocket.onclose = (event) => {
        console.warn("WebSocket closed:", event);
        setSocket(null); // Allow reconnection attempts
        setIsConnected(false);
        setIsConnecting(false);
        if (event.code !== 1000) { // 1000 means a normal closure
          setError("WebSocket connection closed unexpectedly.");
        }
      };

      setSocket(newSocket);

      // Cleanup on component unmount
      return () => {
        if (newSocket.readyState === WebSocket.OPEN) {
          newSocket.close(1000, 'Component unmounted');
          console.log("WebSocket connection closed due to component unmount.");
        }
      };
    }
  }, [isConnecting, socket, nickname]);

  // Function to send key press events with "action" set to "message"
  const handleKeyPress = (e) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message = {
        action: 'message',
        type: 'keypress',
        key: e.key
      };
      socket.send(JSON.stringify(message));
      console.log("Sent keypress message:", message);
    }
  };

  return (
    <div 
      onKeyPress={handleKeyPress} 
      tabIndex={0} 
      style={{ 
        outline: 'none', 
        padding: '20px', 
        maxWidth: '400px', 
        margin: '0 auto', 
        fontFamily: 'Arial, sans-serif' 
      }}
      ref={divRef}
    >
      {isConnected ? (
        <>
          <h2>Players</h2>
          {players.length > 0 ? (
            <ul>
              {players.map((player) => (
                <li key={player.connectionId || player.nickname} style={{ marginBottom: '8px' }}>
                  <strong>{player.nickname || 'Anonymous'}</strong>: {player.lastKey || '-'}
                </li>
              ))}
            </ul>
          ) : (
            <p>No players connected yet.</p>
          )}
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
              boxSizing: 'border-box' 
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
