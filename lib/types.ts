// ─── Question & Game Config ───────────────────────────────────────────────────

export interface QuestionOption {
	id: string;
	text: string;
}

export interface Question {
	text: string;
	options: QuestionOption[];
	correctOptionId: string;
	timeLimit: number; // seconds
}

export interface QuestionFile {
	title: string;
	questions: Question[];
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export interface Team {
	id: string;
	name: string;
	color: string; // hex color
}

// ─── Players ──────────────────────────────────────────────────────────────────

export interface Player {
	id: string;
	name: string;
	teamId: string;
	token: string;
	totalScore: number;
	connected: boolean;
}

// ─── Round State ──────────────────────────────────────────────────────────────

export interface PlayerAnswer {
	playerId: string;
	optionId: string;
	timeTaken: number; // seconds
	score: number;
}

export interface RoundResult {
	questionIndex: number;
	answers: PlayerAnswer[];
	correctOptionId: string;
}

// ─── Game Session ─────────────────────────────────────────────────────────────

export type GameStatus =
	| "lobby"
	| "active_idle"
	| "round_active"
	| "round_ended"
	| "showing_results"
	| "game_over";

export interface GameSession {
	gameCode: string;
	title: string;
	hostPinHash: string;
	hostPinSalt: string;
	gamePasswordHash: string;
	gamePasswordSalt: string;
	hostToken: string;
	status: GameStatus;
	teams: Team[];
	players: Player[];
	questions: Question[];
	currentQuestionIndex: number;
	roundResults: RoundResult[];
	roundStartedAt: number | null; // timestamp ms
	createdAt: number;
}

// ─── SSE Connection ───────────────────────────────────────────────────────────

export interface SSEConnection {
	id: string;
	role: "host" | "player";
	playerId?: string;
	send: (event: string, data: unknown) => void;
	close: () => void;
}

// ─── SSE Event Types ──────────────────────────────────────────────────────────

export type SSEEventType =
	| "game:start"
	| "round:start"
	| "round:answer_count"
	| "round:end"
	| "leaderboard:update"
	| "game:end"
	| "player:joined"
	| "player:disconnected"
	| "game:state";

// ─── API Request / Response types ─────────────────────────────────────────────

export interface CreateGameRequest {
	hostPin: string;
	gamePassword: string;
	teams: { name: string; color: string }[];
	questions: Question[];
	title: string;
}

export interface CreateGameResponse {
	gameCode: string;
	hostToken: string;
}

export interface JoinGameRequest {
	password: string;
	displayName: string;
	teamId: string;
}

export interface JoinGameResponse {
	playerId: string;
	playerToken: string;
	gameState: ClientGameState;
}

export interface SubmitAnswerRequest {
	optionId: string;
}

export interface HostControlRequest {
	action: "start" | "nextRound" | "endRound" | "showResults" | "endGame";
}

// ─── Client-side game state (safe, no secrets) ───────────────────────────────

export interface ClientGameState {
	gameCode: string;
	title: string;
	status: GameStatus;
	teams: Team[];
	players: { id: string; name: string; teamId: string; totalScore: number; connected: boolean }[];
	currentQuestionIndex: number;
	totalQuestions: number;
	currentQuestion: ClientQuestion | null;
	roundResults: ClientRoundResult[];
	roundStartedAt: number | null;
}

/** Question without the correct answer */
export interface ClientQuestion {
	text: string;
	options: QuestionOption[];
	timeLimit: number;
	questionIndex: number;
}

export interface ClientRoundResult {
	questionIndex: number;
	correctOptionId: string;
	answerDistribution: Record<string, number>;
	totalAnswers: number;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
	id: string;
	name: string;
	score: number;
	rank: number;
	previousRank: number | null;
	teamId?: string;
}

export interface LeaderboardData {
	individual: LeaderboardEntry[];
	teams: LeaderboardEntry[];
}
