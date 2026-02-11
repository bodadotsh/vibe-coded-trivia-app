-- ─── Games ────────────────────────────────────────────────────────────────────

create table public.games (
  id uuid primary key default gen_random_uuid(),
  game_code text unique not null,
  title text not null,
  host_user_id uuid not null references auth.users(id),
  game_password_hash text not null,
  game_password_salt text not null,
  status text not null default 'lobby'
    check (status in ('lobby','active_idle','round_active','round_ended','showing_results','game_over')),
  current_question_index integer not null default -1,
  round_started_at timestamptz,
  current_round_data jsonb, -- { text, options[], timeLimit, questionIndex } (no correct answer)
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;
create policy "games_select" on public.games for select to authenticated using (true);

-- ─── Teams ────────────────────────────────────────────────────────────────────

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null,
  color text not null,
  sort_order integer not null default 0
);

create index teams_game_id_idx on public.teams(game_id);

alter table public.teams enable row level security;
create policy "teams_select" on public.teams for select to authenticated using (true);

-- ─── Questions (server-only, never exposed to players) ───────────────────────

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  question_index integer not null,
  text text not null,
  time_limit integer not null default 20,
  correct_option_id text not null,
  options jsonb not null, -- [{ id, text }, ...]
  unique (game_id, question_index)
);

create index questions_game_id_idx on public.questions(game_id);

alter table public.questions enable row level security;
-- No select policy: only service_role can read (correct answers protected)

-- ─── Players ──────────────────────────────────────────────────────────────────

create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  name text not null,
  team_id uuid not null references public.teams(id),
  total_score numeric not null default 0,
  connected boolean not null default true,
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create index players_game_id_idx on public.players(game_id);

alter table public.players enable row level security;
create policy "players_select" on public.players for select to authenticated using (true);

-- ─── Answers (server-only) ───────────────────────────────────────────────────

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id),
  question_index integer not null,
  option_id text not null,
  time_taken numeric not null,
  score numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (game_id, player_id, question_index)
);

create index answers_game_id_idx on public.answers(game_id);

alter table public.answers enable row level security;
-- No select policy: only service_role can read
