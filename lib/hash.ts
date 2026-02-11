import { randomBytes, scryptSync } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): { hash: string; salt: string } {
	const salt = randomBytes(16).toString("hex");
	const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
	return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
	const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
	// Constant-time comparison via length check + char-by-char
	if (derived.length !== hash.length) return false;
	let mismatch = 0;
	for (let i = 0; i < derived.length; i++) {
		mismatch |= derived.charCodeAt(i) ^ hash.charCodeAt(i);
	}
	return mismatch === 0;
}
