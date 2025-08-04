import { RankingPayload, SubmitGuessPayload, Room, PlayerResult, Player } from "./types";

export interface ClientToServerEvents {
  joinGameRoom: (payload: { roomCode: string; playerName: string }) => void;
  gameStarted: (payload: { roomCode: string; roundLimit?: number }) => void;
  submitEntry: (payload: { roomCode: string; playerName: string; entry: string }) => void;
  startRankingPhase: (payload: { roomCode: string; judgeName: string }) => void;
  submitRanking: (payload: RankingPayload) => void;
  requestEntries: (payload: { roomCode: string }) => void;
  submitGuess: (payload: SubmitGuessPayload) => void;
}

export interface ServerToClientEvents {
  joinError: (payload: { message: string }) => void;
  playerJoined: (payload: { playerName: string; players: Player[]; message: string }) => void;
  roomState: (payload: {
    players: Room["players"];
    phase: Room["phase"];
    round: Room["round"];
    judgeName: Room["judgeName"];
    category: Room["category"];
  }) => void;
  newEntry: (payload: { entry: string }) => void;
  sendAllEntries: (payload: { entries: string[] }) => void;
  gameStarted: (payload: { category: string; round: number }) => void;
  startRankingPhase: (payload: { judgeName: string }) => void;
  revealResults: (payload: {
    judgeRanking: string[];
    results: Record<string, PlayerResult>;
  }) => void;
  finalScores: (payload: { scores: Record<string, number> }) => void;
}

export type GameState = {
  players: string[];
  status: "waiting" | "active" | "finished";
};
