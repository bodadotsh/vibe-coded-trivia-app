/** biome-ignore-all lint/style/noNonNullAssertion: Supabase client needs non-null keys */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
