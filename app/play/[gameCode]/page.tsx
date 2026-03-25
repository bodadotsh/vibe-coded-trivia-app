'use client';

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { JoinForm } from '@/components/player/JoinForm';
import { Lobby } from '@/components/player/Lobby';
import { QuestionView } from '@/components/player/QuestionView';
import { ResultView } from '@/components/player/ResultView';
import { Leaderboard } from '@/components/shared/Leaderboard';
import { useGameEvents } from '@/hooks/use-game-events';
import { useGameReducer } from '@/hooks/use-game-state';
import { useSupabase } from '@/hooks/use-supabase';
import type { ClientGameState } from '@/lib/types';

export default function PlayerPage({ params }: { params: Promise<{ gameCode: string }> }) {
  const { gameCode } = use(params);
  const router = useRouter();
  const { user, ready } = useSupabase();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [gameExists, setGameExists] = useState<boolean | null>(null);
  const [initialTeams, setInitialTeams] = useState<ClientGameState['teams']>([]);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { state, dispatch, handleBroadcastEvent, setMyAnswer } = useGameReducer();

  // ─── Fetch game state via REST ──────────────────────────────────────────
  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${gameCode}`, { cache: 'no-store' });
      if (res.ok) {
        return (await res.json()) as ClientGameState;
      }
    } catch {
      // ignore
    }
    return null;
  }, [gameCode]);

  const refreshGameState = useCallback(async () => {
    const data = await fetchGameState();
    if (data) {
      dispatch({ type: 'SET_STATE', payload: data });
    }
    return data;
  }, [dispatch, fetchGameState]);

  // Check if game exists on mount
  useEffect(() => {
    if (!ready) return;

    async function checkGame() {
      const data = await refreshGameState();
      if (data) {
        setInitialTeams(data.teams);
        setGameExists(true);

        // Check if the user already joined this game (page reload)
        if (user) {
          const existingPlayer = data.players.find((p: { id: string }) => {
            // We need to check by stored playerId from sessionStorage
            const storedId = sessionStorage.getItem(`player-id-${gameCode}`);
            return storedId && p.id === storedId;
          });
          if (existingPlayer) {
            setPlayerId(existingPlayer.id);
            setHasJoined(true);
          }
        }
      } else {
        setGameExists(false);
      }
    }

    checkGame();
  }, [gameCode, ready, user, refreshGameState]);

  // Connect to Supabase Broadcast
  const { connected } = useGameEvents({
    gameCode,
    enabled: hasJoined,
    onEvent: handleBroadcastEvent,
  });

  // ─── REST polling fallback when Broadcast is not connected ──────────────
  useEffect(() => {
    if (!hasJoined) return;

    if (connected) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (!pollRef.current) {
      pollRef.current = setInterval(async () => {
        await refreshGameState();
      }, 3000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [connected, hasJoined, refreshGameState]);

  // ─── Join handler ───────────────────────────────────────────────────────
  const handleJoined = useCallback(
    (data: { playerId: string; gameState: ClientGameState }) => {
      setPlayerId(data.playerId);
      setHasJoined(true);
      sessionStorage.setItem(`player-id-${gameCode}`, data.playerId);
      dispatch({ type: 'SET_STATE', payload: data.gameState });
    },
    [gameCode, dispatch],
  );

  // ─── Answer handler ─────────────────────────────────────────────────────
  const handleAnswer = useCallback(
    async (optionId: string) => {
      if (submitting) return;
      setSubmitting(true);
      setMyAnswer(optionId);

      try {
        await fetch(`/api/game/${gameCode}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionId }),
        });
      } catch {
        // Answer might still have been received
      } finally {
        setSubmitting(false);
      }
    },
    [gameCode, submitting, setMyAnswer],
  );

  // ─── Render states ──────────────────────────────────────────────────────

  // Loading auth
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-muted">Initializing...</p>
        </div>
      </div>
    );
  }

  // Loading game check
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
          onClick={() => router.push('/')}
          className="rounded-xl bg-accent px-6 py-3 font-medium text-white"
        >
          Go Home
        </button>
      </div>
    );
  }

  // Need to join
  if (!hasJoined || !playerId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <JoinForm gameCode={gameCode} teams={initialTeams} onJoined={handleJoined} />
      </div>
    );
  }

  // Waiting for any state
  const gs = state.gameState;
  if (!gs) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-muted">Connecting...</p>
        </div>
      </div>
    );
  }

  // Lobby
  if (gs.status === 'lobby' || gs.status === 'active_idle') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <Lobby players={gs.players} teams={gs.teams} myPlayerId={playerId} />
      </div>
    );
  }

  // Active round
  if (gs.status === 'round_active' && gs.currentQuestion && gs.roundStartedAt) {
    return (
      <QuestionView
        question={gs.currentQuestion}
        roundStartedAt={gs.roundStartedAt}
        selectedOptionId={state.myAnswer}
        onSelect={handleAnswer}
        disabled={submitting}
        onExpired={() => {
          void refreshGameState();
        }}
      />
    );
  }

  // Round ended - show result
  if (gs.status === 'round_ended' && state.roundEndData && gs.currentQuestion) {
    const correctOption = gs.currentQuestion.options.find((o) => o.id === state.roundEndData?.correctOptionId);
    const selectedOption = state.myAnswer ? gs.currentQuestion.options.find((o) => o.id === state.myAnswer) : null;

    const isCorrect = state.myAnswer === state.roundEndData.correctOptionId;
    const score = playerId ? (state.roundEndData.roundScores?.[playerId] ?? 0) : 0;

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <ResultView
          isCorrect={isCorrect}
          score={score}
          correctOptionText={correctOption?.text ?? ''}
          selectedOptionText={selectedOption?.text ?? 'No answer'}
          answered={state.myAnswer !== null}
        />
      </div>
    );
  }

  // Showing leaderboard
  if (gs.status === 'showing_results' && state.leaderboard) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-4">
          <h2 className="text-2xl font-bold text-center">Leaderboard</h2>
          <Leaderboard data={state.leaderboard} teams={gs.teams} highlightPlayerId={playerId} />
          <p className="text-center text-sm text-muted">Waiting for the next round...</p>
        </div>
      </div>
    );
  }

  // Game over
  if (gs.status === 'game_over') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-6 text-center">
          <div className="space-y-2">
            <div className="text-5xl">&#127942;</div>
            <h2 className="text-3xl font-bold">Game Over!</h2>
          </div>

          {state.leaderboard && <Leaderboard data={state.leaderboard} teams={gs.teams} highlightPlayerId={playerId} />}

          {state.leaderboard &&
            (() => {
              const myEntry = state.leaderboard.individual.find((e) => e.id === playerId);
              if (!myEntry) return null;
              return (
                <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
                  <p className="text-muted">Your final rank</p>
                  <p className="text-3xl font-bold">
                    #{myEntry.rank} <span className="text-lg text-accent">({Math.round(myEntry.score)} pts)</span>
                  </p>
                </div>
              );
            })()}

          <button
            type="button"
            onClick={() => router.push('/')}
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
        <p className="text-muted">Waiting for host to advance the game...</p>
        <p className="text-xs text-muted">Game status: {gs.status}</p>
      </div>
    </div>
  );
}
