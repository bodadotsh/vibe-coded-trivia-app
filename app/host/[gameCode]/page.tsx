'use client';

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { AnswerDistribution } from '@/components/host/AnswerDistribution';
import { GameControls } from '@/components/host/GameControls';
import { LiveStats } from '@/components/host/LiveStats';
import { PlayerList } from '@/components/host/PlayerList';
import { QuestionPreview } from '@/components/host/QuestionPreview';
import { CountdownTimer } from '@/components/shared/CountdownTimer';
import { Leaderboard } from '@/components/shared/Leaderboard';
import { useGameEvents } from '@/hooks/use-game-events';
import { useGameReducer } from '@/hooks/use-game-state';
import { useSupabase } from '@/hooks/use-supabase';
import type { ClientGameState } from '@/lib/types';

export default function HostDashboard({ params }: { params: Promise<{ gameCode: string }> }) {
  const { gameCode } = use(params);
  const router = useRouter();
  const { user, ready } = useSupabase();
  const [actionLoading, setActionLoading] = useState(false);
  const [isHost, setIsHost] = useState<boolean | null>(null);
  const { state, dispatch, handleBroadcastEvent } = useGameReducer();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch game state via REST ──────────────────────────────────────────
  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${gameCode}`);
      if (res.ok) {
        return (await res.json()) as ClientGameState;
      }
    } catch {
      // ignore
    }
    return null;
  }, [gameCode]);

  // Verify host + hydrate initial state
  useEffect(() => {
    if (!ready || !user) return;

    fetchGameState().then((data) => {
      if (!data) {
        router.push('/');
        return;
      }
      if (data.hostUserId !== user.id) {
        router.push('/');
        return;
      }
      setIsHost(true);
      dispatch({ type: 'SET_STATE', payload: data });
    });
  }, [ready, user, gameCode, router, fetchGameState, dispatch]);

  // Connect to Supabase Broadcast
  const { connected } = useGameEvents({
    gameCode,
    enabled: isHost === true,
    onEvent: handleBroadcastEvent,
  });

  // ─── REST polling fallback when Broadcast is not connected ──────────────
  useEffect(() => {
    if (!isHost) return;

    if (connected) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (!pollRef.current) {
      pollRef.current = setInterval(async () => {
        const data = await fetchGameState();
        if (data) {
          dispatch({ type: 'SET_STATE', payload: data });
        }
      }, 3000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [connected, isHost, fetchGameState, dispatch]);

  // ─── Host actions ───────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (action: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/game/${gameCode}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error('Action failed:', data.error);
        } else if (data.state) {
          dispatch({ type: 'SET_STATE', payload: data.state });
        }
      } catch (err) {
        console.error('Action error:', err);
      } finally {
        setActionLoading(false);
      }
    },
    [gameCode, dispatch],
  );

  if (!ready || isHost === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-muted">Loading...</p>
        </div>
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
              <span className="font-mono text-lg font-bold text-accent tracking-widest">{gs.gameCode}</span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${
                  connected ? 'text-answer-green' : 'text-answer-yellow'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {connected ? 'Live' : 'Polling'}
              </span>
            </div>
          </div>
          {gs.status === 'lobby' && (
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
            {gs.status === 'round_active' && gs.roundStartedAt && gs.currentQuestion && (
              <div className="flex justify-center">
                <CountdownTimer roundStartedAt={gs.roundStartedAt} timeLimit={gs.currentQuestion.timeLimit} size="lg" />
              </div>
            )}

            {/* Question Preview */}
            <QuestionPreview
              question={gs.currentQuestion}
              correctOptionId={state.roundEndData?.correctOptionId}
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
            {state.leaderboard && (gs.status === 'showing_results' || gs.status === 'game_over') && (
              <Leaderboard data={state.leaderboard} teams={gs.teams} />
            )}

            {/* Game Over */}
            {gs.status === 'game_over' && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-6 text-center space-y-3">
                <h2 className="text-2xl font-bold">Game Over!</h2>
                <p className="text-muted">
                  {gs.players.length} players &middot; {gs.currentQuestionIndex + 1} rounds played
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/')}
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
