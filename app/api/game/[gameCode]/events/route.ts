import { gameManager } from "@/lib/game-manager";
import type { SSEConnection } from "@/lib/types";

export const dynamic = "force-dynamic";

// 2 KB padding to flush through proxy buffers (Cloudflare Tunnel, nginx, etc.)
// Proxies often buffer the first chunk until they receive enough data.
const PADDING = `: ${"-".repeat(2048)}\n\n`;
const HEARTBEAT_INTERVAL_MS = 15_000;

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
			// Send padding to flush through proxy buffers immediately
			controller.enqueue(encoder.encode(PADDING));

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
					clearInterval(heartbeat);
					try {
						controller.close();
					} catch {
						// Already closed
					}
				},
			};

			gameManager.addConnection(gameCode, connection);

			// Send initial state immediately after padding
			const state = gameManager.getClientGameState(gameCode);
			try {
				const msg = `event: game:state\ndata: ${JSON.stringify(state)}\n\n`;
				controller.enqueue(encoder.encode(msg));
			} catch {
				// ignore
			}

			// Heartbeat to keep the connection alive through Cloudflare Tunnel.
			// Without this, the tunnel may close the connection after ~100s of inactivity.
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`: heartbeat\n\n`));
				} catch {
					clearInterval(heartbeat);
				}
			}, HEARTBEAT_INTERVAL_MS);

			// Clean up on client disconnect
			request.signal.addEventListener("abort", () => {
				clearInterval(heartbeat);
				gameManager.removeConnection(gameCode, connectionId);
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-store, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
