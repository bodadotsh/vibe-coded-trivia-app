import { getClientGameState, joinGame } from '@/lib/game-manager';
import { createServerSupabase } from '@/lib/supabase/server';
import type { JoinGameRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ gameCode: string }> }) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameCode } = await params;
    const body = (await request.json()) as JoinGameRequest;

    if (!body.password) {
      return Response.json({ error: 'Password is required' }, { status: 400 });
    }
    if (!body.displayName) {
      return Response.json({ error: 'Display name is required' }, { status: 400 });
    }
    if (!body.teamId) {
      return Response.json({ error: 'Team selection is required' }, { status: 400 });
    }

    const result = await joinGame(gameCode, user.id, body.password, body.displayName, body.teamId);

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    const gameState = await getClientGameState(gameCode);

    return Response.json({
      playerId: result.playerId,
      gameState,
    });
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
