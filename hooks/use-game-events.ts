'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const GAME_EVENTS = [
  'game:start',
  'round:start',
  'round:answer_count',
  'round:end',
  'leaderboard:update',
  'game:end',
  'player:joined',
  'player:disconnected',
] as const;

interface UseGameEventsOptions {
  gameCode: string;
  enabled: boolean;
  onEvent: (event: string, data: unknown) => void;
}

export function useGameEvents({ gameCode, enabled, onEvent }: UseGameEventsOptions) {
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!gameCode || !enabled) return;

    const supabase = createClient();
    const channel = supabase.channel(`game:${gameCode}`);
    channelRef.current = channel;

    for (const eventName of GAME_EVENTS) {
      channel.on('broadcast', { event: eventName }, ({ payload }) => {
        onEventRef.current(eventName, payload);
      });
    }

    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [gameCode, enabled]);

  return { connected };
}
