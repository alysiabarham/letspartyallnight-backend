// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = process.env.PORT || 3001;
const rooms = {};

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://letspartyallnight.games', 'https://www.letspartyallnight.games'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }
});

// --- Middleware ---
app.use(helmet());
app.use(express.json());

const corsOptions = {
  origin: ['https://letspartyallnight.games', 'https://www.letspartyallnight.games'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- Rate Limiting ---
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
  const hostId = req.body.hostId;
  if (!hostId || !isAlphanumeric(hostId)) {
    return res.status(400).json({ error: 'Host name must be alphanumeric.' });
  }

  const roomCode = generateRoomCode();
  rooms[roomCode] = {
    code: roomCode,
    hostId,
    players: [{ id: hostId, name: hostId }],
    entries: [],
    state: 'lobby',
    maxPlayers: 8,
    gameData: {}
  };

  console.log(`Room created: ${roomCode} by ${hostId}`);
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

// --- Socket.IO Events ---
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinGameRoom', ({ roomCode, playerName }) => {
    const upperCode = roomCode.toUpperCase();

    socket.rooms.forEach(r => {
      if (r !== socket.id) {
        socket.leave(r);
        console.log(`${socket.id} left room ${r}`);
      }
    });

    socket.join(upperCode);
    console.log(`${playerName} (${socket.id}) joined room ${upperCode}`);

    if (rooms[upperCode]) {
      const room = rooms[upperCode];
      const existing = room.players.some(p => p.name === playerName);
      if (!existing) {
        room.players.push({ id: socket.id, name: playerName });
      }

      io.to(upperCode).emit('playerJoined', {
        playerName,
        players: room.players,
        message: `${playerName} has joined the game.`
      });
    } else {
      console.log(`Room ${upperCode} not found in joinGameRoom.`);
    }
  });

  // NEW BLOCK: Broadcast game start to all clients
  socket.on('gameStarted', ({ roomCode, category }) => {
    const upperCode = roomCode.toUpperCase();
    console.log(`Game started in room ${upperCode} with category "${category}"`);
    io.to(upperCode).emit('gameStarted', { category });
  });

  socket.on('submitEntry', ({ roomCode, playerName, entry }) => {
    const upperCode = roomCode.toUpperCase();
    if (rooms[upperCode]) {
      const room = rooms[upperCode];
      room.entries.push({ playerName, entry });
      console.log(`Entry received from ${playerName} in room ${upperCode}: ${entry}`);
      io.to(upperCode).emit('newEntry', { entry, playerName });
    } else {
      console.log(`Invalid room code on entry: ${roomCode}`);
    }
  });

  socket.on('startRankingPhase', ({ roomCode, judgeName }) => {
    const upperCode = roomCode.toUpperCase();
    console.log(`Starting ranking phase for room ${upperCode}. Judge: ${judgeName}`);
    io.to(upperCode).emit('startRankingPhase', { judgeName });
  });

  socket.on('submitGuess', ({ roomCode, guess }) => {
    const upperCode = roomCode.toUpperCase();
    console.log(`Guess received in room ${upperCode}:`, guess);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms[code]);
  return code;
}

// --- Start Server ---
server.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  console.log(`Socket.IO server also running on port ${port}`);
});
