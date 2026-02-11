'use client';

import { useEffect, useRef, useState } from 'react';

interface CountdownTimerProps {
  /** When the round started (ISO string or ms timestamp from server) */
  roundStartedAt: string | number;
  /** Total time limit in seconds */
  timeLimit: number;
  /** Called when timer hits zero */
  onExpired?: () => void;
  /** Size variant */
  size?: 'sm' | 'lg';
}

export function CountdownTimer({ roundStartedAt, timeLimit, onExpired, size = 'lg' }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(timeLimit);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;

    const startMs = typeof roundStartedAt === 'string' ? new Date(roundStartedAt).getTime() : roundStartedAt;
    const tick = () => {
      const elapsed = (Date.now() - startMs) / 1000;
      const left = Math.max(0, timeLimit - elapsed);
      setRemaining(left);

      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired?.();
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [roundStartedAt, timeLimit, onExpired]);

  const fraction = remaining / timeLimit;
  const isUrgent = remaining <= 5;

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-card-border">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${fraction * 100}%`,
              backgroundColor: isUrgent ? 'var(--answer-red)' : 'var(--accent)',
            }}
          />
        </div>
        <span className={`text-sm font-mono font-bold ${isUrgent ? 'text-answer-red' : 'text-foreground'}`}>
          {Math.ceil(remaining)}s
        </span>
      </div>
    );
  }

  // Large circular timer
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference * (1 - fraction);

  return (
    <div className={`relative inline-flex items-center justify-center ${isUrgent ? 'animate-countdown-pulse' : ''}`}>
      <svg width="120" height="120" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--card-border)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={isUrgent ? 'var(--answer-red)' : 'var(--accent)'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-200"
        />
      </svg>
      <span className={`absolute text-3xl font-bold font-mono ${isUrgent ? 'text-answer-red' : 'text-foreground'}`}>
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}
