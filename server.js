// server.js

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;

// In-memory store for rooms (for now)
const rooms = {};

// Function to generate a simple, unique room code
function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms[code]);
  return code;
}

// Middleware:
app.use(cors({
    // IMPORTANT: Set the origin to your custom domain
    origin: 'https://letspartyallnight.games', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.send('Hello from the Let\'s Party All Night backend!');
});

// Endpoint to CREATE a new room
app.post('/create-room', (req, res) => {
  const hostName = req.body.hostId; // Use hostId as the name directly

  if (!hostName) {
      return res.status(400).json({ error: 'Host name is required.' });
  }

  const roomCode = generateRoomCode();
  rooms[roomCode] = {
    code: roomCode,
    hostId: hostName, // Use the full name as hostId
    players: [{ id: hostName, name: hostName }], // Use the full name as both ID and name
    state: 'lobby',
    maxPlayers: 8,
    gameData: {}
  };

  console.log(`Room created: ${roomCode} by ${hostName}`);
  console.log('Current rooms:', rooms);

  res.status(201).json({
    message: 'Room created successfully!',
    roomCode: roomCode,
    room: rooms[roomCode]
  });
});

// Endpoint to JOIN an existing room
app.post('/join-room', (req, res) => {
  const { roomCode, playerId } = req.body; // playerId will be the player's entered name

  if (!roomCode || !playerId) {
    return res.status(400).json({ error: 'Room code and player name are required.' });
  }

  const room = rooms[roomCode.toUpperCase()];

  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  if (room.players.length >= room.maxPlayers) {
    return res.status(403).json({ error: 'Room is full.' });
  }

  // Check if player is already in the room by name (or unique ID if using auth)
  if (room.players.some(p => p.name === playerId)) {
    console.log(`Player ${playerId} already in room ${roomCode}`);
    return res.status(200).json({
      message: 'Player already in room.',
      room: room
    });
  }

  // Add player to the room
  const newPlayer = { id: playerId, name: playerId }; // Use playerId as both ID and name
  room.players.push(newPlayer);

  console.log(`Player ${playerId} joined room ${roomCode}`);
  console.log('Current rooms:', rooms);

  res.status(200).json({
    message: 'Successfully joined room!',
    room: room
  });
});

// Endpoint to get room details (for testing/debugging and RoomPage to fetch players)
app.get('/room/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = rooms[roomCode];
    if (room) {
        res.status(200).json(room);
    } else {
        res.status(404).json({ error: 'Room not found.' });
    }
});

console.log(`Attempting to start backend server on port ${port}`);

// Start the server
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
