"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useGameEvents } from "@/hooks/use-game-events";
import { useGameReducer } from "@/hooks/use-game-state";
import { GameControls } from "@/components/host/GameControls";
import { QuestionPreview } from "@/components/host/QuestionPreview";
import { AnswerDistribution } from "@/components/host/AnswerDistribution";
import { PlayerList } from "@/components/host/PlayerList";
import { LiveStats } from "@/components/host/LiveStats";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { CountdownTimer } from "@/components/shared/CountdownTimer";

export default function HostDashboard({
	params,
}: {
	params: Promise<{ gameCode: string }>;
}) {
	const { gameCode } = use(params);
	const router = useRouter();
	const [hostToken, setHostToken] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState(false);
	const { state, handleSSEEvent } = useGameReducer();

	// Get host token from sessionStorage
	useEffect(() => {
		const token = sessionStorage.getItem(`host-token-${gameCode}`);
		if (!token) {
			router.push("/");
			return;
		}
		setHostToken(token);
	}, [gameCode, router]);

	// Connect to SSE
	const { connected } = useGameEvents({
		gameCode,
		token: hostToken ?? "",
		role: "host",
		onEvent: handleSSEEvent,
	});

	const handleAction = useCallback(
		async (action: string) => {
			if (!hostToken) return;
			setActionLoading(true);
			try {
				const res = await fetch(`/api/game/${gameCode}/control`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${hostToken}`,
					},
					body: JSON.stringify({ action }),
				});

				if (!res.ok) {
					const data = await res.json();
					console.error("Action failed:", data.error);
				}
			} catch (err) {
				console.error("Action error:", err);
			} finally {
				setActionLoading(false);
			}
		},
		[gameCode, hostToken],
	);

	if (!hostToken) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<p className="text-muted">Loading...</p>
			</div>
		);
	}

	const gs = state.gameState;
	if (!gs) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center space-y-2">
					<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
					<p className="text-muted">Connecting to game...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen px-4 py-6">
			<div className="mx-auto max-w-7xl space-y-6">
				{/* Header */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold">{gs.title}</h1>
						<div className="flex items-center gap-3 mt-1">
							<span className="font-mono text-lg font-bold text-accent tracking-widest">
								{gs.gameCode}
							</span>
							<span
								className={`inline-flex items-center gap-1.5 text-xs ${
									connected ? "text-answer-green" : "text-answer-red"
								}`}
							>
								<span className="h-2 w-2 rounded-full bg-current" />
								{connected ? "Connected" : "Disconnected"}
							</span>
						</div>
					</div>
					{gs.status === "lobby" && (
						<div className="rounded-lg bg-card border border-card-border px-4 py-2 text-sm">
							<span className="text-muted">Share code: </span>
							<span className="font-mono font-bold text-accent tracking-widest">{gs.gameCode}</span>
						</div>
					)}
				</div>

				{/* Main content - split view */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
					{/* Left column: Question + Controls */}
					<div className="lg:col-span-2 space-y-6">
						{/* Timer during active round */}
						{gs.status === "round_active" && gs.roundStartedAt && gs.currentQuestion && (
							<div className="flex justify-center">
								<CountdownTimer
									roundStartedAt={gs.roundStartedAt}
									timeLimit={gs.currentQuestion.timeLimit}
									size="lg"
								/>
							</div>
						)}

						{/* Question Preview */}
						<QuestionPreview
							question={gs.currentQuestion}
							correctOptionId={
								state.roundEndData?.correctOptionId
							}
							questionIndex={gs.currentQuestionIndex}
							totalQuestions={gs.totalQuestions}
						/>

						{/* Answer Distribution (after round ends) */}
						{state.roundEndData && gs.currentQuestion && (
							<AnswerDistribution
								options={gs.currentQuestion.options}
								distribution={state.roundEndData.answerDistribution}
								correctOptionId={state.roundEndData.correctOptionId}
								totalAnswers={state.roundEndData.totalAnswers}
							/>
						)}

						{/* Leaderboard */}
						{state.leaderboard && (gs.status === "showing_results" || gs.status === "game_over") && (
							<Leaderboard data={state.leaderboard} teams={gs.teams} />
						)}

						{/* Game Over */}
						{gs.status === "game_over" && (
							<div className="rounded-xl border border-accent/30 bg-accent/10 p-6 text-center space-y-3">
								<h2 className="text-2xl font-bold">Game Over!</h2>
								<p className="text-muted">
									{gs.players.length} players &middot; {gs.roundResults.length} rounds played
								</p>
								<button
									type="button"
									onClick={() => router.push("/")}
									className="rounded-lg bg-accent px-6 py-2 font-medium text-white"
								>
									Back to Home
								</button>
							</div>
						)}
					</div>

					{/* Right column: Controls + Stats + Players */}
					<div className="space-y-6">
						{/* Game Controls */}
						<div className="rounded-xl border border-card-border bg-card p-4">
							<GameControls
								status={gs.status}
								currentQuestionIndex={gs.currentQuestionIndex}
								totalQuestions={gs.totalQuestions}
								onAction={handleAction}
								loading={actionLoading}
							/>
						</div>

						{/* Live Stats */}
						<div className="rounded-xl border border-card-border bg-card p-4">
							<LiveStats
								totalPlayers={gs.players.length}
								connectedPlayers={gs.players.filter((p) => p.connected).length}
								totalAnswers={state.answerCount?.totalAnswers ?? null}
								totalPlayersForRound={gs.players.length}
								currentRound={gs.currentQuestionIndex + 1}
								totalRounds={gs.totalQuestions}
								status={gs.status}
							/>
						</div>

						{/* Player List */}
						<div className="rounded-xl border border-card-border bg-card p-4">
							<PlayerList players={gs.players} teams={gs.teams} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
