'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type EventHandler = (data: unknown) => void;

interface UseGameEventsOptions {
  gameCode: string;
  token: string;
  role: 'host' | 'player';
  onEvent?: (event: string, data: unknown) => void;
}

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

    // Also register on the EventSource if it's already open
    const es = eventSourceRef.current;
    if (es) {
      es.addEventListener(event, ((e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handler(data);
        } catch {
          handler(e.data);
        }
      }) as EventListener);
    }

    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!gameCode || !token) return;

    const url = `/api/game/${gameCode}/events?token=${encodeURIComponent(token)}&role=${role}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onerror = () => {
      setConnected(false);
    };

    // Register all known event types
    const eventTypes = [
      'game:state',
      'game:start',
      'round:start',
      'round:answer_count',
      'round:end',
      'leaderboard:update',
      'game:end',
      'player:joined',
      'player:disconnected',
    ];

    for (const eventType of eventTypes) {
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

    return () => {
      es.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [gameCode, token, role]);

  return { connected, addEventListener };
}
