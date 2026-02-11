import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Admin Supabase client using the service_role key.
 * Bypasses RLS — use only in server-side code (API routes).
 * Singleton: reused across requests in the same Node.js process.
 */
const globalForAdmin = globalThis as unknown as {
	__supabaseAdmin?: ReturnType<typeof createClient<Database>>;
};

export const supabaseAdmin =
	globalForAdmin.__supabaseAdmin ??
	createClient<Database>(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);

if (process.env.NODE_ENV !== "production") {
	globalForAdmin.__supabaseAdmin = supabaseAdmin;
}
