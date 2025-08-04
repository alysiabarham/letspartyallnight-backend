export interface SubmitGuessPayload {
  roomCode: string;
  playerName: string;
  guess: string[];
}

export interface GuessPayload {
  roomCode: string;
  playerName: string;
  guess: string[];
}

export interface RankingPayload {
  roomCode: string;
  ranking: string[];
}

export interface EntryPayload {
  roomCode: string;
  playerName: string;
  entry: string;
}

export interface GameStartPayload {
  roomCode: string;
  roundLimit?: number;
}

export interface Player {
  id: string;
  name: string;
  hasGuessed?: boolean;
  hasRanked?: boolean;
}

export interface Room {
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
}

export interface PlayerResult {
  guess: string[];
  score: number;
}
