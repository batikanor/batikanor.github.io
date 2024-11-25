"use client"
import { useEffect, useRef, useState } from 'react';

export default function GamePage() {
  const [nickname, setNickname] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [players, setPlayers] = useState([]);
  const [bullets, setBullets] = useState([]);
  const socketRef = useRef(null);
  const playerId = useRef(null);
  
  const serverUrl = "wss://your-websocket-endpoint.amazonaws.com"; // Replace with your WebSocket endpoint
  
  // Initialize WebSocket connection
  useEffect(() => {
    if (isPlaying) {
      socketRef.current = new WebSocket(serverUrl);

      socketRef.current.onopen = () => {
        console.log('Connected to WebSocket');
        // Send join message to the server
        socketRef.current.send(JSON.stringify({ action: 'join', nickname }));
      };

      socketRef.current.onmessage = (message) => {
        const data = JSON.parse(message.data);
        
        // Handle different types of messages from the server
        if (data.type === 'gameState') {
          // Update game state with players and bullets
          setPlayers(data.players);
          setBullets(data.bullets);
        } else if (data.type === 'playerId') {
          playerId.current = data.playerId;
        } else if (data.type === 'playerDied') {
          alert("You died! Enter a new nickname to respawn.");
          setIsPlaying(false);
        }
      };

      socketRef.current.onclose = () => {
        console.log('Disconnected from WebSocket');
      };

      return () => {
        socketRef.current.close();
      };
    }
  }, [isPlaying, nickname]);

  // Handle player movement and shooting
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isPlaying) return;

      let direction;
      switch (event.key) {
        case 'w': direction = 'up'; break;
        case 'a': direction = 'left'; break;
        case 's': direction = 'down'; break;
        case 'd': direction = 'right'; break;
        case ' ':  // Space for shooting
          socketRef.current.send(JSON.stringify({ action: 'shoot', playerId: playerId.current }));
          return;
        default: return;
      }
      // Send movement action to the server
      socketRef.current.send(JSON.stringify({ action: 'move', playerId: playerId.current, direction }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Start game and set nickname
  const startGame = () => {
    if (nickname.trim()) {
      setIsPlaying(true);
    } else {
      alert('Please enter a nickname');
    }
  };

  // Render game canvas
  return (
    <div style={{ textAlign: 'center' }}>
      {!isPlaying ? (
        <div>
          <h2>Enter a Nickname to Join the Game</h2>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname"
          />
          <button onClick={startGame}>Join Game</button>
        </div>
      ) : (
        <canvas
          id="gameCanvas"
          width={800}
          height={600}
          style={{ border: '1px solid black', marginTop: '20px' }}
        />
      )}

      <GameCanvas players={players} bullets={bullets} />
    </div>
  );
}

// GameCanvas component renders players and bullets
function GameCanvas({ players, bullets }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw players
      players.forEach((player) => {
        ctx.beginPath();
        ctx.arc(player.position.x, player.position.y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = player.color;
        ctx.fill();
      });

      // Draw bullets
      bullets.forEach((bullet) => {
        ctx.beginPath();
        ctx.arc(bullet.position.x, bullet.position.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
      });

      requestAnimationFrame(render);
    };

    render();
  }, [players, bullets]);

  return <canvas ref={canvasRef} width={800} height={600} />;
}
