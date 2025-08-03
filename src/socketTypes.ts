import {
  EntryPayload,
  RankingPayload,
  SubmitGuessPayload,
  Room,
  GameStartPayload,
  PlayerResult,
  Player,
} from "./types";

export interface ClientToServerEvents {
  joinGameRoom: (data: { roomCode: string; playerName: string }) => void;
  gameStarted: (data: { roomCode: string; roundLimit?: number }) => void;
  submitEntry: (data: {
    roomCode: string;
    playerName: string;
    entry: string;
  }) => void;
  startRankingPhase: (data: { roomCode: string; judgeName: string }) => void;
  submitRanking: (data: RankingPayload) => void;
  requestEntries: (data: { roomCode: string }) => void;
  submitGuess: (data: SubmitGuessPayload) => void;
}

export interface ServerToClientEvents {
  joinError: (data: { message: string }) => void;
  playerJoined: (data: {
    playerName: string;
    players: Player[];
    message?: string;
  }) => void;
  roomState: (data: {
    players: Player[];
    phase: Room["phase"];
    round: number;
    judgeName: string | null;
    category: string | null;
  }) => void;
  newEntry: (data: { entry: string }) => void;
  sendAllEntries: (data: { entries: string[] }) => void;
  gameStarted: (data: { category: string; round: number }) => void;
  startRankingPhase: (data: { judgeName: string }) => void;
  revealResults: (data: {
    judgeRanking: string[];
    results: Record<string, PlayerResult>;
  }) => void;
  finalScores: (payload: { scores: Record<string, number> }) => void;
}

export type GameState = {
  players: string[];
  status: "waiting" | "active" | "finished";
};
