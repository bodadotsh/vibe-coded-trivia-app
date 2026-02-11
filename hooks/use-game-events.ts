'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type EventHandler = (data: unknown) => void;

interface UseGameEventsOptions {
  gameCode: string;
  token: string;
  role: 'host' | 'player';
  onEvent?: (event: string, data: unknown) => void;
}

const SSE_EVENT_TYPES = [
  'game:state',
  'game:start',
  'round:start',
  'round:answer_count',
  'round:end',
  'leaderboard:update',
  'game:end',
  'player:joined',
  'player:disconnected',
] as const;

export function useGameEvents({ gameCode, token, role, onEvent }: UseGameEventsOptions) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const addEventListener = useCallback((event: string, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!gameCode || !token) return;

    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let currentES: EventSource | null = null;

    function connect() {
      if (destroyed) return;

      const url = `/api/game/${gameCode}/events?token=${encodeURIComponent(token)}&role=${role}`;
      const es = new EventSource(url);
      currentES = es;
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!destroyed) setConnected(true);
      };

      es.onerror = () => {
        if (destroyed) return;
        setConnected(false);

        // EventSource has built-in reconnection, but if it enters CLOSED
        // state (e.g. server returned non-200), we need to reconnect manually.
        if (es.readyState === EventSource.CLOSED) {
          es.close();
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      for (const eventType of SSE_EVENT_TYPES) {
        es.addEventListener(eventType, ((e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            // Call registered handlers
            const handlers = handlersRef.current.get(eventType);
            if (handlers) {
              for (const handler of handlers) {
                handler(data);
              }
            }
            // Call the general onEvent callback
            onEventRef.current?.(eventType, data);
          } catch {
            // ignore parse errors
          }
        }) as EventListener);
      }
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (currentES) {
        currentES.close();
        currentES = null;
      }
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [gameCode, token, role]);

  return { connected, addEventListener };
}
