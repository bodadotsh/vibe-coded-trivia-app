'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [gameCode, setGameCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = gameCode.trim().toUpperCase();
    if (code.length >= 4) {
      router.push(`/play/${code}`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo / Title */}
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-answer-red">T</span>
            <span className="text-answer-blue">r</span>
            <span className="text-answer-yellow">i</span>
            <span className="text-answer-green">v</span>
            <span className="text-answer-red">i</span>
            <span className="text-answer-blue">a</span>
          </h1>
          <p className="text-muted text-lg">Real-time multiplayer trivia</p>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {!showJoin ? (
            <>
              <button
                type="button"
                onClick={() => setShowJoin(true)}
                className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Join a Game
              </button>
              <button
                type="button"
                onClick={() => router.push('/host/create')}
                className="w-full rounded-xl border border-card-border bg-card px-6 py-4 text-lg font-semibold text-foreground transition-colors hover:border-muted"
              >
                Host a Game
              </button>
            </>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Enter Game Code"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-card-border bg-card px-6 py-4 text-center text-2xl font-mono font-bold tracking-[0.3em] text-foreground placeholder:text-muted placeholder:text-base placeholder:tracking-normal placeholder:font-sans placeholder:font-normal focus:border-accent focus:outline-none"
                  maxLength={6}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoin(false);
                    setGameCode('');
                  }}
                  className="flex-1 rounded-xl border border-card-border bg-card px-6 py-3 font-semibold text-foreground transition-colors hover:border-muted"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={gameCode.trim().length < 4}
                  className="flex-1 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Join
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
