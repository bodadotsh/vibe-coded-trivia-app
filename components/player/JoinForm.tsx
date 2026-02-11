'use client';

import { useState } from 'react';
import type { ClientGameState, Team } from '@/lib/types';

interface JoinFormProps {
  gameCode: string;
  teams: Team[];
  onJoined: (data: { playerId: string; playerToken: string; gameState: ClientGameState }) => void;
}

export function JoinForm({ gameCode, teams, onJoined }: JoinFormProps) {
  const [step, setStep] = useState<'credentials' | 'team'>('credentials');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/game/${gameCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          displayName: displayName.trim(),
          teamId: selectedTeamId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to join');
        return;
      }

      onJoined({ playerId: data.playerId, playerToken: data.playerToken, gameState: data.gameState });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'credentials') {
    return (
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">Join Game</h2>
          <p className="font-mono text-accent text-lg tracking-widest">{gameCode}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-muted">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              className="w-full rounded-xl border border-card-border bg-card px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              maxLength={30}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-muted">
              Game Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter game password"
              className="w-full rounded-xl border border-card-border bg-card px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-answer-red">{error}</p>}

          <button
            type="button"
            onClick={() => {
              if (!displayName.trim()) {
                setError('Please enter your name');
                return;
              }
              if (!password) {
                setError('Please enter the game password');
                return;
              }
              setError('');
              setStep('team');
            }}
            className="w-full rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // Team selection step
  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">Choose Your Team</h2>
        <p className="text-sm text-muted">
          Playing as <span className="text-foreground font-medium">{displayName}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            onClick={() => setSelectedTeamId(team.id)}
            className={`rounded-xl p-4 text-center font-semibold text-white transition-all ${
              selectedTeamId === team.id
                ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-105'
                : 'opacity-70 hover:opacity-100'
            }`}
            style={{ backgroundColor: team.color }}
          >
            {team.name}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-answer-red text-center">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setStep('credentials');
            setSelectedTeamId('');
            setError('');
          }}
          className="flex-1 rounded-xl border border-card-border bg-card px-4 py-3 font-semibold text-foreground"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (!selectedTeamId) {
              setError('Please select a team');
              return;
            }
            handleJoin();
          }}
          disabled={loading || !selectedTeamId}
          className="flex-1 rounded-xl bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Join Game'}
        </button>
      </div>
    </div>
  );
}
