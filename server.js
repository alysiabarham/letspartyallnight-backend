// server.js

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;

// In-memory store for rooms (for now)
const rooms = {}; // Example: { 'ROOMCODE1': { host: 'user1', players: ['user1'], state: 'lobby', maxPlayers: 8, game: {} } }

// Function to generate a simple, unique room code
function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase(); // e.g., "A1B2C3"
  } while (rooms[code]); // Ensure the code is unique
  return code;
}


// Middleware:
app.use(cors());
app.use(express.json());

// Basic Route (already there):
app.get('/', (req, res) => {
  res.send('Hello from the Let\'s Party All Night backend!');
});

// --- Add these new API endpoints below the basic route ---

// Endpoint to CREATE a new room
app.post('/create-room', (req, res) => {
  // In a real app, you'd get host info from authentication (e.g., req.user.id)
  const hostId = req.body.hostId || `guest_${Date.now()}`; // For now, use a dummy host ID

  const roomCode = generateRoomCode();
  rooms[roomCode] = {
    code: roomCode,
    hostId: hostId,
    players: [{ id: hostId, name: `Player ${hostId.substring(hostId.length - 4)}` }], // Host is first player
    state: 'lobby', // 'lobby', 'in-game', 'ended'
    maxPlayers: 8, // Example max players
    gameData: {} // Placeholder for actual game data
  };

  console.log(`Room created: ${roomCode} by ${hostId}`);
  console.log('Current rooms:', rooms);

  res.status(201).json({
    message: 'Room created successfully!',
    roomCode: roomCode,
    room: rooms[roomCode]
  });
});

// Endpoint to JOIN an existing room
app.post('/join-room', (req, res) => {
  const { roomCode, playerId } = req.body; // Expect roomCode and playerId from frontend

  if (!roomCode || !playerId) {
    return res.status(400).json({ error: 'Room code and player ID are required.' });
  }

  const room = rooms[roomCode.toUpperCase()]; // Convert to uppercase for consistent lookup

  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  if (room.players.length >= room.maxPlayers) {
    return res.status(403).json({ error: 'Room is full.' });
  }

  // Check if player is already in the room
  if (room.players.some(p => p.id === playerId)) {
    console.log(`Player ${playerId} already in room ${roomCode}`);
    return res.status(200).json({ // Still return 200 OK if they're already in
      message: 'Player already in room.',
      room: room
    });
  }

  // Add player to the room
  const newPlayer = { id: playerId, name: `Player ${playerId.substring(playerId.length - 4)}` };
  room.players.push(newPlayer);

  console.log(`Player ${playerId} joined room ${roomCode}`);
  console.log('Current rooms:', rooms);

  res.status(200).json({
    message: 'Successfully joined room!',
    room: room
  });
});

// Optional: Endpoint to get room details (for testing/debugging)
app.get('/room/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = rooms[roomCode];
    if (room) {
        res.status(200).json(room);
    } else {
        res.status(404).json({ error: 'Room not found.' });
    }
});


// Start the server (already there):
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});