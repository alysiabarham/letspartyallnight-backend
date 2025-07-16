// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();
const port = process.env.PORT || 3001;
const rooms = {};

function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms[code]);
  return code;
}

// --- Middleware ---
app.use(helmet());
app.use(express.json());

const corsOptions = {
  origin: 'https://letspartyallnight.games',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// Handle preflight requests globally
app.options('*', cors(corsOptions));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes."
});

const createRoomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many room creation attempts from this IP, please try again after an hour."
});

const isAlphanumeric = (text) => /^[a-zA-Z0-9]+$/.test(text);

// --- Routes ---
app.get('/', (req, res) => {
  res.send('Hello from the Let\'s Party All Night backend!');
});

app.post('/create-room', createRoomLimiter, (req, res) => {
  const hostName = req.body.hostId;
  if (!hostName || !isAlphanumeric(hostName)) {
    return res.status(400).json({ error: 'Host name must be alphanumeric.' });
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
  res.status(201).json({ message: 'Room created successfully!', roomCode, room: rooms[roomCode] });
});

app.post('/join-room', apiLimiter, (req, res) => {
  const { roomCode, playerId } = req.body;
  if (!roomCode || !isAlphanumeric(roomCode) || !playerId || !isAlphanumeric(playerId)) {
    return res.status(400).json({ error: 'Room code and player name must be alphanumeric.' });
  }

  const room = rooms[roomCode.toUpperCase()];
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  if (room.players.length >= room.maxPlayers) {
    return res.status(403).json({ error: 'Room is full.' });
  }

  if (room.players.some(p => p.name === playerId)) {
    return res.status(200).json({ message: 'Player already in room.', room });
  }

  room.players.push({ id: playerId, name: playerId });
  console.log(`Player ${playerId} joined room ${roomCode}`);
  res.status(200).json({ message: 'Successfully joined room!', room });
});

app.get('/room/:roomCode', apiLimiter, (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase();
  if (!isAlphanumeric(roomCode)) {
    return res.status(400).json({ error: 'Room code must be alphanumeric.' });
  }

  const room = rooms[roomCode];
  if (room) {
    res.status(200).json(room);
  } else {
    res.status(404).json({ error: 'Room not found.' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
