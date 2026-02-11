import { gameManager } from "@/lib/game-manager";
import type { SubmitAnswerRequest } from "@/lib/types";

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
		const player = gameManager.findPlayerByToken(gameCode, token);
		if (!player) {
			return Response.json({ error: "Invalid token" }, { status: 401 });
		}

		const body = (await request.json()) as SubmitAnswerRequest;
		if (!body.optionId) {
			return Response.json({ error: "Option ID is required" }, { status: 400 });
		}

		const result = gameManager.submitAnswer(gameCode, player.id, body.optionId);

		if (!result.success) {
			return Response.json({ error: result.error }, { status: 400 });
		}

		return Response.json({ success: true });
	} catch {
		return Response.json({ error: "Invalid request body" }, { status: 400 });
	}
}
