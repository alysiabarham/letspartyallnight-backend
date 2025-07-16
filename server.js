// server.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // Import helmet for security headers
const rateLimit = require('express-rate-limit'); // Import express-rate-limit for rate limiting
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

// --- Security Middleware ---

// 1. Helmet: Sets various HTTP headers to help protect your app from well-known web vulnerabilities.
app.use(helmet());

// 2. CORS: Explicitly allow requests from your frontend custom domain.
// This is CRITICAL for your frontend to communicate with the backend.
// We are setting this here for good practice, but the vercel.json will
// be the primary enforcer of CORS headers at the Vercel edge.
app.use(cors({
    origin: 'https://letspartyallnight.games', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// 3. JSON Body Parser
app.use(express.json());

// 4. Rate Limiting: Apply to specific routes to prevent abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes."
});

const createRoomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 room creations per hour
  message: "Too many room creation attempts from this IP, please try again after an hour."
});

// --- Helper for Input Validation ---
const isAlphanumeric = (text) => {
  return /^[a-zA-Z0-9]+$/.test(text);
};

// --- Routes ---

// Basic Route
app.get('/', (req, res) => {
  res.send('Hello from the Let\'s Party All Night backend!');
});

// Endpoint to CREATE a new room
app.post('/create-room', createRoomLimiter, (req, res) => { // Apply rate limiter
  const hostName = req.body.hostId;

  // Server-side validation for hostName (alphanumeric only)
  if (!hostName || !isAlphanumeric(hostName)) {
      return res.status(400).json({ error: 'Host name is required and must be alphanumeric (letters and numbers only).' });
  }

  const roomCode = generateRoomCode();
  rooms[roomCode] = {
    code: roomCode,
    hostId: hostName,
    players: [{ id: hostName, name: hostName }],
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
app.post('/join-room', apiLimiter, (req, res) => { // Apply general API rate limiter
  const { roomCode, playerId } = req.body;

  // Server-side validation for roomCode and playerId (alphanumeric only)
  if (!roomCode || !isAlphanumeric(roomCode)) {
    return res.status(400).json({ error: 'Room code is required and must be alphanumeric (letters and numbers only).' });
  }
  if (!playerId || !isAlphanumeric(playerId)) {
    return res.status(400).json({ error: 'Player name is required and must be alphanumeric (letters and numbers only).' });
  }

  const room = rooms[roomCode.toUpperCase()];

  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  if (room.players.length >= room.maxPlayers) {
    return res.status(403).json({ error: 'Room is full.' });
  }

  if (room.players.some(p => p.name === playerId)) {
    console.log(`Player ${playerId} already in room ${roomCode}`);
    return res.status(200).json({
      message: 'Player already in room.',
      room: room
    });
  }

  const newPlayer = { id: playerId, name: playerId };
  room.players.push(newPlayer);

  console.log(`Player ${playerId} joined room ${roomCode}`);
  console.log('Current rooms:', rooms);

  res.status(200).json({
    message: 'Successfully joined room!',
    room: room
  });
});

// Endpoint to get room details (for testing/debugging and RoomPage to fetch players)
app.get('/room/:roomCode', apiLimiter, (req, res) => { // Apply general API rate limiter
    const roomCode = req.params.roomCode.toUpperCase();

    // Server-side validation for roomCode in GET request (alphanumeric only)
    if (!isAlphanumeric(roomCode)) {
      return res.status(400).json({ error: 'Room code must be alphanumeric (letters and numbers only).' });
    }

    const room = rooms[roomCode];
    if (room) {
        res.status(200).json(room);
    } else {
        res.status(404).json({ error: 'Room not found.' });
    }
});

console.log(`Attempting to start backend server on port ${port}`);

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
