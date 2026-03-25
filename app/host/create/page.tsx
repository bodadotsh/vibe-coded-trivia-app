'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useSupabase } from '@/hooks/use-supabase';
import type { Question } from '@/lib/types';

const DEFAULT_TEAM_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c'];
const MAX_QUESTIONS = 30;
const TIME_LIMIT_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

function createBlankQuestion(): Question {
  return {
    text: '',
    options: OPTION_IDS.map((id) => ({ id, text: '' })),
    correctOptionId: '',
    timeLimit: 20,
  };
}

let nextTeamId = 0;

interface TeamInput {
  id: number;
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
    { id: nextTeamId++, name: 'Red Team', color: DEFAULT_TEAM_COLORS[0] },
    { id: nextTeamId++, name: 'Blue Team', color: DEFAULT_TEAM_COLORS[1] },
  ]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsFileName, setQuestionsFileName] = useState('');
  const [inputMode, setInputMode] = useState<'manual' | 'upload'>('manual');
  const [expandedQuestionIndex, setExpandedQuestionIndex] = useState<number | null>(null);
  const [questionKeys, setQuestionKeys] = useState<number[]>([]);
  const nextQuestionKey = useRef(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function addTeam() {
    if (teams.length >= 8) return;
    const colorIndex = teams.length % DEFAULT_TEAM_COLORS.length;
    setTeams([...teams, { id: nextTeamId++, name: '', color: DEFAULT_TEAM_COLORS[colorIndex] }]);
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

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    const newIndex = questions.length;
    setQuestions([...questions, createBlankQuestion()]);
    setQuestionKeys([...questionKeys, nextQuestionKey.current++]);
    setExpandedQuestionIndex(newIndex);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
    setQuestionKeys(questionKeys.filter((_, i) => i !== index));
    if (expandedQuestionIndex === index) {
      setExpandedQuestionIndex(null);
    } else if (expandedQuestionIndex !== null && expandedQuestionIndex > index) {
      setExpandedQuestionIndex(expandedQuestionIndex - 1);
    }
  }

  function updateQuestionText(index: number, text: string) {
    const updated = [...questions];
    updated[index] = { ...updated[index], text };
    setQuestions(updated);
  }

  function updateOption(questionIndex: number, optionIndex: number, text: string) {
    const updated = [...questions];
    const options = [...updated[questionIndex].options];
    options[optionIndex] = { ...options[optionIndex], text };
    updated[questionIndex] = { ...updated[questionIndex], options };
    setQuestions(updated);
  }

  function updateCorrectOption(questionIndex: number, optionId: string) {
    const updated = [...questions];
    updated[questionIndex] = { ...updated[questionIndex], correctOptionId: optionId };
    setQuestions(updated);
  }

  function updateTimeLimit(questionIndex: number, timeLimit: number) {
    const updated = [...questions];
    updated[questionIndex] = { ...updated[questionIndex], timeLimit };
    setQuestions(updated);
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

      if (parsedQuestions.length > MAX_QUESTIONS) {
        setError(`Too many questions. Maximum ${MAX_QUESTIONS} allowed, but file contains ${parsedQuestions.length}.`);
        return;
      }

      for (let i = 0; i < parsedQuestions.length; i++) {
        const q = parsedQuestions[i];
        if (!q.text || !q.options || q.options.length !== 4 || !q.correctOptionId) {
          setError(`Invalid question at index ${i}. Each question needs text, 4 options, and correctOptionId.`);
          return;
        }
        if (!q.timeLimit || q.timeLimit < 5 || q.timeLimit > 60) {
          parsedQuestions[i] = { ...q, timeLimit: 20 };
        }
      }

      setQuestions(parsedQuestions);
      const keys = parsedQuestions.map(() => nextQuestionKey.current++);
      setQuestionKeys(keys);
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
      setError('Please add at least one question');
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Question ${i + 1} is missing question text`);
        setExpandedQuestionIndex(i);
        return;
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].text.trim()) {
          setError(`Question ${i + 1} is missing text for option ${OPTION_LABELS[j]}`);
          setExpandedQuestionIndex(i);
          return;
        }
      }
      if (!q.correctOptionId) {
        setError(`Question ${i + 1} has no correct answer selected`);
        setExpandedQuestionIndex(i);
        return;
      }
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
                <div key={team.id} className="flex items-center gap-2 rounded-xl border border-card-border bg-card p-3">
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

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">
                Questions{' '}
                {questions.length > 0 && (
                  <span className="text-xs">
                    ({questions.length}/{MAX_QUESTIONS})
                  </span>
                )}
              </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex rounded-xl border border-card-border bg-card p-1">
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  inputMode === 'manual' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
                }`}
              >
                Create Manually
              </button>
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  inputMode === 'upload' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
                }`}
              >
                Upload JSON
              </button>
            </div>

            {inputMode === 'manual' ? (
              <div className="space-y-3">
                {/* Accordion question list */}
                {questions.map((q, qi) => {
                  const isExpanded = expandedQuestionIndex === qi;
                  return (
                    <div
                      key={questionKeys[qi]}
                      className="rounded-xl border border-card-border bg-card overflow-hidden"
                    >
                      {/* Collapsed header */}
                      <button
                        type="button"
                        onClick={() => setExpandedQuestionIndex(isExpanded ? null : qi)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-card-border/20"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-xs font-bold text-accent">
                          {qi + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {q.text.trim() || 'Untitled Question'}
                        </span>
                        <span className="shrink-0 rounded-md bg-card-border/40 px-2 py-0.5 text-xs text-muted">
                          {q.timeLimit}s
                        </span>
                        <span
                          className="shrink-0 text-muted transition-transform"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }}
                        >
                          &#9662;
                        </span>
                      </button>

                      {/* Expanded editor */}
                      {isExpanded && (
                        <div className="space-y-4 border-t border-card-border px-4 py-4">
                          {/* Question text */}
                          <textarea
                            value={q.text}
                            onChange={(e) => updateQuestionText(qi, e.target.value)}
                            placeholder="Enter your question..."
                            rows={2}
                            className="w-full resize-none rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                          />

                          {/* Options with correct-answer radios */}
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted">Options (select the correct answer)</p>
                            {q.options.map((opt, oi) => (
                              <label key={opt.id} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${qi}`}
                                  checked={q.correctOptionId === opt.id}
                                  onChange={() => updateCorrectOption(qi, opt.id)}
                                  className="h-4 w-4 shrink-0 accent-accent"
                                />
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-card-border/40 text-xs font-bold text-muted">
                                  {OPTION_LABELS[oi]}
                                </span>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                                  placeholder={`Option ${OPTION_LABELS[oi]}`}
                                  className="min-w-0 flex-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                                />
                              </label>
                            ))}
                          </div>

                          {/* Time limit + delete row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <label htmlFor={`time-${qi}`} className="text-xs text-muted">
                                Time limit
                              </label>
                              <select
                                id={`time-${qi}`}
                                value={q.timeLimit}
                                onChange={(e) => updateTimeLimit(qi, Number(e.target.value))}
                                className="rounded-lg border border-card-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
                              >
                                {TIME_LIMIT_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}s
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeQuestion(qi)}
                              className="rounded-lg px-3 py-1.5 text-xs text-muted transition-colors hover:bg-answer-red/10 hover:text-answer-red"
                            >
                              Delete Question
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add question button */}
                <button
                  type="button"
                  onClick={addQuestion}
                  disabled={questions.length >= MAX_QUESTIONS}
                  className="w-full rounded-xl border-2 border-dashed border-card-border py-3 text-sm font-medium text-muted transition-colors hover:border-muted hover:text-foreground disabled:opacity-40 disabled:hover:border-card-border disabled:hover:text-muted"
                >
                  + Add Question
                </button>
              </div>
            ) : (
              /* Upload JSON mode */
              <>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-card-border bg-card px-6 py-8 text-center transition-colors hover:border-muted"
                >
                  {questionsFileName ? (
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
              </>
            )}
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
