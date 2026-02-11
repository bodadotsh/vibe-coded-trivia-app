import { gameManager } from "@/lib/game-manager";
import type { SSEConnection } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ gameCode: string }> },
) {
	const { gameCode } = await params;
	const url = new URL(request.url);
	const token = url.searchParams.get("token");
	const role = url.searchParams.get("role") as "host" | "player" | null;

	if (!token || !role) {
		return Response.json({ error: "Missing token or role" }, { status: 400 });
	}

	const game = gameManager.getGame(gameCode);
	if (!game) {
		return Response.json({ error: "Game not found" }, { status: 404 });
	}

	// Validate token
	let playerId: string | undefined;
	if (role === "host") {
		if (!gameManager.verifyHost(gameCode, token)) {
			return Response.json({ error: "Invalid host token" }, { status: 401 });
		}
	} else {
		const player = gameManager.findPlayerByToken(gameCode, token);
		if (!player) {
			return Response.json({ error: "Invalid player token" }, { status: 401 });
		}
		playerId = player.id;
	}

	const connectionId = crypto.randomUUID();
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			const connection: SSEConnection = {
				id: connectionId,
				role,
				playerId,
				send(event: string, data: unknown) {
					try {
						const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
						controller.enqueue(encoder.encode(message));
					} catch {
						// Stream may be closed
					}
				},
				close() {
					try {
						controller.close();
					} catch {
						// Already closed
					}
				},
			};

			gameManager.addConnection(gameCode, connection);

			// Send initial state
			const state = gameManager.getClientGameState(gameCode);
			try {
				const msg = `event: game:state\ndata: ${JSON.stringify(state)}\n\n`;
				controller.enqueue(encoder.encode(msg));
			} catch {
				// ignore
			}

			// Handle client disconnect
			request.signal.addEventListener("abort", () => {
				gameManager.removeConnection(gameCode, connectionId);
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
