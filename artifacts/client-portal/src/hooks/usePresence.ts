import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Marque le client en ligne tant que l'onglet est ouvert. */
export function usePresence(clientAccountId?: string | null) {
  useEffect(() => {
    if (!clientAccountId) return;
    let stopped = false;

    const setOnline = async (online: boolean) => {
      await supabase
        .from('client_accounts')
        .update({
          is_online: online,
          ...(online ? { last_login_at: new Date().toISOString() } : {}),
        })
        .eq('id', clientAccountId);
    };

    setOnline(true);
    const heartbeat = setInterval(() => { if (!stopped) setOnline(true); }, 60_000);

    const goOffline = () => { setOnline(false); };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setOnline(false);
      else setOnline(true);
    };
    window.addEventListener('beforeunload', goOffline);
    window.addEventListener('pagehide', goOffline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', goOffline);
      window.removeEventListener('pagehide', goOffline);
      document.removeEventListener('visibilitychange', onVisibility);
      setOnline(false);
    };
  }, [clientAccountId]);
}
