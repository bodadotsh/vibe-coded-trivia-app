'use client';

import type { Team } from '@/lib/types';

interface TeamBadgeProps {
  team: Team;
  size?: 'sm' | 'md';
}

export function TeamBadge({ team, size = 'sm' }: TeamBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses}`}
      style={{ backgroundColor: `${team.color}25`, color: team.color }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
      {team.name}
    </span>
  );
}
