import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase as crmSupabase, syncCrmRealtimeAuth } from '@/lib/crmSupabaseClient';

/**
 * Keeps the client portal in sync with CRM1 backend in real time.
 *
 * Listens on CRM1's `client_transactions` and `client_subscriptions` tables
 * (filtered by this client's lead_id) and invalidates the relevant React Query
 * caches so every balance / contract / chart updates without a page refresh.
 *
 * Adds a 20s polling fallback in case realtime is disabled on the CRM1 project
 * publication (mirrors the existing pattern used for `leads.trading_active`).
 */
export function useClientRealtimeSync(leadId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;

    const invalidateBalances = () => {
      queryClient.invalidateQueries({ queryKey: ['client-dashboard-bundle', leadId] });
      queryClient.invalidateQueries({ queryKey: ['client-portfolio', leadId] });
      queryClient.invalidateQueries({ queryKey: ['client-contracts', leadId] });
      queryClient.invalidateQueries({ queryKey: ['client-history', leadId] });
      queryClient.invalidateQueries({ queryKey: ['client-withdrawals', leadId] });
      queryClient.invalidateQueries({ queryKey: ['client-products', leadId] });
    };

    let channel: ReturnType<typeof crmSupabase.channel> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    syncCrmRealtimeAuth().then(() => {
      if (cancelled) return;

      channel = crmSupabase
        .channel(`client-balance-${leadId}`)
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'products' }, invalidateBalances)
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'lead_products', filter: `lead_id=eq.${leadId}` }, invalidateBalances)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: 'client_transactions', filter: `lead_id=eq.${leadId}` },
          invalidateBalances,
        )
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: 'client_subscriptions', filter: `lead_id=eq.${leadId}` },
          invalidateBalances,
        )
        .on('broadcast', { event: 'client_balance_changed' }, invalidateBalances)
        .subscribe();

      // Fallback polling — keeps everything in sync even if realtime publication
      // is missing on the CRM1 backend.
      poll = setInterval(invalidateBalances, 20_000);
    });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (channel) crmSupabase.removeChannel(channel);
    };
  }, [leadId, queryClient]);
}
