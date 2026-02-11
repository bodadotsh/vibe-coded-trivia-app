import { gameManager } from "@/lib/game-manager";
import type { JoinGameRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ gameCode: string }> },
) {
	try {
		const { gameCode } = await params;
		const body = (await request.json()) as JoinGameRequest;

		if (!body.password) {
			return Response.json({ error: "Password is required" }, { status: 400 });
		}
		if (!body.displayName) {
			return Response.json({ error: "Display name is required" }, { status: 400 });
		}
		if (!body.teamId) {
			return Response.json({ error: "Team selection is required" }, { status: 400 });
		}

		const result = gameManager.joinGame(gameCode, body.password, body.displayName, body.teamId);

		if (!result.success) {
			return Response.json({ error: result.error }, { status: 400 });
		}

		const gameState = gameManager.getClientGameState(gameCode);

		return Response.json({
			playerId: result.playerId,
			playerToken: result.playerToken,
			gameState,
		});
	} catch {
		return Response.json({ error: "Invalid request body" }, { status: 400 });
	}
}
