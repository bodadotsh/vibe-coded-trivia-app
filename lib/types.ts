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
  userId: string; // auth.users.id
  totalScore: number;
  connected: boolean;
}

// ─── Game Status ──────────────────────────────────────────────────────────────

export type GameStatus = 'lobby' | 'active_idle' | 'round_active' | 'round_ended' | 'showing_results' | 'game_over';

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface DbGame {
  id: string;
  game_code: string;
  title: string;
  host_user_id: string;
  game_password_hash: string;
  game_password_salt: string;
  status: GameStatus;
  current_question_index: number;
  round_started_at: string | null;
  round_ends_at: string | null;
  current_round_data: ClientQuestion | null;
  last_round_result: ClientRoundResult | null;
  last_leaderboard: LeaderboardData | null;
  created_at: string;
}

export interface DbTeam {
  id: string;
  game_id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface DbQuestion {
  id: string;
  game_id: string;
  question_index: number;
  text: string;
  time_limit: number;
  correct_option_id: string;
  options: QuestionOption[];
}

export interface DbPlayer {
  id: string;
  game_id: string;
  user_id: string;
  name: string;
  team_id: string;
  total_score: number;
  connected: boolean;
  created_at: string;
}

export interface DbAnswer {
  id: string;
  game_id: string;
  player_id: string;
  question_index: number;
  option_id: string;
  time_taken: number;
  score: number;
  created_at: string;
}

// ─── API Request / Response types ─────────────────────────────────────────────

export interface CreateGameRequest {
  gamePassword: string;
  teams: { name: string; color: string }[];
  questions: Question[];
  title: string;
}

export interface CreateGameResponse {
  gameCode: string;
  gameId: string;
}

export interface JoinGameRequest {
  password: string;
  displayName: string;
  teamId: string;
}

export interface JoinGameResponse {
  playerId: string;
  gameState: ClientGameState;
}

export interface SubmitAnswerRequest {
  optionId: string;
}

export interface HostControlRequest {
  action: 'start' | 'nextRound' | 'endRound' | 'showResults' | 'endGame';
}

// ─── Client-side game state (safe, no secrets) ───────────────────────────────

export interface ClientGameState {
  gameCode: string;
  gameId: string;
  title: string;
  status: GameStatus;
  teams: Team[];
  players: { id: string; name: string; teamId: string; totalScore: number; connected: boolean }[];
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: ClientQuestion | null;
  roundStartedAt: string | null;
  roundEndsAt: string | null;
  roundEndData: ClientRoundResult | null;
  leaderboard: LeaderboardData | null;
  hostUserId: string;
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
  roundScores: Record<string, number>;
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
