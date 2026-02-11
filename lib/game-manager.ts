import { hashPassword, verifyPassword } from "./hash";
import { persistGame } from "./db";
import { calculateScore } from "./scoring";
import { sanitize, isValidDisplayName, isValidTeamName } from "./sanitize";
import type {
	GameSession,
	SSEConnection,
	Team,
	Question,
	Player,
	PlayerAnswer,
	ClientGameState,
	ClientQuestion,
	ClientRoundResult,
	LeaderboardData,
	LeaderboardEntry,
} from "./types";

// ─── Generate unique codes ───────────────────────────────────────────────────

function generateGameCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

class GameManager {
	private games = new Map<string, GameSession>();
	private connections = new Map<string, Set<SSEConnection>>();
	private roundTimers = new Map<string, ReturnType<typeof setTimeout>>();
	/** Track previous ranks for leaderboard indicators */
	private previousIndividualRanks = new Map<string, Map<string, number>>();
	private previousTeamRanks = new Map<string, Map<string, number>>();

	// ─── Game Creation ──────────────────────────────────────────────────────

	createGame(
		hostPin: string,
		gamePassword: string,
		teams: { name: string; color: string }[],
		questions: Question[],
		title: string,
	): { gameCode: string; hostToken: string } {
		let gameCode: string;
		do {
			gameCode = generateGameCode();
		} while (this.games.has(gameCode));

		const hostPinHashed = hashPassword(hostPin);
		const gamePasswordHashed = hashPassword(gamePassword);
		const hostToken = crypto.randomUUID();

		const sanitizedTeams: Team[] = teams.map((t, i) => ({
			id: `team-${i}`,
			name: sanitize(t.name, 30),
			color: t.color,
		}));

		const session: GameSession = {
			gameCode,
			title: sanitize(title, 100),
			hostPinHash: hostPinHashed.hash,
			hostPinSalt: hostPinHashed.salt,
			gamePasswordHash: gamePasswordHashed.hash,
			gamePasswordSalt: gamePasswordHashed.salt,
			hostToken,
			status: "lobby",
			teams: sanitizedTeams,
			players: [],
			questions,
			currentQuestionIndex: -1,
			roundResults: [],
			roundStartedAt: null,
			createdAt: Date.now(),
		};

		this.games.set(gameCode, session);
		this.connections.set(gameCode, new Set());
		this.previousIndividualRanks.set(gameCode, new Map());
		this.previousTeamRanks.set(gameCode, new Map());

		this.persistGameState(session);

		return { gameCode, hostToken };
	}

	// ─── Game Lookup ────────────────────────────────────────────────────────

	getGame(gameCode: string): GameSession | undefined {
		return this.games.get(gameCode);
	}

	verifyHost(gameCode: string, token: string): boolean {
		const game = this.games.get(gameCode);
		return game !== undefined && game.hostToken === token;
	}

	// ─── Player Join ────────────────────────────────────────────────────────

	joinGame(
		gameCode: string,
		password: string,
		displayName: string,
		teamId: string,
	): { success: true; playerId: string; playerToken: string } | { success: false; error: string } {
		const game = this.games.get(gameCode);
		if (!game) return { success: false, error: "Game not found" };

		if (game.status === "game_over") {
			return { success: false, error: "Game has ended" };
		}

		if (!verifyPassword(password, game.gamePasswordHash, game.gamePasswordSalt)) {
			return { success: false, error: "Incorrect password" };
		}

		if (!isValidDisplayName(displayName)) {
			return { success: false, error: "Invalid display name. Use letters, numbers, spaces, and basic punctuation." };
		}

		const sanitizedName = sanitize(displayName, 30);
		const nameTaken = game.players.some((p) => p.name.toLowerCase() === sanitizedName.toLowerCase());
		if (nameTaken) {
			return { success: false, error: "Display name already taken" };
		}

		const teamExists = game.teams.some((t) => t.id === teamId);
		if (!teamExists) {
			return { success: false, error: "Invalid team" };
		}

		const playerId = crypto.randomUUID();
		const playerToken = crypto.randomUUID();

		const player: Player = {
			id: playerId,
			name: sanitizedName,
			teamId,
			token: playerToken,
			totalScore: 0,
			connected: true,
		};

		game.players.push(player);
		this.persistGameState(game);

		// Broadcast to all connections
		this.broadcast(gameCode, "player:joined", {
			player: { id: player.id, name: player.name, teamId: player.teamId, totalScore: 0, connected: true },
			totalPlayers: game.players.length,
		});

		return { success: true, playerId, playerToken };
	}

	// ─── SSE Connection Management ──────────────────────────────────────────

	addConnection(gameCode: string, connection: SSEConnection): void {
		const conns = this.connections.get(gameCode);
		if (conns) {
			conns.add(connection);
		}
		// If a player reconnects, mark them as connected
		if (connection.playerId) {
			const game = this.games.get(gameCode);
			const player = game?.players.find((p) => p.id === connection.playerId);
			if (player) {
				player.connected = true;
			}
		}
	}

	removeConnection(gameCode: string, connectionId: string): void {
		const conns = this.connections.get(gameCode);
		if (!conns) return;
		for (const conn of conns) {
			if (conn.id === connectionId) {
				conns.delete(conn);
				// Mark player as disconnected
				if (conn.playerId) {
					const game = this.games.get(gameCode);
					const player = game?.players.find((p) => p.id === conn.playerId);
					if (player) {
						// Only mark disconnected if no other connection for this player
						const stillConnected = Array.from(conns).some(
							(c) => c.playerId === conn.playerId,
						);
						if (!stillConnected) {
							player.connected = false;
							this.broadcast(gameCode, "player:disconnected", {
								playerId: conn.playerId,
							});
						}
					}
				}
				break;
			}
		}
	}

	private broadcast(gameCode: string, event: string, data: unknown): void {
		const conns = this.connections.get(gameCode);
		if (!conns) return;
		for (const conn of conns) {
			try {
				conn.send(event, data);
			} catch {
				// Connection may be closed
			}
		}
	}

	// ─── Host Controls ──────────────────────────────────────────────────────

	startGame(gameCode: string): { success: boolean; error?: string } {
		const game = this.games.get(gameCode);
		if (!game) return { success: false, error: "Game not found" };
		if (game.status !== "lobby") return { success: false, error: "Game already started" };
		if (game.questions.length === 0) return { success: false, error: "No questions loaded" };

		game.status = "active_idle";
		game.currentQuestionIndex = -1;

		this.broadcast(gameCode, "game:start", {
			status: game.status,
			totalQuestions: game.questions.length,
		});

		this.persistGameState(game);
		return { success: true };
	}

	nextRound(gameCode: string): { success: boolean; error?: string } {
		const game = this.games.get(gameCode);
		if (!game) return { success: false, error: "Game not found" };
		if (game.status !== "active_idle" && game.status !== "showing_results") {
			return { success: false, error: "Cannot start round in current state" };
		}

		const nextIndex = game.currentQuestionIndex + 1;
		if (nextIndex >= game.questions.length) {
			return { success: false, error: "No more questions" };
		}

		game.currentQuestionIndex = nextIndex;
		game.status = "round_active";
		game.roundStartedAt = Date.now();

		const question = game.questions[nextIndex];
		const clientQuestion: ClientQuestion = {
			text: question.text,
			options: question.options,
			timeLimit: question.timeLimit,
			questionIndex: nextIndex,
		};

		this.broadcast(gameCode, "round:start", {
			question: clientQuestion,
			roundStartedAt: game.roundStartedAt,
		});

		// Set auto-end timer
		const timer = setTimeout(() => {
			this.endRound(gameCode);
		}, question.timeLimit * 1000);
		this.roundTimers.set(gameCode, timer);

		return { success: true };
	}

	endRound(gameCode: string): { success: boolean; error?: string } {
		const game = this.games.get(gameCode);
		if (!game) return { success: false, error: "Game not found" };
		if (game.status !== "round_active") return { success: false, error: "No active round" };

		// Clear timer
		const timer = this.roundTimers.get(gameCode);
		if (timer) {
			clearTimeout(timer);
			this.roundTimers.delete(gameCode);
		}

		game.status = "round_ended";
		game.roundStartedAt = null;

		const question = game.questions[game.currentQuestionIndex];
		const roundResult = game.roundResults.find(
			(r) => r.questionIndex === game.currentQuestionIndex,
		);

		// Calculate answer distribution
		const distribution: Record<string, number> = {};
		for (const opt of question.options) {
			distribution[opt.id] = 0;
		}
		if (roundResult) {
			for (const ans of roundResult.answers) {
				distribution[ans.optionId] = (distribution[ans.optionId] || 0) + 1;
			}
		}

		this.broadcast(gameCode, "round:end", {
			correctOptionId: question.correctOptionId,
			answerDistribution: distribution,
			totalAnswers: roundResult?.answers.length ?? 0,
		});

		this.persistGameState(game);
		return { success: true };
	}

	showResults(gameCode: string): { success: boolean; error?: string } {
		const game = this.games.get(gameCode);
		if (!game) return { success: false, error: "Game not found" };
		if (game.status !== "round_ended") {
			return { success: false, error: "Round has not ended" };
		}

		game.status = "showing_results";

		const leaderboard = this.computeLeaderboard(gameCode);
		this.broadcast(gameCode, "leaderboard:update", leaderboard);

		return { success: true };
	}

	endGame(gameCode: string): { success: boolean; error?: string } {
		const game = this.games.get(gameCode);
		if (!game) return { success: false, error: "Game not found" };

		// Clear any active timer
		const timer = this.roundTimers.get(gameCode);
		if (timer) {
			clearTimeout(timer);
			this.roundTimers.delete(gameCode);
		}

		game.status = "game_over";
		game.roundStartedAt = null;

		const leaderboard = this.computeLeaderboard(gameCode);
		this.broadcast(gameCode, "game:end", {
			leaderboard,
			totalRounds: game.roundResults.length,
			totalPlayers: game.players.length,
		});

		this.persistGameState(game);

		// Close all SSE connections
		const conns = this.connections.get(gameCode);
		if (conns) {
			for (const conn of conns) {
				try {
					conn.close();
				} catch {
					// ignore
				}
			}
			conns.clear();
		}

		return { success: true };
	}

	// ─── Answer Submission ──────────────────────────────────────────────────

	submitAnswer(
		gameCode: string,
		playerId: string,
		optionId: string,
	): { success: boolean; error?: string } {
		const game = this.games.get(gameCode);
		if (!game) return { success: false, error: "Game not found" };
		if (game.status !== "round_active") return { success: false, error: "No active round" };

		const player = game.players.find((p) => p.id === playerId);
		if (!player) return { success: false, error: "Player not found" };

		const question = game.questions[game.currentQuestionIndex];
		const validOption = question.options.some((o) => o.id === optionId);
		if (!validOption) return { success: false, error: "Invalid option" };

		// Find or create round result
		let roundResult = game.roundResults.find(
			(r) => r.questionIndex === game.currentQuestionIndex,
		);
		if (!roundResult) {
			roundResult = {
				questionIndex: game.currentQuestionIndex,
				answers: [],
				correctOptionId: question.correctOptionId,
			};
			game.roundResults.push(roundResult);
		}

		// Check if already answered
		if (roundResult.answers.some((a) => a.playerId === playerId)) {
			return { success: false, error: "Already answered" };
		}

		const timeTaken = game.roundStartedAt
			? (Date.now() - game.roundStartedAt) / 1000
			: question.timeLimit;

		const isCorrect = optionId === question.correctOptionId;
		const score = calculateScore(timeTaken, question.timeLimit, isCorrect);

		const answer: PlayerAnswer = {
			playerId,
			optionId,
			timeTaken,
			score,
		};

		roundResult.answers.push(answer);
		player.totalScore += score;

		// Broadcast updated answer count to host
		this.broadcast(gameCode, "round:answer_count", {
			totalAnswers: roundResult.answers.length,
			totalPlayers: game.players.length,
		});

		return { success: true };
	}

	// ─── Leaderboard Computation ────────────────────────────────────────────

	computeLeaderboard(gameCode: string): LeaderboardData {
		const game = this.games.get(gameCode);
		if (!game) return { individual: [], teams: [] };

		const prevIndividual = this.previousIndividualRanks.get(gameCode) ?? new Map();
		const prevTeam = this.previousTeamRanks.get(gameCode) ?? new Map();

		// Individual leaderboard
		const individual: LeaderboardEntry[] = game.players
			.map((p) => ({
				id: p.id,
				name: p.name,
				score: Math.round(p.totalScore * 100) / 100,
				rank: 0,
				previousRank: prevIndividual.get(p.id) ?? null,
				teamId: p.teamId,
			}))
			.sort((a, b) => b.score - a.score);

		individual.forEach((entry, i) => {
			entry.rank = i + 1;
		});

		// Team leaderboard
		const teamScores = new Map<string, number>();
		for (const team of game.teams) {
			teamScores.set(team.id, 0);
		}
		for (const player of game.players) {
			const current = teamScores.get(player.teamId) ?? 0;
			teamScores.set(player.teamId, current + player.totalScore);
		}

		const teams: LeaderboardEntry[] = game.teams
			.map((t) => ({
				id: t.id,
				name: t.name,
				score: Math.round((teamScores.get(t.id) ?? 0) * 100) / 100,
				rank: 0,
				previousRank: prevTeam.get(t.id) ?? null,
			}))
			.sort((a, b) => b.score - a.score);

		teams.forEach((entry, i) => {
			entry.rank = i + 1;
		});

		// Store current ranks as previous for next computation
		const newPrevIndividual = new Map<string, number>();
		for (const entry of individual) {
			newPrevIndividual.set(entry.id, entry.rank);
		}
		this.previousIndividualRanks.set(gameCode, newPrevIndividual);

		const newPrevTeam = new Map<string, number>();
		for (const entry of teams) {
			newPrevTeam.set(entry.id, entry.rank);
		}
		this.previousTeamRanks.set(gameCode, newPrevTeam);

		return { individual, teams };
	}

	// ─── Client-safe Game State ─────────────────────────────────────────────

	getClientGameState(gameCode: string): ClientGameState | null {
		const game = this.games.get(gameCode);
		if (!game) return null;

		let currentQuestion: ClientQuestion | null = null;
		if (
			game.currentQuestionIndex >= 0 &&
			game.currentQuestionIndex < game.questions.length &&
			game.status !== "lobby" &&
			game.status !== "active_idle"
		) {
			const q = game.questions[game.currentQuestionIndex];
			currentQuestion = {
				text: q.text,
				options: q.options,
				timeLimit: q.timeLimit,
				questionIndex: game.currentQuestionIndex,
			};
		}

		const roundResults: ClientRoundResult[] = game.roundResults
			.filter((r) => {
				// Only include results for completed rounds
				const isCurrentRound = r.questionIndex === game.currentQuestionIndex;
				const roundDone =
					game.status === "round_ended" ||
					game.status === "showing_results" ||
					game.status === "game_over" ||
					game.status === "active_idle";
				return !isCurrentRound || roundDone;
			})
			.map((r) => {
				const question = game.questions[r.questionIndex];
				const distribution: Record<string, number> = {};
				for (const opt of question.options) {
					distribution[opt.id] = 0;
				}
				for (const ans of r.answers) {
					distribution[ans.optionId] = (distribution[ans.optionId] || 0) + 1;
				}
				return {
					questionIndex: r.questionIndex,
					correctOptionId: r.correctOptionId,
					answerDistribution: distribution,
					totalAnswers: r.answers.length,
				};
			});

		return {
			gameCode: game.gameCode,
			title: game.title,
			status: game.status,
			teams: game.teams,
			players: game.players.map((p) => ({
				id: p.id,
				name: p.name,
				teamId: p.teamId,
				totalScore: Math.round(p.totalScore * 100) / 100,
				connected: p.connected,
			})),
			currentQuestionIndex: game.currentQuestionIndex,
			totalQuestions: game.questions.length,
			currentQuestion,
			roundResults,
			roundStartedAt: game.roundStartedAt,
		};
	}

	/** Get result for a specific player in the current round */
	getPlayerRoundResult(
		gameCode: string,
		playerId: string,
	): { answered: boolean; optionId?: string; isCorrect?: boolean; score?: number } | null {
		const game = this.games.get(gameCode);
		if (!game) return null;

		const roundResult = game.roundResults.find(
			(r) => r.questionIndex === game.currentQuestionIndex,
		);
		if (!roundResult) return { answered: false };

		const answer = roundResult.answers.find((a) => a.playerId === playerId);
		if (!answer) return { answered: false };

		// Only reveal correctness after round ends
		if (game.status === "round_active") {
			return { answered: true };
		}

		return {
			answered: true,
			optionId: answer.optionId,
			isCorrect: answer.optionId === roundResult.correctOptionId,
			score: answer.score,
		};
	}

	getPlayerToken(gameCode: string, playerId: string): string | undefined {
		const game = this.games.get(gameCode);
		return game?.players.find((p) => p.id === playerId)?.token;
	}

	findPlayerByToken(gameCode: string, token: string): Player | undefined {
		const game = this.games.get(gameCode);
		return game?.players.find((p) => p.token === token);
	}

	// ─── Persistence ────────────────────────────────────────────────────────

	private async persistGameState(game: GameSession) {
		try {
			await persistGame({
				gameCode: game.gameCode,
				title: game.title,
				createdAt: game.createdAt,
				status: game.status,
				teams: game.teams,
				players: game.players.map((p) => ({
					id: p.id,
					name: p.name,
					teamId: p.teamId,
					totalScore: Math.round(p.totalScore * 100) / 100,
				})),
				totalQuestions: game.questions.length,
				roundResults: game.roundResults.map((r) => ({
					questionIndex: r.questionIndex,
					correctOptionId: r.correctOptionId,
					totalAnswers: r.answers.length,
				})),
			});
		} catch {
			// Non-critical — in-memory state is the source of truth
			console.error("Failed to persist game state to lowdb");
		}
	}
}

// ─── Export singleton ─────────────────────────────────────────────────────────

const globalForGM = globalThis as unknown as { __gameManager?: GameManager };
export const gameManager = globalForGM.__gameManager ?? new GameManager();
if (process.env.NODE_ENV !== "production") {
	globalForGM.__gameManager = gameManager;
}
