import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// lowdb v7 uses ESM-only exports — we use dynamic import to load it
// so that Next.js bundler doesn't choke on the top-level import.

interface DbSchema {
	games: StoredGame[];
}

interface StoredGame {
	gameCode: string;
	title: string;
	createdAt: number;
	status: string;
	teams: { id: string; name: string; color: string }[];
	players: { id: string; name: string; teamId: string; totalScore: number }[];
	totalQuestions: number;
	roundResults: {
		questionIndex: number;
		correctOptionId: string;
		totalAnswers: number;
	}[];
}

const DB_DIR = join(process.cwd(), "data");
const DB_PATH = join(DB_DIR, "db.json");

let dbInstance: Awaited<ReturnType<typeof initDb>> | null = null;

async function initDb() {
	// Ensure data directory exists
	if (!existsSync(DB_DIR)) {
		mkdirSync(DB_DIR, { recursive: true });
	}

	const { JSONFilePreset } = await import("lowdb/node");
	const defaultData: DbSchema = { games: [] };
	const db = await JSONFilePreset<DbSchema>(DB_PATH, defaultData);
	return db;
}

export async function getDb() {
	if (!dbInstance) {
		dbInstance = await initDb();
	}
	return dbInstance;
}

export async function persistGame(game: StoredGame) {
	const db = await getDb();
	const existing = db.data.games.findIndex((g) => g.gameCode === game.gameCode);
	if (existing >= 0) {
		db.data.games[existing] = game;
	} else {
		db.data.games.push(game);
	}
	await db.write();
}

export type { StoredGame, DbSchema };
