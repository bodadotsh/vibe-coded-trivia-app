/** biome-ignore-all lint/style/noNonNullAssertion: Supabase client needs non-null keys */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client that reads the user's session from cookies.
 * Use this in API routes to identify the calling user (auth.uid()).
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — ignore.
        }
      },
    },
  });
}
