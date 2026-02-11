'use client';

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Initializes an anonymous Supabase session and provides the client + user.
 * The anonymous session is persisted in localStorage by supabase-js.
 */
export function useSupabase() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }

  const supabase = supabaseRef.current;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Check for existing session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        if (!cancelled) {
          setUser(session.user);
          setReady(true);
        }
        return;
      }

      // No session — create anonymous one
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!cancelled) {
        if (data?.user) {
          setUser(data.user);
        }
        if (error) {
          console.error('Anonymous sign-in failed:', error.message);
        }
        setReady(true);
      }
    }

    init();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { supabase, user, ready };
}
