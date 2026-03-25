import { hashPassword, verifyPassword } from './hash';
import { isValidDisplayName, sanitize } from './sanitize';
import { calculateScore } from './scoring';
import { supabaseAdmin } from './supabase/admin';
import { broadcastGameEvent, removeGameChannel } from './supabase/broadcast';
import type { Json } from './supabase/database.types';
import type {
  ClientGameState,
  ClientQuestion,
  ClientRoundResult,
  DbGame,
  DbPlayer,
  DbQuestion,
  LeaderboardData,
  LeaderboardEntry,
  Question,
} from './types';

// ─── Generate unique codes ───────────────────────────────────────────────────

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function calculateRoundEndTime(startedAt: string, timeLimit: number): string {
  return new Date(new Date(startedAt).getTime() + timeLimit * 1000).toISOString();
}

function isRoundExpired(game: DbGame): boolean {
  return (
    game.status === 'round_active' &&
    game.round_ends_at !== null &&
    Date.now() >= new Date(game.round_ends_at).getTime()
  );
}

async function getPlayersSnapshot(gameId: string): Promise<ClientGameState['players']> {
  const { data: players } = await supabaseAdmin
    .from('players')
    .select('id, name, team_id, total_score, connected')
    .eq('game_id', gameId);

  return (players ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    teamId: p.team_id as string,
    totalScore: Math.round((p.total_score as number) * 100) / 100,
    connected: p.connected as boolean,
  }));
}

async function buildRoundResult(game: DbGame): Promise<{
  players: ClientGameState['players'];
  roundResult: ClientRoundResult;
}> {
  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('correct_option_id, options')
    .eq('game_id', game.id)
    .eq('question_index', game.current_question_index)
    .single();

  const q = question as unknown as DbQuestion;

  const { data: answers } = await supabaseAdmin
    .from('answers')
    .select('option_id, player_id, score')
    .eq('game_id', game.id)
    .eq('question_index', game.current_question_index);

  const distribution: Record<string, number> = {};
  for (const opt of q.options) {
    distribution[opt.id] = 0;
  }

  const roundScores: Record<string, number> = {};
  if (answers) {
    for (const ans of answers) {
      distribution[ans.option_id] = (distribution[ans.option_id] || 0) + 1;
      roundScores[ans.player_id] = Math.round((ans.score as number) * 100) / 100;
    }
  }

  return {
    players: await getPlayersSnapshot(game.id),
    roundResult: {
      questionIndex: game.current_question_index,
      correctOptionId: q.correct_option_id,
      answerDistribution: distribution,
      totalAnswers: answers?.length ?? 0,
      roundScores,
    },
  };
}

async function broadcastRoundEnd(
  gameCode: string,
  roundResult: ClientRoundResult,
  players: ClientGameState['players'],
) {
  await broadcastGameEvent(gameCode, 'round:end', {
    ...roundResult,
    players,
  });
}

async function finalizeRound(game: DbGame): Promise<{
  didTransition: boolean;
  players: ClientGameState['players'];
  roundResult: ClientRoundResult;
}> {
  const { players, roundResult } = await buildRoundResult(game);

  const { data: updatedGame } = await supabaseAdmin
    .from('games')
    .update({
      status: 'round_ended',
      round_started_at: null,
      round_ends_at: null,
      last_round_result: roundResult as unknown as Json,
      last_leaderboard: null,
    })
    .eq('id', game.id)
    .eq('status', 'round_active')
    .eq('current_question_index', game.current_question_index)
    .select('id')
    .maybeSingle();

  return {
    didTransition: updatedGame !== null,
    players,
    roundResult,
  };
}

// ─── Game Creation ──────────────────────────────────────────────────────────

export async function createGame(
  hostUserId: string,
  gamePassword: string,
  teams: { name: string; color: string }[],
  questions: Question[],
  title: string,
): Promise<{ gameCode: string; gameId: string }> {
  const gamePasswordHashed = hashPassword(gamePassword);

  // Generate unique game code
  let gameCode: string;
  let exists = true;
  do {
    gameCode = generateGameCode();
    const { data } = await supabaseAdmin.from('games').select('id').eq('game_code', gameCode).maybeSingle();
    exists = data !== null;
  } while (exists);

  // Insert game
  const { data: game, error: gameError } = await supabaseAdmin
    .from('games')
    .insert({
      game_code: gameCode,
      title: sanitize(title, 100),
      host_user_id: hostUserId,
      game_password_hash: gamePasswordHashed.hash,
      game_password_salt: gamePasswordHashed.salt,
    })
    .select('id')
    .single();

  if (gameError || !game) throw new Error(gameError?.message ?? 'Failed to create game');

  // Insert teams
  const teamRows = teams.map((t, i) => ({
    game_id: game.id,
    name: sanitize(t.name, 30),
    color: t.color,
    sort_order: i,
  }));
  await supabaseAdmin.from('teams').insert(teamRows);

  // Insert questions
  const questionRows = questions.map((q, i) => ({
    game_id: game.id,
    question_index: i,
    text: q.text,
    time_limit: q.timeLimit,
    correct_option_id: q.correctOptionId,
    options: q.options as unknown as Json,
  }));
  await supabaseAdmin.from('questions').insert(questionRows);

  return { gameCode, gameId: game.id };
}

// ─── Game Lookup ────────────────────────────────────────────────────────────

async function getGameByCode(gameCode: string): Promise<DbGame | null> {
  const { data } = await supabaseAdmin.from('games').select('*').eq('game_code', gameCode).maybeSingle();
  return data as unknown as DbGame | null;
}

export async function verifyHost(gameCode: string, userId: string): Promise<boolean> {
  const game = await getGameByCode(gameCode);
  return game !== null && game.host_user_id === userId;
}

// ─── Player Join ────────────────────────────────────────────────────────────

export async function joinGame(
  gameCode: string,
  userId: string,
  password: string,
  displayName: string,
  teamId: string,
): Promise<{ success: true; playerId: string } | { success: false; error: string }> {
  const game = await getGameByCode(gameCode);
  if (!game) return { success: false, error: 'Game not found' };

  if (game.status === 'game_over') {
    return { success: false, error: 'Game has ended' };
  }

  if (!verifyPassword(password, game.game_password_hash, game.game_password_salt)) {
    return { success: false, error: 'Incorrect password' };
  }

  if (!isValidDisplayName(displayName)) {
    return { success: false, error: 'Invalid display name. Use letters, numbers, spaces, and basic punctuation.' };
  }

  const sanitizedName = sanitize(displayName, 30);

  // Check name uniqueness
  const { data: existingPlayers } = await supabaseAdmin.from('players').select('name').eq('game_id', game.id);

  const nameTaken = existingPlayers?.some(
    (p: { name: string }) => p.name.toLowerCase() === sanitizedName.toLowerCase(),
  );
  if (nameTaken) {
    return { success: false, error: 'Display name already taken' };
  }

  // Validate team
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('game_id', game.id)
    .maybeSingle();
  if (!team) {
    return { success: false, error: 'Invalid team' };
  }

  // Check if user already joined
  const { data: existingPlayer } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('game_id', game.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingPlayer) {
    return { success: false, error: 'You have already joined this game' };
  }

  // Insert player
  const { data: player, error } = await supabaseAdmin
    .from('players')
    .insert({
      game_id: game.id,
      user_id: userId,
      name: sanitizedName,
      team_id: teamId,
    })
    .select('id')
    .single();

  if (error || !player) {
    return { success: false, error: 'Failed to join game' };
  }

  // Count players for broadcast
  const { count } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', game.id);

  await broadcastGameEvent(gameCode, 'player:joined', {
    player: { id: player.id, name: sanitizedName, teamId, totalScore: 0, connected: true },
    totalPlayers: count ?? 0,
  });

  return { success: true, playerId: player.id };
}

// ─── Host Controls ──────────────────────────────────────────────────────────

export async function reconcileGameState(gameCode: string): Promise<DbGame | null> {
  let game = await getGameByCode(gameCode);
  if (!game) return null;

  if (isRoundExpired(game)) {
    const finalizedRound = await finalizeRound(game);
    if (finalizedRound.didTransition) {
      await broadcastRoundEnd(gameCode, finalizedRound.roundResult, finalizedRound.players);
    }

    game = await getGameByCode(gameCode);
  }

  return game;
}

export async function startGame(gameCode: string): Promise<{ success: boolean; error?: string }> {
  const game = await getGameByCode(gameCode);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'lobby') return { success: false, error: 'Game already started' };

  const { count } = await supabaseAdmin
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', game.id);

  if (!count || count === 0) return { success: false, error: 'No questions loaded' };

  await supabaseAdmin
    .from('games')
    .update({
      status: 'active_idle',
      current_question_index: -1,
      round_started_at: null,
      round_ends_at: null,
      current_round_data: null,
      last_round_result: null,
      last_leaderboard: null,
    })
    .eq('id', game.id);

  await broadcastGameEvent(gameCode, 'game:start', {
    status: 'active_idle',
    totalQuestions: count,
  });

  return { success: true };
}

export async function nextRound(gameCode: string): Promise<{ success: boolean; error?: string }> {
  const game = await getGameByCode(gameCode);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'active_idle' && game.status !== 'showing_results') {
    return { success: false, error: 'Cannot start round in current state' };
  }

  const nextIndex = game.current_question_index + 1;

  // Get the next question
  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('game_id', game.id)
    .eq('question_index', nextIndex)
    .maybeSingle();

  if (!question) return { success: false, error: 'No more questions' };

  const q = question as unknown as DbQuestion;
  const now = new Date().toISOString();
  const roundEndsAt = calculateRoundEndTime(now, q.time_limit);

  const clientQuestion: ClientQuestion = {
    text: q.text,
    options: q.options,
    timeLimit: q.time_limit,
    questionIndex: nextIndex,
  };

  await supabaseAdmin
    .from('games')
    .update({
      status: 'round_active',
      current_question_index: nextIndex,
      round_started_at: now,
      round_ends_at: roundEndsAt,
      current_round_data: clientQuestion as unknown as Json,
      last_round_result: null,
      last_leaderboard: null,
    })
    .eq('id', game.id);

  await broadcastGameEvent(gameCode, 'round:start', {
    question: clientQuestion,
    roundStartedAt: now,
    roundEndsAt,
  });

  return { success: true };
}

export async function endRound(gameCode: string): Promise<{ success: boolean; error?: string }> {
  const game = await getGameByCode(gameCode);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'round_active') return { success: false, error: 'No active round' };
  const finalizedRound = await finalizeRound(game);
  if (finalizedRound.didTransition) {
    await broadcastRoundEnd(gameCode, finalizedRound.roundResult, finalizedRound.players);
  }

  return { success: true };
}

export async function showResults(gameCode: string): Promise<{ success: boolean; error?: string }> {
  const game = await getGameByCode(gameCode);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'round_ended') {
    return { success: false, error: 'Round has not ended' };
  }

  const leaderboard = await computeLeaderboard(gameCode);
  const { data: updatedGame } = await supabaseAdmin
    .from('games')
    .update({
      status: 'showing_results',
      last_leaderboard: leaderboard as unknown as Json,
    })
    .eq('id', game.id)
    .eq('status', 'round_ended')
    .select('id')
    .maybeSingle();

  if (updatedGame) {
    await broadcastGameEvent(gameCode, 'leaderboard:update', leaderboard as unknown as Record<string, unknown>);
  }

  return { success: true };
}

export async function endGame(gameCode: string): Promise<{ success: boolean; error?: string }> {
  const game = await getGameByCode(gameCode);
  if (!game) return { success: false, error: 'Game not found' };

  const leaderboard = await computeLeaderboard(gameCode);

  await supabaseAdmin
    .from('games')
    .update({
      status: 'game_over',
      round_started_at: null,
      round_ends_at: null,
      last_leaderboard: leaderboard as unknown as Json,
    })
    .eq('id', game.id);

  const { count: playerCount } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', game.id);

  await broadcastGameEvent(gameCode, 'game:end', {
    leaderboard,
    totalRounds: game.current_question_index + 1,
    totalPlayers: playerCount ?? 0,
  });

  // Clean up broadcast channel
  removeGameChannel(gameCode);

  return { success: true };
}

// ─── Answer Submission ──────────────────────────────────────────────────────

export async function submitAnswer(
  gameCode: string,
  playerId: string,
  optionId: string,
): Promise<{ success: boolean; error?: string }> {
  const game = await getGameByCode(gameCode);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'round_active') return { success: false, error: 'No active round' };
  if (isRoundExpired(game)) return { success: false, error: 'Round has ended' };

  // Verify player belongs to this game
  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('id', playerId)
    .eq('game_id', game.id)
    .maybeSingle();
  if (!player) return { success: false, error: 'Player not found' };

  // Get question for validation + scoring
  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('correct_option_id, options, time_limit')
    .eq('game_id', game.id)
    .eq('question_index', game.current_question_index)
    .single();

  const q = question as unknown as DbQuestion;
  const validOption = q.options.some((o) => o.id === optionId);
  if (!validOption) return { success: false, error: 'Invalid option' };

  // Check if already answered (unique constraint will also catch this)
  const { data: existingAnswer } = await supabaseAdmin
    .from('answers')
    .select('id')
    .eq('game_id', game.id)
    .eq('player_id', playerId)
    .eq('question_index', game.current_question_index)
    .maybeSingle();

  if (existingAnswer) return { success: false, error: 'Already answered' };

  // Calculate score
  const timeTaken = game.round_started_at
    ? (Date.now() - new Date(game.round_started_at).getTime()) / 1000
    : q.time_limit;

  const isCorrect = optionId === q.correct_option_id;
  const score = calculateScore(timeTaken, q.time_limit, isCorrect);

  // Insert answer
  const { error: insertError } = await supabaseAdmin.from('answers').insert({
    game_id: game.id,
    player_id: playerId,
    question_index: game.current_question_index,
    option_id: optionId,
    time_taken: timeTaken,
    score,
  });

  if (insertError) return { success: false, error: 'Failed to submit answer' };

  // Update player total score
  const { data: currentPlayer } = await supabaseAdmin.from('players').select('total_score').eq('id', playerId).single();

  if (currentPlayer) {
    await supabaseAdmin
      .from('players')
      .update({ total_score: (currentPlayer.total_score as number) + score })
      .eq('id', playerId);
  }

  // Broadcast answer count
  const { count: totalAnswers } = await supabaseAdmin
    .from('answers')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', game.id)
    .eq('question_index', game.current_question_index);

  const { count: totalPlayers } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', game.id);

  await broadcastGameEvent(gameCode, 'round:answer_count', {
    totalAnswers: totalAnswers ?? 0,
    totalPlayers: totalPlayers ?? 0,
  });

  return { success: true };
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

export async function computeLeaderboard(gameCode: string): Promise<LeaderboardData> {
  const game = await getGameByCode(gameCode);
  if (!game) return { individual: [], teams: [] };
  const previousLeaderboard = game.last_leaderboard;
  const prevIndividual = new Map(previousLeaderboard?.individual.map((entry) => [entry.id, entry.rank]) ?? []);
  const prevTeam = new Map(previousLeaderboard?.teams.map((entry) => [entry.id, entry.rank]) ?? []);

  // Get players with scores
  const { data: players } = await supabaseAdmin
    .from('players')
    .select('id, name, team_id, total_score')
    .eq('game_id', game.id);

  // Get teams
  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, color')
    .eq('game_id', game.id)
    .order('sort_order');

  if (!players || !teams) return { individual: [], teams: [] };

  // Individual leaderboard
  const individual: LeaderboardEntry[] = players
    .map((p) => ({
      id: p.id as string,
      name: p.name as string,
      score: Math.round((p.total_score as number) * 100) / 100,
      rank: 0,
      previousRank: prevIndividual.get(p.id as string) ?? null,
      teamId: p.team_id as string,
    }))
    .sort((a, b) => b.score - a.score);

  individual.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  // Team leaderboard
  const teamScores = new Map<string, number>();
  for (const team of teams) {
    teamScores.set(team.id as string, 0);
  }
  for (const p of players) {
    const current = teamScores.get(p.team_id as string) ?? 0;
    teamScores.set(p.team_id as string, current + (p.total_score as number));
  }

  const teamLeaderboard: LeaderboardEntry[] = teams
    .map((t) => ({
      id: t.id as string,
      name: t.name as string,
      score: Math.round((teamScores.get(t.id as string) ?? 0) * 100) / 100,
      rank: 0,
      previousRank: prevTeam.get(t.id as string) ?? null,
    }))
    .sort((a, b) => b.score - a.score);

  teamLeaderboard.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  return { individual, teams: teamLeaderboard };
}

// ─── Client-safe Game State ─────────────────────────────────────────────────

export async function getClientGameState(gameCode: string): Promise<ClientGameState | null> {
  const game = await reconcileGameState(gameCode);
  if (!game) return null;

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, color')
    .eq('game_id', game.id)
    .order('sort_order');

  const { data: players } = await supabaseAdmin
    .from('players')
    .select('id, name, team_id, total_score, connected')
    .eq('game_id', game.id);

  const { count: totalQuestions } = await supabaseAdmin
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', game.id);

  return {
    gameCode: game.game_code,
    gameId: game.id,
    title: game.title,
    status: game.status,
    teams: (teams ?? []).map((t) => ({ id: t.id as string, name: t.name as string, color: t.color as string })),
    players: (players ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      teamId: p.team_id as string,
      totalScore: Math.round((p.total_score as number) * 100) / 100,
      connected: p.connected as boolean,
    })),
    currentQuestionIndex: game.current_question_index,
    totalQuestions: totalQuestions ?? 0,
    currentQuestion: game.current_round_data,
    roundStartedAt: game.round_started_at,
    roundEndsAt: game.round_ends_at,
    roundEndData: game.last_round_result,
    leaderboard: game.last_leaderboard,
    hostUserId: game.host_user_id,
  };
}

export async function findPlayerByUserId(gameCode: string, userId: string): Promise<DbPlayer | null> {
  const game = await getGameByCode(gameCode);
  if (!game) return null;

  const { data } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .eq('user_id', userId)
    .maybeSingle();

  return data as DbPlayer | null;
}
