import { gameManager } from "@/lib/game-manager";
import type { HostControlRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ gameCode: string }> },
) {
	try {
		const { gameCode } = await params;
		const authHeader = request.headers.get("authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const token = authHeader.slice(7);
		if (!gameManager.verifyHost(gameCode, token)) {
			return Response.json({ error: "Invalid host token" }, { status: 401 });
		}

		const body = (await request.json()) as HostControlRequest;

		let result: { success: boolean; error?: string };

		switch (body.action) {
			case "start":
				result = gameManager.startGame(gameCode);
				break;
			case "nextRound":
				result = gameManager.nextRound(gameCode);
				break;
			case "endRound":
				result = gameManager.endRound(gameCode);
				break;
			case "showResults":
				result = gameManager.showResults(gameCode);
				break;
			case "endGame":
				result = gameManager.endGame(gameCode);
				break;
			default:
				return Response.json({ error: "Invalid action" }, { status: 400 });
		}

		if (!result.success) {
			return Response.json({ error: result.error }, { status: 400 });
		}

		const state = gameManager.getClientGameState(gameCode);
		return Response.json({ success: true, state });
	} catch {
		return Response.json({ error: "Invalid request body" }, { status: 400 });
	}
}
