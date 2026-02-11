'use client';

import type { Team } from '@/lib/types';

interface PlayerInfo {
  id: string;
  name: string;
  teamId: string;
  totalScore: number;
  connected: boolean;
}

interface PlayerListProps {
  players: PlayerInfo[];
  teams: Team[];
}

export function PlayerList({ players, teams }: PlayerListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Players</span>
        <span>
          {players.filter((p) => p.connected).length} / {players.length} connected
        </span>
      </div>

      {teams.map((team) => {
        const teamPlayers = players.filter((p) => p.teamId === team.id);
        if (teamPlayers.length === 0) return null;

        return (
          <div key={team.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
              <span className="text-sm font-medium">{team.name}</span>
              <span className="text-xs text-muted">({teamPlayers.length})</span>
            </div>
            <div className="ml-5 space-y-0.5">
              {teamPlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between text-sm">
                  <span className={player.connected ? 'text-foreground' : 'text-muted line-through'}>
                    {player.name}
                  </span>
                  <span className="font-mono text-xs text-muted">{player.totalScore.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {players.length === 0 && <p className="text-center text-sm text-muted py-4">No players yet</p>}
    </div>
  );
}
