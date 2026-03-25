alter table public.games
  add column round_ends_at timestamptz,
  add column last_round_result jsonb,
  add column last_leaderboard jsonb;
