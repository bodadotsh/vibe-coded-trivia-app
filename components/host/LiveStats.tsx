'use client';

interface LiveStatsProps {
  totalPlayers: number;
  connectedPlayers: number;
  totalAnswers: number | null;
  totalPlayersForRound: number;
  currentRound: number;
  totalRounds: number;
  status: string;
}

export function LiveStats({
  totalPlayers,
  connectedPlayers,
  totalAnswers,
  totalPlayersForRound,
  currentRound,
  totalRounds,
  status,
}: LiveStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Players" value={`${connectedPlayers}/${totalPlayers}`} sub="connected" />
      <StatCard
        label="Round"
        value={currentRound > 0 ? `${currentRound}/${totalRounds}` : '-'}
        sub={status === 'round_active' ? 'active' : status.replace(/_/g, ' ')}
      />
      {status === 'round_active' && totalAnswers !== null && (
        <>
          <StatCard label="Answers" value={`${totalAnswers}/${totalPlayersForRound}`} sub="submitted" />
          <StatCard label="Remaining" value={`${totalPlayersForRound - totalAnswers}`} sub="waiting" />
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  );
}
