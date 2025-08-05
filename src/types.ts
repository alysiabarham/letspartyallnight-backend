export type SubmitGuessPayload = {
  roomCode: string;
  playerName: string;
  guess: string[];
};

export type GuessPayload = {
  roomCode: string;
  playerName: string;
  guess: string[];
};

export type RankingPayload = {
  roomCode: string;
  ranking: string[];
};

export type EntryPayload = {
  roomCode: string;
  playerName: string;
  entry: string;
};

export type GameStartPayload = {
  roomCode: string;
  roundLimit?: number;
};

export type Player = {
  id: string;
  name: string;
  hasGuessed?: boolean;
  hasRanked?: boolean;
};

export type Room = {
  code: string;
  hostId: string;
  players: Player[];
  entries: { playerName: string; entry: string }[];
  guesses: Record<string, string[]>;
  judgeRanking: string[];
  selectedEntries: string[];
  totalScores: Record<string, number>;
  round: number;
  roundLimit: number;
  phase: "entry" | "ranking";
  judgeName: string | null;
  category: string | null;
  state: "lobby" | "active" | "ended";
  maxPlayers: number;
  gameData: Record<string, unknown>;
};

export type PlayerResult = {
  guess: string[];
  score: number;
};
