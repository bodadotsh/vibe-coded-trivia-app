"use client";

import { useReducer, useCallback } from "react";
import type { ClientGameState, LeaderboardData, ClientQuestion } from "@/lib/types";

// ─── State ────────────────────────────────────────────────────────────────────

interface GameState {
	gameState: ClientGameState | null;
	leaderboard: LeaderboardData | null;
	answerCount: { totalAnswers: number; totalPlayers: number } | null;
	myAnswer: string | null;
	roundEndData: {
		correctOptionId: string;
		answerDistribution: Record<string, number>;
		totalAnswers: number;
	} | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type GameAction =
	| { type: "SET_STATE"; payload: ClientGameState }
	| { type: "GAME_START"; payload: { status: string; totalQuestions: number } }
	| { type: "ROUND_START"; payload: { question: ClientQuestion; roundStartedAt: number } }
	| { type: "ROUND_ANSWER_COUNT"; payload: { totalAnswers: number; totalPlayers: number } }
	| {
			type: "ROUND_END";
			payload: { correctOptionId: string; answerDistribution: Record<string, number>; totalAnswers: number };
	  }
	| { type: "LEADERBOARD_UPDATE"; payload: LeaderboardData }
	| { type: "GAME_END"; payload: { leaderboard: LeaderboardData } }
	| {
			type: "PLAYER_JOINED";
			payload: {
				player: { id: string; name: string; teamId: string; totalScore: number; connected: boolean };
				totalPlayers: number;
			};
	  }
	| { type: "PLAYER_DISCONNECTED"; payload: { playerId: string } }
	| { type: "SET_MY_ANSWER"; payload: string }
	| { type: "CLEAR_ROUND" };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function gameReducer(state: GameState, action: GameAction): GameState {
	switch (action.type) {
		case "SET_STATE":
			return { ...state, gameState: action.payload };

		case "GAME_START":
			if (!state.gameState) return state;
			return {
				...state,
				gameState: {
					...state.gameState,
					status: "active_idle",
					totalQuestions: action.payload.totalQuestions,
				},
			};

		case "ROUND_START":
			if (!state.gameState) return state;
			return {
				...state,
				myAnswer: null,
				roundEndData: null,
				answerCount: null,
				leaderboard: null,
				gameState: {
					...state.gameState,
					status: "round_active",
					currentQuestion: action.payload.question,
					currentQuestionIndex: action.payload.question.questionIndex,
					roundStartedAt: action.payload.roundStartedAt,
				},
			};

		case "ROUND_ANSWER_COUNT":
			return {
				...state,
				answerCount: action.payload,
			};

		case "ROUND_END":
			if (!state.gameState) return state;
			return {
				...state,
				roundEndData: action.payload,
				gameState: {
					...state.gameState,
					status: "round_ended",
					roundStartedAt: null,
				},
			};

		case "LEADERBOARD_UPDATE":
			if (!state.gameState) return state;
			return {
				...state,
				leaderboard: action.payload,
				gameState: {
					...state.gameState,
					status: "showing_results",
				},
			};

		case "GAME_END":
			if (!state.gameState) return state;
			return {
				...state,
				leaderboard: action.payload.leaderboard,
				gameState: {
					...state.gameState,
					status: "game_over",
				},
			};

		case "PLAYER_JOINED":
			if (!state.gameState) return state;
			return {
				...state,
				gameState: {
					...state.gameState,
					players: [
						...state.gameState.players.filter((p) => p.id !== action.payload.player.id),
						action.payload.player,
					],
				},
			};

		case "PLAYER_DISCONNECTED":
			if (!state.gameState) return state;
			return {
				...state,
				gameState: {
					...state.gameState,
					players: state.gameState.players.map((p) =>
						p.id === action.payload.playerId ? { ...p, connected: false } : p,
					),
				},
			};

		case "SET_MY_ANSWER":
			return { ...state, myAnswer: action.payload };

		case "CLEAR_ROUND":
			return {
				...state,
				myAnswer: null,
				roundEndData: null,
				answerCount: null,
			};

		default:
			return state;
	}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const initialState: GameState = {
	gameState: null,
	leaderboard: null,
	answerCount: null,
	myAnswer: null,
	roundEndData: null,
};

export function useGameReducer() {
	const [state, dispatch] = useReducer(gameReducer, initialState);

	const handleSSEEvent = useCallback(
		(event: string, data: unknown) => {
			// biome-ignore lint: SSE data is untyped, safe casts via unknown
			const d = data as never;
			switch (event) {
				case "game:state":
					dispatch({ type: "SET_STATE", payload: d as ClientGameState });
					break;
				case "game:start":
					dispatch({
						type: "GAME_START",
						payload: d as { status: string; totalQuestions: number },
					});
					break;
				case "round:start":
					dispatch({
						type: "ROUND_START",
						payload: d as { question: ClientQuestion; roundStartedAt: number },
					});
					break;
				case "round:answer_count":
					dispatch({
						type: "ROUND_ANSWER_COUNT",
						payload: d as { totalAnswers: number; totalPlayers: number },
					});
					break;
				case "round:end":
					dispatch({
						type: "ROUND_END",
						payload: d as {
							correctOptionId: string;
							answerDistribution: Record<string, number>;
							totalAnswers: number;
						},
					});
					break;
				case "leaderboard:update":
					dispatch({ type: "LEADERBOARD_UPDATE", payload: d as LeaderboardData });
					break;
				case "game:end":
					dispatch({
						type: "GAME_END",
						payload: d as { leaderboard: LeaderboardData },
					});
					break;
				case "player:joined":
					dispatch({
						type: "PLAYER_JOINED",
						payload: d as {
							player: {
								id: string;
								name: string;
								teamId: string;
								totalScore: number;
								connected: boolean;
							};
							totalPlayers: number;
						},
					});
					break;
				case "player:disconnected":
					dispatch({
						type: "PLAYER_DISCONNECTED",
						payload: d as { playerId: string },
					});
					break;
			}
		},
		[],
	);

	const setMyAnswer = useCallback((optionId: string) => {
		dispatch({ type: "SET_MY_ANSWER", payload: optionId });
	}, []);

	return { state, dispatch, handleSSEEvent, setMyAnswer };
}
