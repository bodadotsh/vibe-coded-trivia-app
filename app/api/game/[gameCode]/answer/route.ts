import { findPlayerByUserId, submitAnswer } from '@/lib/game-manager';
import { createServerSupabase } from '@/lib/supabase/server';
import type { SubmitAnswerRequest } from '@/lib/types';

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

    // Find the player record for this user in this game
    const player = await findPlayerByUserId(gameCode, user.id);
    if (!player) {
      return Response.json({ error: 'Player not found in this game' }, { status: 401 });
    }

    const body = (await request.json()) as SubmitAnswerRequest;
    if (!body.optionId) {
      return Response.json({ error: 'Option ID is required' }, { status: 400 });
    }

    const result = await submitAnswer(gameCode, player.id, body.optionId);

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
