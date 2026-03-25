import {
  endGame,
  endRound,
  getClientGameState,
  nextRound,
  reconcileGameState,
  showResults,
  startGame,
  verifyHost,
} from '@/lib/game-manager';
import { createServerSupabase } from '@/lib/supabase/server';
import type { HostControlRequest } from '@/lib/types';

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

    const isHost = await verifyHost(gameCode, user.id);
    if (!isHost) {
      return Response.json({ error: 'Not the host of this game' }, { status: 403 });
    }

    const body = (await request.json()) as HostControlRequest;
    await reconcileGameState(gameCode);

    let result: { success: boolean; error?: string };

    switch (body.action) {
      case 'start':
        result = await startGame(gameCode);
        break;
      case 'nextRound':
        result = await nextRound(gameCode);
        break;
      case 'endRound':
        result = await endRound(gameCode);
        break;
      case 'showResults':
        result = await showResults(gameCode);
        break;
      case 'endGame':
        result = await endGame(gameCode);
        break;
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    const state = await getClientGameState(gameCode);
    return Response.json(
      { success: true, state },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
