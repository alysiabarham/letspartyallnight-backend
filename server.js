const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = process.env.PORT || 10000;
const rooms = {};

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'https://letspartyallnight.games',
      'https://www.letspartyallnight.games'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// --- Middleware ---
app.use(helmet());
app.use(express.json());

const corsOptions = {
  origin: [
    'https://letspartyallnight.games',
    'https://www.letspartyallnight.games'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
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
  res.send("Hello from the Let's Party All Night backend!");
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

    const room = rooms[upperCode];
    if (room) {
      const existing = room.players.some(p => p.name === playerName);
      if (existing) {
        room.players = room.players.map(p =>
          p.name === playerName ? { ...p, id: socket.id } : p
        );
      } else {
        room.players.push({ id: socket.id, name: playerName });
      }

      if (room.judgeName === playerName && room.entries.length > 0) {
        const anonymousEntries = room.entries.map(e => e.entry);
        io.to(socket.id).emit('sendAllEntries', { entries: anonymousEntries });
        console.log(`✅ Re-sent entries to Judge (${playerName}) on reconnect`);
      }

      io.to(upperCode).emit('playerJoined', {
        playerName,
        players: room.players,
        message: `${playerName} has joined the game.`
      });
    }
  });

  socket.on('gameStarted', ({ roomCode, category }) => {
    const upperCode = roomCode.toUpperCase();
    console.log(`Game started in room ${upperCode} with category "${category}"`);
    io.to(upperCode).emit('gameStarted', { category });
  });

  socket.on('submitEntry', ({ roomCode, playerName, entry }) => {
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    room.entries.push({ playerName, entry });
    console.log(`Entry from ${playerName} in ${upperCode}: ${entry}`);
    io.to(upperCode).emit('newEntry', { entry });
  });

  socket.on('startRankingPhase', ({ roomCode, judgeName }) => {
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    room.judgeName = judgeName;
    room.phase = 'ranking';
    console.log(`🔔 Ranking phase started in ${upperCode} by judge ${judgeName}`);
    io.to(upperCode).emit('startRankingPhase', { judgeName });

    const anonymousEntries = room.entries.map(e => e.entry);
    io.to(socket.id).emit('sendAllEntries', { entries: anonymousEntries });
  });

  const shuffleArray = (arr) => {
    return [...arr].sort(() => Math.random() - 0.5);
  };

  socket.on('submitRanking', ({ roomCode, ranking }) => {
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    room.judgeRanking = ranking;
    room.selectedEntries = ranking;

    const shuffled = shuffleArray(ranking);
    io.to(upperCode).emit('sendAllEntries', { entries: shuffled });

    console.log(`✅ Shuffled ranking sent to guessers in ${upperCode}:`, shuffled);
  });

  socket.on('requestEntries', ({ roomCode }) => {
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room || !room.selectedEntries) return;

    io.to(socket.id).emit('sendAllEntries', { entries: room.selectedEntries });
  });

    socket.on('submitGuess', ({ roomCode, playerName, guess }) => {
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    console.log('Room players at guess time:', room.players.map(p => p.name));
    console.log('Guesses so far:', Object.keys(room.guesses || {}));
    console.log('Does room have playerName?', room.players.some(p => p.name === playerName));

    if (!room.guesses) room.guesses = {};
    room.guesses[playerName] = guess;

    const guessers = room.players.filter(p => p.name !== room.hostId && p.name !== room.judgeName);
    const received = Object.keys(room.guesses).length;

    if (received >= guessers.length) {
      const judgeRanking = room.judgeRanking;
      const results = {};

      for (const [name, guess] of Object.entries(room.guesses)) {
        let score = 0;
        for (let i = 0; i < guess.length; i++) {
          if (guess[i] === judgeRanking[i]) score++;
        }

        if (score === judgeRanking.length) {
          score += 3;
          console.log(`🎉 Perfect match by ${name}! Bonus applied.`);
        }

        results[name] = { guess, score };
      }

      io.to(upperCode).emit('revealResults', {
        judgeRanking,
        results
      });

      console.log(`✅ Revealed results with scores for room ${upperCode}:`, results);
    }
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

server.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  console.log(`Socket.IO server also running on port ${port}`);
});
