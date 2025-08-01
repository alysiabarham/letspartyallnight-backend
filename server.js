const express = require('express');
const cors = require('cors');
const app = express();
const allowedOrigins = [
  'https://letspartyallnight-frontend.vercel.app',
  'https://letspartyallnight.games',
  'https://www.letspartyallnight.games',
  'https://letspartyallnight-frontend-74ga0qmkq-alysia-barhams-projects.vercel.app',
  undefined // ✅ allow localhost and undefined origins for dev
];
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

  app.set('trust proxy', 1);
const port = process.env.PORT || 10000;
const rooms = {};
const categories = [
  "Best Ice Cream Flavors", "Things That Are Underrated", "What Helps You Relax",
  "Favorite Breakfast Foods", "Most Useless College Majors", "Things You'd Bring to a Desert Island",
  "Top Excuses for Being Late", "What to Avoid on a First Date", "Best Fast Food Chains",
  "Worst Chores", "Most Annoying Sounds", "Best Ways to Spend a Rainy Day",
  "Essential Road Trip Snacks", "Most Important Inventions", "Things You Can't Live Without",
  "Best Pizza Toppings", "Worst Habits", "Favorite Things", "Best Types of Vacation",
  "Best Coffee Drinks", "Worst Vegetable", "Best Dessert Toppings", "Most Comforting Foods",
  "Best Breakfast Cereals", "Worst Candies", "Best Sandwich Fillings", "Most Refreshing Drinks",
  "Best Potato Chip Flavors", "Worst Holiday Foods", "Best Condiments", "Most Satisfying Snacks",
  "Best Fruits", "Worst Restaurant Experiences", "Best Cheeses", "Best Superheroes", "Foods I Would Never Try",
  "Worst Reality TV Shows", "Most Iconic Movie Quotes", "Best Animated Movies",
  "Worst Song to Hear on Repeat", "Best TV Show Endings", "Most Bingeworthy TV Series",
  "Best Video Game Genres", "Fictional Villains You Love to Hate", "Best Board Games",
  "Most Overrated Movies", "The GOAT in Music", "Worst Movie Tropes", "Best Music Genres",
  "Most Underrated Cartoons", "Most Important Virtues", "Things That Are Truly Beautiful",
  "Worst Ways to Die", "Most Important Life Lessons", "Best Ways to Learn",
  "Most Annoying Personality Traits", "Best Qualities in a Friend", "Worst Things to Say",
  "Most Important Freedoms", "Best Forms of Art", "Worst Excuses for Bad Behavior",
  "Most Impactful Historical Events", "Best Ways to Give Back", "Worst Inventions", "Scams",
  "Best Things to Yell in a Library", "Worst Places to Fall Asleep", "Most Embarrassing Moments",
  "Best Comebacks", "Worst Pick-Up Lines", "Most Annoying Things People Do", "Best Animal Noises",
  "Worst Superpowers", "Most Likely to Survive an Apocalypse", "Best Things to Find in Your Couch",
  "Worst Things to Step On Barefoot", "Most Absurd Laws", "Best Pranks",
  "Worst Things to Say at a Funeral", "Most Creative Ways to Procrastinate",
  "Best Sports to Watch", "Worst Hobbies to Pick Up", "Fake Jobs", "Best Outdoor Activities",
  "Worst Indoor Activities", "Best Books", "Most Challenging Skills to Learn",
  "Best Ways to Exercise", "Worst Things About Social Media", "Best Places to Travel",
  "Most Annoying Tech Problems", "Best Ways to Spend Money", "Worst Ways to Save Money",
  "School Subjects That Should Exist", "Best Things to Collect", "Most Underrated Kitchen Utensils",
  "Best Smells", "Worst Smells", "Medical/Health Myths", "Best Things to Do on a Long Flight",
  "Worst Fashion Trends", "Most Overused Phrases", "Best Animals to Have as Pets",
  "Worst Animals to Have as Pets", "Most Common Misconceptions", "Favorite Things", "Worst Things",
];

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Socket.IO CORS blocked: ' + origin));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket'],
});
app.all('/socket.io/*', (req, res) => {
  res.status(400).send('Polling transport blocked');
});

// --- Middleware ---
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

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
  console.log(`⚡ Socket connected: ${socket.id}`);

socket.on('joinGameRoom', ({ roomCode, playerName }) => {
  const upperCode = roomCode.toUpperCase();

  // 🚧 Input validation
  if (
    typeof roomCode !== 'string' ||
    typeof playerName !== 'string' ||
    !/^[a-zA-Z0-9]+$/.test(playerName) ||
    playerName.length > 20
  ) {
    console.log(`🚨 Invalid join from ${socket.id} — blocked`);
    socket.emit('joinError', { message: 'Invalid room code or name.' });
    return;
  }

  let room = rooms[upperCode];

  // 🆕 If room doesn't exist, bail (or optionally create it)
  if (!room) {
    socket.emit('joinError', { message: 'Room does not exist.' });
    return;
  }

  // 🔐 Prevent duplicate names
  const nameTaken = room.players.some(p => p.name === playerName && p.id !== socket.id);
if (nameTaken) {
  console.log(`⚠️ Name already taken in ${upperCode}: ${playerName}`);
  socket.emit('joinError', { message: 'Name already taken in this room.' });
  return;
}

  // ✅ Safe join
  console.log(`🌐 ${playerName} joined ${upperCode}`);
  io.to(upperCode).emit('playerJoined', {
    playerName,
    players: room.players
  });

  socket.emit('roomState', {
    players: room.players,
    phase: room.phase,
    round: room.round,
    judgeName: room.judgeName,
    category: room.category
  });

  // Initialize room if it doesn't exist
  if (!rooms[upperCode]) {
    rooms[upperCode] = {
      players: [],
      entries: [],
      guesses: {},
      judgeRanking: [],
      selectedEntries: [],
      totalScores: {},
      round: 1,
      roundLimit: 5,
      phase: 'entry',
      judgeName: null,
      hostId: socket.id,
      category: null,
    };
  }

  // Add or update player
  const existing = room.players.some(p => p.name === playerName);
  if (existing) {
    room.players = room.players.map(p =>
      p.name === playerName ? { ...p, id: socket.id } : p
    );
  } else {
    room.players.push({ id: socket.id, name: playerName });
  }

  socket.join(upperCode);
  console.log(`${playerName} (${socket.id}) joined room ${upperCode}`);

  // Emit room state after initialization
  socket.emit('roomState', {
    players: room.players,
    phase: room.phase,
    round: room.round,
    judgeName: room.judgeName,
    category: room.category,
  });

  // If judge has not ranked yet and we're in ranking phase, re-send entries
  const judge = room.players.find(p => p.name === room.judgeName);
  if (room.phase === 'ranking' && room.judgeName === playerName && !judge?.hasRanked) {
    const anonymousEntries = room.entries.map(e => e.entry);
    io.to(socket.id).emit('sendAllEntries', { entries: anonymousEntries });
    console.log(`✅ Re-sent entries to Judge (${playerName}) on refresh during ranking phase`);
  }

  // Notify all others of the new join
  io.to(upperCode).emit('playerJoined', {
    playerName,
    players: room.players,
    message: `${playerName} has joined the game.`
  });
});

  socket.on('gameStarted', ({ roomCode, roundLimit }) => {
  const upperCode = roomCode.toUpperCase();
  const room = rooms[upperCode];
  if (!room.guesses) room.guesses = {};

  room.roundLimit = roundLimit || 5;
  room.round = 1;
  room.phase = 'entry';
  room.totalScores = {};
  room.entries = [];
  room.guesses = {};

  const category = categories[Math.floor(Math.random() * categories.length)];
  const judgeIndex = (room.round - 1) % room.players.length;
  const judgeName = room.players[judgeIndex]?.name;
  room.judgeName = judgeName;

  console.log(`🎮 Game started in ${upperCode} | Round ${room.round}/${room.roundLimit} | Judge: ${judgeName}`);
  io.to(upperCode).emit('gameStarted', {
    category,
    round: room.round,
  });
  });

  socket.on('submitEntry', ({ roomCode, playerName, entry }) => {
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;
    socket.emit('roomState', {
      players: room.players,
      phase: room.phase,
      round: room.round,
      judgeName: room.judgeName,
    });

    if (!entry || !isAlphanumeric(entry.replace(/\s+/g, ''))) {
      console.log(`🚫 Invalid entry from ${playerName}: ${entry}`);
      return;
    }

    room.entries.push({ playerName, entry });
    console.log(`Entry from ${playerName} in ${upperCode}: ${entry}`);
    io.to(upperCode).emit('newEntry', { entry });

    if (room.judgeName) {
      const judgeSocket = room.players.find(p => p.name === room.judgeName)?.id;
     if (judgeSocket) {
       const anonymousEntries = room.entries.map(e => e.entry);
        io.to(judgeSocket).emit('sendAllEntries', { entries: anonymousEntries });
       console.log(`📨 Updated entries sent to Judge (${room.judgeName})`);
     }
    }
  });

  socket.on('startRankingPhase', ({ roomCode, judgeName }) => {
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    room.judgeName = judgeName;
    room.phase = 'ranking';

    console.log(`🔔 Ranking phase started in ${upperCode} by judge ${judgeName}`);
    io.to(upperCode).emit('startRankingPhase', {
      judgeName: room.judgeName
    });

    const judgeSocket = room.players.find(p => p.name === judgeName)?.id;

    console.log(`🕵️ Judge name: ${judgeName}`);
    console.log(`🕵️ Judge socket ID: ${judgeSocket}`);
    console.log(`📦 Entries:`, room.entries.map(e => e.entry));

    if (!judgeSocket) {
      console.warn(`⚠️ Judge socket not found for ${judgeName}`);
    }

    const targetSocket = judgeSocket || socket.id;

    if (room.entries.length > 0) {
      const anonymousEntries = room.entries.map(e => e.entry);
      io.to(targetSocket).emit('sendAllEntries', { entries: anonymousEntries });
      console.log(`✅ Sent entries to Judge via ${targetSocket}`);
    } else {
     console.log(`⚠️ No entries available to send to Judge`);
    }
  });

  const shuffleArray = (arr) => {
    return [...arr].sort(() => Math.random() - 0.5);
  };

  socket.on('submitRanking', ({ roomCode, ranking }) => {
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    room.phase = 'ranking';
    const judge = room.players.find(p => p.name === room.judgeName);
    if (judge) judge.hasRanked = true;

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

    if (room.guesses[playerName]) {
      console.log(`🚫 Player ${playerName} already submitted a guess. Ignoring.`);
      return;
    }

    console.log('Room players at guess time:', room.players.map(p => p.name));
    console.log('Guesses so far:', Object.keys(room.guesses || {}));
    console.log('Does room have playerName?', room.players.some(p => p.name === playerName));

    room.guesses[playerName] = guess;
    if (!room.guesses) room.guesses = {};

    const player = room.players.find(p => p.name === playerName);
    if (player) player.hasGuessed = true;

    const guessers = room.players.filter(p => p.name !== room.judgeName && p.name !== room.hostId);
    const received = guessers.filter(p => room.guesses[p.name]).length;

    console.log('Eligible guessers:', guessers.map(p => p.name));
    console.log('Received valid guesses:', received);

    if (received >= guessers.length) {
      const judgeRanking = room.judgeRanking;
      const results = {};

    console.log('Guessers:', guessers.map(p => p.name));
    console.log('Received guesses:', Object.keys(room.guesses));

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

      if (!room.totalScores) room.totalScores = {};
for (const [name, result] of Object.entries(results)) {
  room.totalScores[name] = (room.totalScores[name] || 0) + result.score;
}

if (room.round < room.roundLimit) {
  room.round++;
  const judgeIndex = (room.round - 1) % room.players.length;
  room.judgeName = room.players[judgeIndex]?.name || null;
  room.entries = [];
  room.guesses = {};
  room.phase = 'entry';

  const nextCategory = categories[Math.floor(Math.random() * categories.length)];
  const judgeName = room.players[judgeIndex]?.name;
  room.judgeName = judgeName;

  const judgeSocket = room.players.find(p => p.name === judgeName)?.id;

  console.log(`🔁 Starting round ${room.round} in ${upperCode} | Judge: ${judgeName}`);
  io.to(upperCode).emit('gameStarted', {
    category: nextCategory,
    round: room.round
  });
  io.to(upperCode).emit('startRankingPhase', { judgeName });
} else {
  io.to(upperCode).emit('finalScores', { scores: room.totalScores });
  console.log(`🏁 Game ended in ${upperCode}. Final scores:`, room.totalScores);
}

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
