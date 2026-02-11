'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useSupabase } from '@/hooks/use-supabase';
import type { Question } from '@/lib/types';

const DEFAULT_TEAM_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c'];

interface TeamInput {
  name: string;
  color: string;
}

export default function CreateGame() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ready } = useSupabase();

  const [title, setTitle] = useState('');
  const [gamePassword, setGamePassword] = useState('');
  const [teams, setTeams] = useState<TeamInput[]>([
    { name: 'Red Team', color: DEFAULT_TEAM_COLORS[0] },
    { name: 'Blue Team', color: DEFAULT_TEAM_COLORS[1] },
  ]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsFileName, setQuestionsFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function addTeam() {
    if (teams.length >= 8) return;
    const colorIndex = teams.length % DEFAULT_TEAM_COLORS.length;
    setTeams([...teams, { name: '', color: DEFAULT_TEAM_COLORS[colorIndex] }]);
  }

  function removeTeam(index: number) {
    if (teams.length <= 2) return;
    setTeams(teams.filter((_, i) => i !== index));
  }

  function updateTeam(index: number, field: keyof TeamInput, value: string) {
    const updated = [...teams];
    updated[index] = { ...updated[index], [field]: value };
    setTeams(updated);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      let parsedQuestions: Question[];
      if (Array.isArray(data)) {
        parsedQuestions = data;
      } else if (data.questions && Array.isArray(data.questions)) {
        parsedQuestions = data.questions;
        if (data.title && !title) {
          setTitle(data.title);
        }
      } else {
        setError("Invalid JSON format. Expected an array of questions or an object with a 'questions' array.");
        return;
      }

      for (let i = 0; i < parsedQuestions.length; i++) {
        const q = parsedQuestions[i];
        if (!q.text || !q.options || q.options.length !== 4 || !q.correctOptionId) {
          setError(`Invalid question at index ${i}. Each question needs text, 4 options, and correctOptionId.`);
          return;
        }
        if (!q.timeLimit || q.timeLimit < 5 || q.timeLimit > 120) {
          parsedQuestions[i] = { ...q, timeLimit: 20 };
        }
      }

      setQuestions(parsedQuestions);
      setQuestionsFileName(file.name);
      setError('');
    } catch {
      setError('Failed to parse JSON file. Please check the format.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Game title is required');
      return;
    }
    if (gamePassword.length < 4) {
      setError('Game password must be at least 4 characters');
      return;
    }
    if (teams.some((t) => !t.name.trim())) {
      setError('All teams must have a name');
      return;
    }
    if (questions.length === 0) {
      setError('Please upload a questions file');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          gamePassword,
          teams: teams.map((t) => ({ name: t.name.trim(), color: t.color })),
          questions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create game');
        return;
      }

      router.push(`/host/${data.gameCode}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            &larr; Back
          </button>
          <h1 className="text-3xl font-bold">Create a Game</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-muted">
              Game Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday Night Trivia"
              className="w-full rounded-xl border border-card-border bg-card px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Game Password */}
          <div className="space-y-2">
            <label htmlFor="gamePassword" className="block text-sm font-medium text-muted">
              Game Password
            </label>
            <input
              id="gamePassword"
              type="password"
              value={gamePassword}
              onChange={(e) => setGamePassword(e.target.value)}
              placeholder="Min. 4 characters"
              className="w-full rounded-xl border border-card-border bg-card px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <p className="text-xs text-muted">Share this with your audience to join</p>
          </div>

          {/* Teams */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="teams" className="block text-sm font-medium text-muted">
                Teams
              </label>
              <button
                type="button"
                onClick={addTeam}
                disabled={teams.length >= 8}
                className="rounded-lg bg-card border border-card-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-40"
              >
                + Add Team
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {teams.map((team, i) => (
                <div
                  key={team.name}
                  className="flex items-center gap-2 rounded-xl border border-card-border bg-card p-3"
                >
                  <input
                    type="color"
                    value={team.color}
                    onChange={(e) => updateTeam(i, 'color', e.target.value)}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={team.name}
                    onChange={(e) => updateTeam(i, 'name', e.target.value)}
                    placeholder={`Team ${i + 1}`}
                    className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted focus:outline-none"
                  />
                  {teams.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeTeam(i)}
                      className="shrink-0 text-muted transition-colors hover:text-answer-red"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Questions Upload */}
          <div className="space-y-3">
            <label htmlFor="questions" className="block text-sm font-medium text-muted">
              Questions
            </label>
            <input
              id="questions"
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-card-border bg-card px-6 py-8 text-center transition-colors hover:border-muted"
            >
              {questions.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{questionsFileName}</p>
                  <p className="text-sm text-muted">
                    {questions.length} question{questions.length !== 1 ? 's' : ''} loaded
                  </p>
                  <p className="text-xs text-accent">Click to replace</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-lg font-medium text-muted">Upload Questions JSON</p>
                  <p className="text-xs text-muted">Each question: text, 4 options, correctOptionId, timeLimit</p>
                </div>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-answer-red/30 bg-answer-red/10 px-4 py-3 text-sm text-answer-red">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Game'}
          </button>
        </form>
      </div>
    </div>
  );
}
