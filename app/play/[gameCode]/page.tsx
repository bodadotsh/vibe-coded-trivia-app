"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useGameEvents } from "@/hooks/use-game-events";
import { useGameReducer } from "@/hooks/use-game-state";
import { JoinForm } from "@/components/player/JoinForm";
import { Lobby } from "@/components/player/Lobby";
import { QuestionView } from "@/components/player/QuestionView";
import { ResultView } from "@/components/player/ResultView";
import { Leaderboard } from "@/components/shared/Leaderboard";
import type { ClientGameState } from "@/lib/types";

export default function PlayerPage({
	params,
}: {
	params: Promise<{ gameCode: string }>;
}) {
	const { gameCode } = use(params);
	const router = useRouter();
	const [playerId, setPlayerId] = useState<string | null>(null);
	const [playerToken, setPlayerToken] = useState<string | null>(null);
	const [gameExists, setGameExists] = useState<boolean | null>(null);
	const [initialState, setInitialState] = useState<ClientGameState | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const { state, handleSSEEvent, setMyAnswer } = useGameReducer();

	// Check if game exists and load initial state
	useEffect(() => {
		async function checkGame() {
			try {
				const res = await fetch(`/api/game/${gameCode}`);
				if (res.ok) {
					const data = await res.json();
					setInitialState(data);
					setGameExists(true);
				} else {
					setGameExists(false);
				}
			} catch {
				setGameExists(false);
			}
		}

		// Check if player has stored session
		const storedToken = sessionStorage.getItem(`player-token-${gameCode}`);
		const storedId = sessionStorage.getItem(`player-id-${gameCode}`);
		if (storedToken && storedId) {
			setPlayerToken(storedToken);
			setPlayerId(storedId);
		}

		checkGame();
	}, [gameCode]);

	// Connect to SSE once joined
	const { connected } = useGameEvents({
		gameCode,
		token: playerToken ?? "",
		role: "player",
		onEvent: handleSSEEvent,
	});

	const handleJoined = useCallback(
		(data: { playerId: string; playerToken: string }) => {
			setPlayerId(data.playerId);
			setPlayerToken(data.playerToken);
			sessionStorage.setItem(`player-token-${gameCode}`, data.playerToken);
			sessionStorage.setItem(`player-id-${gameCode}`, data.playerId);
		},
		[gameCode],
	);

	const handleAnswer = useCallback(
		async (optionId: string) => {
			if (!playerToken || submitting) return;
			setSubmitting(true);
			setMyAnswer(optionId);

			try {
				await fetch(`/api/game/${gameCode}/answer`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${playerToken}`,
					},
					body: JSON.stringify({ optionId }),
				});
			} catch {
				// Answer might still have been received
			} finally {
				setSubmitting(false);
			}
		},
		[gameCode, playerToken, submitting, setMyAnswer],
	);

	// ─── Render states ──────────────────────────────────────────────────────

	// Loading
	if (gameExists === null) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center space-y-2">
					<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
					<p className="text-muted">Loading game...</p>
				</div>
			</div>
		);
	}

	// Game not found
	if (!gameExists) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center space-y-4">
				<div className="text-5xl">&#128533;</div>
				<h2 className="text-2xl font-bold">Game Not Found</h2>
				<p className="text-muted">The game code &ldquo;{gameCode}&rdquo; doesn&apos;t exist.</p>
				<button
					type="button"
					onClick={() => router.push("/")}
					className="rounded-xl bg-accent px-6 py-3 font-medium text-white"
				>
					Go Home
				</button>
			</div>
		);
	}

	// Need to join
	if (!playerToken || !playerId) {
		return (
			<div className="flex min-h-screen items-center justify-center px-4 py-8">
				<JoinForm
					gameCode={gameCode}
					teams={initialState?.teams ?? []}
					onJoined={handleJoined}
				/>
			</div>
		);
	}

	// Connected - waiting for SSE state
	const gs = state.gameState;
	if (!gs) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center space-y-2">
					<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
					<p className="text-muted">
						{connected ? "Loading game state..." : "Connecting..."}
					</p>
				</div>
			</div>
		);
	}

	// Lobby
	if (gs.status === "lobby" || gs.status === "active_idle") {
		return (
			<div className="flex min-h-screen items-center justify-center px-4 py-8">
				<Lobby players={gs.players} teams={gs.teams} myPlayerId={playerId} />
			</div>
		);
	}

	// Active round
	if (gs.status === "round_active" && gs.currentQuestion && gs.roundStartedAt) {
		return (
			<QuestionView
				question={gs.currentQuestion}
				roundStartedAt={gs.roundStartedAt}
				selectedOptionId={state.myAnswer}
				onSelect={handleAnswer}
				disabled={submitting}
			/>
		);
	}

	// Round ended - show result
	if (gs.status === "round_ended" && state.roundEndData && gs.currentQuestion) {
		const correctOption = gs.currentQuestion.options.find(
			(o) => o.id === state.roundEndData?.correctOptionId,
		);
		const selectedOption = state.myAnswer
			? gs.currentQuestion.options.find((o) => o.id === state.myAnswer)
			: null;

		// Find this player's score for the round
		const myPlayerData = gs.players.find((p) => p.id === playerId);
		const isCorrect = state.myAnswer === state.roundEndData.correctOptionId;
		// Approximate score from the player's total score change (not perfect but functional)
		const score = isCorrect ? (myPlayerData?.totalScore ?? 0) : 0;

		return (
			<div className="flex min-h-screen items-center justify-center px-4">
				<ResultView
					isCorrect={isCorrect}
					score={score}
					correctOptionText={correctOption?.text ?? ""}
					selectedOptionText={selectedOption?.text ?? "No answer"}
					answered={state.myAnswer !== null}
				/>
			</div>
		);
	}

	// Showing leaderboard
	if (gs.status === "showing_results" && state.leaderboard) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
				<div className="w-full max-w-lg space-y-4">
					<h2 className="text-2xl font-bold text-center">Leaderboard</h2>
					<Leaderboard
						data={state.leaderboard}
						teams={gs.teams}
						highlightPlayerId={playerId}
					/>
					<p className="text-center text-sm text-muted">
						Waiting for the next round...
					</p>
				</div>
			</div>
		);
	}

	// Game over
	if (gs.status === "game_over") {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
				<div className="w-full max-w-lg space-y-6 text-center">
					<div className="space-y-2">
						<div className="text-5xl">&#127942;</div>
						<h2 className="text-3xl font-bold">Game Over!</h2>
					</div>

					{state.leaderboard && (
						<Leaderboard
							data={state.leaderboard}
							teams={gs.teams}
							highlightPlayerId={playerId}
						/>
					)}

					{/* Player's final rank */}
					{state.leaderboard && (() => {
						const myEntry = state.leaderboard.individual.find(
							(e) => e.id === playerId,
						);
						if (!myEntry) return null;
						return (
							<div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
								<p className="text-muted">Your final rank</p>
								<p className="text-3xl font-bold">
									#{myEntry.rank}{" "}
									<span className="text-lg text-accent">
										({myEntry.score.toFixed(2)} pts)
									</span>
								</p>
							</div>
						);
					})()}

					<button
						type="button"
						onClick={() => router.push("/")}
						className="rounded-xl bg-accent px-6 py-3 font-medium text-white"
					>
						Back to Home
					</button>
				</div>
			</div>
		);
	}

	// Fallback
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="text-center space-y-2">
				<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
				<p className="text-muted">Loading...</p>
			</div>
		</div>
	);
}
