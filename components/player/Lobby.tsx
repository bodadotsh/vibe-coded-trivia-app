'use client';

import type { Team } from '@/lib/types';

interface PlayerInfo {
  id: string;
  name: string;
  teamId: string;
  connected: boolean;
}

interface LobbyProps {
  players: PlayerInfo[];
  teams: Team[];
  myPlayerId: string;
}

export function Lobby({ players, teams, myPlayerId }: LobbyProps) {
  return (
    <div className="w-full max-w-md mx-auto space-y-6 text-center">
      <div className="space-y-2">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        <h2 className="text-2xl font-bold">Waiting for host...</h2>
        <p className="text-muted">
          {players.length} player{players.length !== 1 ? 's' : ''} in the lobby
        </p>
      </div>

      <div className="space-y-4">
        {teams.map((team) => {
          const teamPlayers = players.filter((p) => p.teamId === team.id);
          if (teamPlayers.length === 0) return null;

          return (
            <div key={team.id} className="rounded-xl border border-card-border bg-card p-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                <span className="font-medium">{team.name}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {teamPlayers.map((player) => (
                  <span
                    key={player.id}
                    className={`rounded-full px-3 py-1 text-sm ${
                      player.id === myPlayerId ? 'font-bold text-white' : 'text-foreground/80'
                    }`}
                    style={{
                      backgroundColor: player.id === myPlayerId ? team.color : `${team.color}30`,
                    }}
                  >
                    {player.name}
                    {player.id === myPlayerId && ' (you)'}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
