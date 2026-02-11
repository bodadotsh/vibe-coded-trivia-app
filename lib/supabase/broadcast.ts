import { supabaseAdmin } from "./admin";

/**
 * Tracks active Supabase Realtime channels for broadcast.
 * Channels are created lazily and reused across requests.
 */
const channels = new Map<string, ReturnType<typeof supabaseAdmin.channel>>();

function getChannel(gameCode: string) {
	const key = `game:${gameCode}`;
	let channel = channels.get(key);
	if (!channel) {
		channel = supabaseAdmin.channel(key);
		channels.set(key, channel);
		// Subscribe but don't wait — messages are queued internally
		channel.subscribe();
	}
	return channel;
}

/**
 * Publish a broadcast event to all clients subscribed to a game channel.
 */
export async function broadcastGameEvent(
	gameCode: string,
	event: string,
	payload: Record<string, unknown>,
) {
	const channel = getChannel(gameCode);
	await channel.send({
		type: "broadcast",
		event,
		payload,
	});
}

/**
 * Clean up a game's broadcast channel (call when a game ends).
 */
export function removeGameChannel(gameCode: string) {
	const key = `game:${gameCode}`;
	const channel = channels.get(key);
	if (channel) {
		supabaseAdmin.removeChannel(channel);
		channels.delete(key);
	}
}
