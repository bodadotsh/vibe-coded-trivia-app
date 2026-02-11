import { getClientGameState } from "@/lib/game-manager";

export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ gameCode: string }> },
) {
	const { gameCode } = await params;
	const state = await getClientGameState(gameCode);

	if (!state) {
		return Response.json({ error: "Game not found" }, { status: 404 });
	}

	return Response.json(state);
}
