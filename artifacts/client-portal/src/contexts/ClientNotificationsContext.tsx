import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, CheckCircle2, FileSignature, FileText, MessageCircle, AlertTriangle } from 'lucide-react';
import { callCrmApi } from '@/lib/crmApi';
import { useSmartPolling } from '@/hooks/useSmartPolling';

export type NotifKind =
  | 'withdrawal_validated'
  | 'withdrawal_rejected'
  | 'contract_signed'
  | 'new_document'
  | 'advisor_message'
  | 'important_activity';

export interface ClientNotification {
  id: string;
  kind: NotifKind;
  title: string;
  description?: string;
  createdAt: number;
  read: boolean;
  href?: string;
}

interface Ctx {
  notifications: ClientNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<Ctx | null>(null);

const STORAGE_KEY = 'client-notifications-v1';
const SEEN_KEYS = 'client-notif-seen-v1';

function loadStored(): ClientNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEYS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeen(set: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEYS, JSON.stringify([...set].slice(-500)));
  } catch {}
}

const KIND_META: Record<NotifKind, { icon: any; toastVariant: 'success' | 'error' | 'info' }> = {
  withdrawal_validated: { icon: CheckCircle2, toastVariant: 'success' },
  withdrawal_rejected: { icon: AlertTriangle, toastVariant: 'error' },
  contract_signed: { icon: FileSignature, toastVariant: 'success' },
  new_document: { icon: FileText, toastVariant: 'info' },
  advisor_message: { icon: MessageCircle, toastVariant: 'info' },
  important_activity: { icon: Bell, toastVariant: 'info' },
};

interface ProviderProps {
  children: ReactNode;
  leadId: string | null | undefined;
  messagingEnabled: boolean;
}

export function ClientNotificationsProvider({ children, leadId, messagingEnabled }: ProviderProps) {
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<ClientNotification[]>(() => loadStored());
  const seenRef = useRef<Set<string>>(loadSeen());
  const initializedRef = useRef<Record<string, any>>({});

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
    } catch {}
  }, [notifications]);

  const pushNotification = useCallback((n: Omit<ClientNotification, 'id' | 'createdAt' | 'read'>, dedupKey: string) => {
    if (seenRef.current.has(dedupKey)) return;
    seenRef.current.add(dedupKey);
    saveSeen(seenRef.current);

    const notif: ClientNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev].slice(0, 50));

    // Toast discret
    const meta = KIND_META[n.kind];
    const fn = meta.toastVariant === 'success' ? toast.success : meta.toastVariant === 'error' ? toast.error : toast;
    fn(n.title, {
      description: n.description,
      duration: 4500,
    });
  }, []);

  // Polling intelligent : 3 cadences
  const tickFast = useSmartPolling(10_000, !!leadId && messagingEnabled); // messages
  const tickMedium = useSmartPolling(30_000, !!leadId); // retraits + contrats
  const tickSlow = useSmartPolling(60_000, !!leadId); // dashboard + docs

  // Messages conseiller (10s)
  useEffect(() => {
    if (!leadId || !messagingEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await callCrmApi('client-messaging', 'get-unread');
        const count = res?.unreadCount ?? res?.count ?? 0;
        if (cancelled) return;
        const key = `msg-count-${count}`;
        const lastKey = initializedRef.current['msg-last'];
        if (!initializedRef.current['msg-init']) {
          initializedRef.current['msg-init'] = true;
          initializedRef.current['msg-last'] = String(count);
          return;
        }
        if (Number(lastKey ?? 0) < count) {
          pushNotification(
            {
              kind: 'advisor_message',
              title: 'Nouveau message conseiller',
              description: `${count} message${count > 1 ? 's' : ''} non lu${count > 1 ? 's' : ''}`,
              href: '/client/help',
            },
            `msg-${count}-${Date.now()}`,
          );
        }
        initializedRef.current['msg-last'] = String(count);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [tickFast, leadId, messagingEnabled, pushNotification]);

  // Retraits (30s)
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    (async () => {
      try {
        const data: any = await callCrmApi('client-self-service', 'get-withdrawals');
        const raw = data?.requests || data || [];
        const list: any[] = Array.isArray(raw) ? raw : [];
        if (cancelled) return;

        // Init silencieux au premier passage
        if (!initializedRef.current['wd-init']) {
          list.forEach((w) => seenRef.current.add(`wd-${w.id}-${w.status}`));
          saveSeen(seenRef.current);
          initializedRef.current['wd-init'] = true;
        } else {
          list.forEach((w) => {
            if (w.status === 'validated' || w.status === 'paid' || w.status === 'completed') {
              pushNotification(
                {
                  kind: 'withdrawal_validated',
                  title: 'Retrait validé ✅',
                  description: `Votre demande de ${Number(w.amount || 0).toLocaleString('fr-FR')} € a été traitée.`,
                  href: '/client/withdrawal',
                },
                `wd-${w.id}-${w.status}`,
              );
            } else if (w.status === 'rejected' || w.status === 'refused') {
              pushNotification(
                {
                  kind: 'withdrawal_rejected',
                  title: 'Retrait refusé',
                  description: w.reason || w.admin_note || 'Voir détails dans votre espace.',
                  href: '/client/withdrawal',
                },
                `wd-${w.id}-${w.status}`,
              );
            }
          });
        }
        // Force refresh React Query cache
        queryClient.invalidateQueries({ queryKey: ['client-withdrawals', leadId] });
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [tickMedium, leadId, pushNotification, queryClient]);

  // Contrats (30s) — détection signature & paiement
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await callCrmApi('client-contracts', 'list');
        const data = Array.isArray(res) ? res : res?.subscriptions || res?.contracts || [];
        if (cancelled || !data) return;

        if (!initializedRef.current['ctr-init']) {
          data.forEach((s: any) => seenRef.current.add(`ctr-${s.id}-${s.status}`));
          saveSeen(seenRef.current);
          initializedRef.current['ctr-init'] = true;
        } else {
          data.forEach((s: any) => {
            if (s.status === 'signed' || s.status === 'pending_payment' || s.status === 'active') {
              pushNotification(
                {
                  kind: 'contract_signed',
                  title:
                    s.status === 'active'
                      ? 'Contrat activé 🎉'
                      : s.status === 'pending_payment'
                      ? 'Contrat signé — en attente de paiement'
                      : 'Contrat signé ✍️',
                  description: s.products?.nom || 'Votre contrat a été mis à jour.',
                  href: '/client/contracts',
                },
                `ctr-${s.id}-${s.status}`,
              );
            }
          });
        }
        queryClient.invalidateQueries({ queryKey: ['client-products'] });
        queryClient.invalidateQueries({ queryKey: ['client-contracts'] });
        queryClient.invalidateQueries({ queryKey: ['client-dashboard-bundle'] });
        data.forEach((s: any) => queryClient.invalidateQueries({ queryKey: ['client-product-detail', s.product_id || s.products?.id] }));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [tickMedium, leadId, pushNotification, queryClient]);

  // Documents + dashboard (60s)
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    (async () => {
      try {
        const data: any = await callCrmApi('client-documents', 'list');
        const list: any[] = data?.documents || data || [];
        if (cancelled || !Array.isArray(list)) return;

        if (!initializedRef.current['doc-init']) {
          list.forEach((d) => seenRef.current.add(`doc-${d.id}`));
          saveSeen(seenRef.current);
          initializedRef.current['doc-init'] = true;
        } else {
          list.forEach((d) => {
            pushNotification(
              {
                kind: 'new_document',
                title: 'Nouveau document disponible',
                description: d.nom || 'Un document a été ajouté à votre espace.',
                href: '/client/documents',
              },
              `doc-${d.id}`,
            );
          });
        }
        queryClient.invalidateQueries({ queryKey: ['client-documents', leadId] });
        queryClient.invalidateQueries({ queryKey: ['client-dashboard-bundle', leadId] });
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [tickSlow, leadId, pushNotification, queryClient]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo(
    () => ({ notifications, unreadCount, markAllRead, markRead, clearAll }),
    [notifications, unreadCount, markAllRead, markRead, clearAll],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useClientNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    return {
      notifications: [] as ClientNotification[],
      unreadCount: 0,
      markAllRead: () => {},
      markRead: () => {},
      clearAll: () => {},
    };
  }
  return ctx;
}

export { KIND_META };
