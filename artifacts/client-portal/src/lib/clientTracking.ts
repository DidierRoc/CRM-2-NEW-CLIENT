/**
 * Client-side analytics tracker for the client portal.
 *
 * - Buffers events in memory + localStorage (resilience offline / refresh)
 * - Flushes every 30s and on `pagehide` (sendBeacon when possible)
 * - Sends batches to the `track-client-events` edge function
 *
 * Usage:
 *   import { track } from '@/lib/clientTracking';
 *   track('click_invest', { amount: 1000, source: 'dashboard' });
 */
import { CRM_URL, ensureFreshCrmToken, getStoredToken } from '@/lib/crmApi';

export type ClientEventName =
  // Navigation
  | 'page_view'
  | 'dashboard_view'
  | 'login'
  | 'session_start'
  | 'session_end'
  // Conversion
  | 'click_invest'
  | 'click_simulate'
  | 'click_withdraw'
  | 'cta_invest_click'
  | 'cta_simulate_click'
  // Assistant
  | 'assistant_open'
  | 'assistant_message'
  | 'assistant_suggestion_click'
  | 'help_chat_open'
  | 'help_message_sent'
  // Misc
  | 'contract_view'
  | 'withdrawal_start'
  | 'withdrawal_submit'
  | 'document_download'
  | 'onboarding_start'
  | 'onboarding_complete'
  | 'onboarding_skip';

interface QueuedEvent {
  event_name: string;
  properties?: Record<string, unknown>;
  page?: string;
  session_id: string;
  user_agent: string;
  ts: number;
}

const STORAGE_KEY = 'lovable.client.events.buffer';
const FLUSH_INTERVAL_MS = 30_000;
const MAX_BUFFER = 100;

let queue: QueuedEvent[] = [];
let started = false;
let timer: number | null = null;
let sessionId = '';

const getSessionId = () => {
  if (sessionId) return sessionId;
  try {
    const existing = sessionStorage.getItem('lovable.client.sid');
    if (existing) {
      sessionId = existing;
      return sessionId;
    }
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('lovable.client.sid', sessionId);
  } catch {
    sessionId = `sid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return sessionId;
};

/**
 * Lightweight device hint added to every event payload.
 */
const getDeviceMeta = () => {
  if (typeof window === 'undefined') return {};
  const ua = navigator.userAgent || '';
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  return {
    device: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    lang: navigator.language,
  };
};

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) queue = parsed.slice(-MAX_BUFFER);
    }
  } catch {
    /* ignore */
  }
};

const saveToStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* ignore quota */
  }
};

const getEdgeUrl = () => {
  return `${CRM_URL}/functions/v1/track-client-events`;
};

const flush = async (useBeacon = false) => {
  if (!queue.length) return;
  const batch = [...queue];
  queue = [];
  saveToStorage();

  const payload = JSON.stringify({ events: batch });

  try {
    const token = getStoredToken() || (await ensureFreshCrmToken());
    if (!token) {
      // Not logged in — drop silently (no point keeping)
      return;
    }

    const url = getEdgeUrl();

    if (useBeacon && 'sendBeacon' in navigator) {
      // sendBeacon can't set auth header — append token in body
      const blob = new Blob(
        [JSON.stringify({ events: batch, token })],
        { type: 'application/json' }
      );
      const ok = navigator.sendBeacon(url, blob);
      if (!ok) {
        // requeue
        queue = [...batch, ...queue].slice(-MAX_BUFFER);
        saveToStorage();
      }
      return;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload,
      keepalive: true,
    });
    if (!res.ok) {
      // requeue on failure
      queue = [...batch, ...queue].slice(-MAX_BUFFER);
      saveToStorage();
    }
  } catch {
    // network error — requeue
    queue = [...batch, ...queue].slice(-MAX_BUFFER);
    saveToStorage();
  }
};

export const track = (
  event_name: ClientEventName | string,
  properties?: Record<string, unknown>
) => {
  if (typeof window === 'undefined') return;
  const evt: QueuedEvent = {
    event_name,
    properties: { ...getDeviceMeta(), ...(properties ?? {}) },
    page: typeof location !== 'undefined' ? location.pathname : undefined,
    session_id: getSessionId(),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    ts: Date.now(),
  };
  queue.push(evt);
  if (queue.length > MAX_BUFFER) queue = queue.slice(-MAX_BUFFER);
  saveToStorage();
};

export const startTracking = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  loadFromStorage();

  timer = window.setInterval(() => {
    void flush(false);
  }, FLUSH_INTERVAL_MS);

  // Flush on tab hide / unload + emit a session_end best-effort.
  const onHide = () => {
    track('session_end', { reason: 'pagehide' });
    void flush(true);
  };
  window.addEventListener('pagehide', onHide);
  window.addEventListener('beforeunload', onHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush(true);
  });
};

export const stopTracking = () => {
  if (timer != null) window.clearInterval(timer);
  timer = null;
  started = false;
};

export const flushNow = () => flush(false);
