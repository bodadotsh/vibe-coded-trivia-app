import { createGame } from '@/lib/game-manager';
import { isValidTeamName } from '@/lib/sanitize';
import { createServerSupabase } from '@/lib/supabase/server';
import type { CreateGameRequest, CreateGameResponse, Question } from '@/lib/types';

export const dynamic = 'force-dynamic';

function validateQuestions(questions: unknown): questions is Question[] {
  if (!Array.isArray(questions)) return false;
  return questions.every((q) => {
    if (typeof q.text !== 'string' || q.text.trim().length === 0) return false;
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (!q.options.every((o: { id?: string; text?: string }) => typeof o.id === 'string' && typeof o.text === 'string'))
      return false;
    if (typeof q.correctOptionId !== 'string') return false;
    if (!q.options.some((o: { id: string }) => o.id === q.correctOptionId)) return false;
    if (typeof q.timeLimit !== 'number' || q.timeLimit < 5 || q.timeLimit > 120) return false;
    return true;
  });
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CreateGameRequest;

    if (!body.gamePassword || body.gamePassword.length < 4) {
      return Response.json({ error: 'Game password must be at least 4 characters' }, { status: 400 });
    }
    if (!body.title || body.title.trim().length === 0) {
      return Response.json({ error: 'Game title is required' }, { status: 400 });
    }
    if (!Array.isArray(body.teams) || body.teams.length < 2) {
      return Response.json({ error: 'At least 2 teams are required' }, { status: 400 });
    }
    for (const team of body.teams) {
      if (!isValidTeamName(team.name)) {
        return Response.json({ error: `Invalid team name: ${team.name}` }, { status: 400 });
      }
    }
    if (!validateQuestions(body.questions)) {
      return Response.json(
        {
          error:
            'Invalid questions format. Each question needs text, 4 options, a correctOptionId, and timeLimit (5-120s).',
        },
        { status: 400 },
      );
    }

    const result = await createGame(user.id, body.gamePassword, body.teams, body.questions, body.title);

    const response: CreateGameResponse = {
      gameCode: result.gameCode,
      gameId: result.gameId,
    };

    return Response.json(response, { status: 201 });
  } catch (err) {
    console.error('[POST /api/game]', err);
    const message = err instanceof Error ? err.message : 'Invalid request body';
    return Response.json({ error: message }, { status: 400 });
  }
}
