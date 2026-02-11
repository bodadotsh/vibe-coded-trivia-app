"use client";

import type { GameStatus } from "@/lib/types";

interface GameControlsProps {
	status: GameStatus;
	currentQuestionIndex: number;
	totalQuestions: number;
	onAction: (action: string) => void;
	loading: boolean;
}

export function GameControls({
	status,
	currentQuestionIndex,
	totalQuestions,
	onAction,
	loading,
}: GameControlsProps) {
	const hasMoreQuestions = currentQuestionIndex + 1 < totalQuestions;

	return (
		<div className="space-y-3">
			{status === "lobby" && (
				<button
					type="button"
					onClick={() => onAction("start")}
					disabled={loading}
					className="w-full rounded-xl bg-answer-green px-6 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					Start Game
				</button>
			)}

			{status === "active_idle" && hasMoreQuestions && (
				<button
					type="button"
					onClick={() => onAction("nextRound")}
					disabled={loading}
					className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					Start Round {currentQuestionIndex + 2} of {totalQuestions}
				</button>
			)}

			{status === "round_active" && (
				<button
					type="button"
					onClick={() => onAction("endRound")}
					disabled={loading}
					className="w-full rounded-xl bg-answer-red px-6 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					End Round Early
				</button>
			)}

			{status === "round_ended" && (
				<button
					type="button"
					onClick={() => onAction("showResults")}
					disabled={loading}
					className="w-full rounded-xl bg-answer-yellow px-6 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					Show Results
				</button>
			)}

			{status === "showing_results" && (
				<div className="space-y-2">
					{hasMoreQuestions && (
						<button
							type="button"
							onClick={() => onAction("nextRound")}
							disabled={loading}
							className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							Next Round ({currentQuestionIndex + 2} of {totalQuestions})
						</button>
					)}
					<button
						type="button"
						onClick={() => onAction("endGame")}
						disabled={loading}
						className="w-full rounded-xl border border-answer-red/50 bg-answer-red/10 px-6 py-3 font-bold text-answer-red transition-opacity hover:bg-answer-red/20 disabled:opacity-50"
					>
						{hasMoreQuestions ? "End Game Early" : "End Game"}
					</button>
				</div>
			)}

			{(status === "active_idle" || status === "round_active") && (
				<button
					type="button"
					onClick={() => onAction("endGame")}
					disabled={loading}
					className="w-full rounded-xl border border-card-border bg-card px-4 py-2 text-sm text-muted transition-colors hover:text-answer-red hover:border-answer-red/50 disabled:opacity-50"
				>
					End Game
				</button>
			)}
		</div>
	);
}
