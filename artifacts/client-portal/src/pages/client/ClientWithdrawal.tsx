import { useMemo, useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import WithdrawalInfoBanner from '@/components/withdrawal/WithdrawalInfoBanner';
import WithdrawalPortfolio from '@/components/withdrawal/WithdrawalPortfolio';
import WithdrawalStepper from '@/components/withdrawal/WithdrawalStepper';
import WithdrawalHistory from '@/components/withdrawal/WithdrawalHistory';
import { useClientDashboardBundle } from '@/hooks/useClientData';
import { track } from '@/lib/clientTracking';
import { logConnection } from '@/lib/connectionLog';
import { ClientRowsSkeleton } from '@/components/client-portal/ClientPageFallback';
import { supabase as crmSupabase } from '@/lib/crmSupabaseClient';

function parseRate(interets: string): number {
  const match = interets.match(/([\d.,]+)\s*%/);
  if (!match) return 0;
  return parseFloat(match[1].replace(',', '.'));
}

const ClientWithdrawal = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const leadId = clientAccount?.lead_id;
  const queryClient = useQueryClient();
  const { lang } = useLanguage();

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);

  useEffect(() => {
    track('withdrawal_start', { source: 'page_view' });
    logConnection(clientAccount?.id, 'page_view', 'Retrait');
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    if (!leadId) return;
    const { data } = await crmSupabase
      .from('client_bank_accounts')
      .select('id, titulaire, iban, bic, nom_banque')
      .eq('lead_id', leadId);
    if (data) setBankAccounts(data);
  }, [leadId]);

  const fetchWithdrawals = useCallback(async () => {
    if (!leadId) return;
    const { data: wrs } = await crmSupabase
      .from('withdrawal_requests')
      .select('id, source, source_id, amount, status, reason, admin_note, created_at, processed_at, bank_account_id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (!wrs) return;

    // Fetch bank accounts separately and merge by id
    const { data: banks } = await crmSupabase
      .from('client_bank_accounts')
      .select('id, iban, nom_banque, titulaire')
      .eq('lead_id', leadId);
    const bankMap: Record<string, any> = {};
    (banks || []).forEach(b => { bankMap[b.id] = b; });

    setWithdrawalRequests(wrs.map(wr => ({
      ...wr,
      client_bank_accounts: wr.bank_account_id ? (bankMap[wr.bank_account_id] ?? null) : null,
    })));
  }, [leadId]);

  useEffect(() => {
    fetchBankAccounts();
    fetchWithdrawals();
  }, [fetchBankAccounts, fetchWithdrawals]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['client-dashboard-bundle', leadId] });
    fetchWithdrawals();
  }, [queryClient, leadId, fetchWithdrawals]);

  const { data: portfolioData, isLoading: loadingPortfolio } = useClientDashboardBundle(leadId);

  const subscriptions = portfolioData?.subscriptions || [];
  const transactions = portfolioData?.transactions || [];
  const portfolio = portfolioData?.tradingPortfolio || null;
  const positions = (portfolioData?.positions || []).filter((p: any) => p.status === 'closed');

  const contractSources = useMemo(() => {
    return subscriptions.filter((s: any) => s.status === 'active').map((sub: any) => {
      const product = sub.products || sub.product;
      const deposits = transactions
        .filter((t: any) => t.subscription_id === sub.id && t.type === 'deposit' && t.status === 'confirmed')
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const interests = transactions
        .filter((t: any) => t.subscription_id === sub.id && t.type === 'interest' && t.status === 'confirmed')
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const withdrawals = transactions
        .filter((t: any) => t.subscription_id === sub.id && t.type === 'withdrawal' && t.status === 'confirmed')
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const pendingWr = withdrawalRequests
        .filter(wr => wr.source === 'contract' && wr.source_id === sub.id && (wr.status === 'pending' || wr.status === 'approved'))
        .reduce((s: number, wr: any) => s + Number(wr.amount), 0);
      const rate = product ? parseRate(product.interets) : 0;
      const available = deposits + interests - withdrawals - pendingWr;
      const nom = product?.nom || sub?.products?.nom || sub?.product?.nom || sub?.nom || 'Contrat';
      return { id: sub.id, label: nom, deposits, interests, withdrawals, pendingWr, available: Math.max(0, available), rate };
    });
  }, [subscriptions, transactions, withdrawalRequests]);

  const tradingSource = useMemo(() => {
    if (!portfolio) return null;
    const initialBalance = Number(portfolio.initial_balance);
    const currentBalance = Number(portfolio.balance);
    const realizedPnl = positions.reduce((s: number, p: any) => s + Number(p.pnl || 0), 0);
    const bonus = Math.max(0, currentBalance - initialBalance - realizedPnl);
    const pendingWr = withdrawalRequests
      .filter(wr => wr.source === 'trading' && (wr.status === 'pending' || wr.status === 'approved'))
      .reduce((s: number, wr: any) => s + Number(wr.amount), 0);
    const withdrawable = Math.max(0, currentBalance - bonus - pendingWr);
    return { id: portfolio.id, initialBalance, currentBalance, realizedPnl, bonus, pendingWr, withdrawable };
  }, [portfolio, positions, withdrawalRequests]);

  if (loadingPortfolio) {
    return <ClientRowsSkeleton rows={5} />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Tabs defaultValue="withdrawal" className="w-full">
        <TabsList className="w-full md:w-auto bg-transparent border-b rounded-none p-0 h-auto">
          <TabsTrigger value="withdrawal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 font-semibold">
            {lang === 'en' ? 'Withdrawals' : 'Retraits'}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 font-semibold">
            {lang === 'en' ? 'History' : 'Historique'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawal" className="space-y-6 mt-6">
          <WithdrawalPortfolio contractSources={contractSources} tradingSource={tradingSource} />
          <WithdrawalInfoBanner contractSources={contractSources} />
          <WithdrawalStepper
            leadId={leadId}
            clientAccountId={clientAccount?.id}
            contractSources={contractSources}
            tradingSource={tradingSource}
            bankAccounts={bankAccounts}
            portfolioId={portfolio?.id}
            onSuccess={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <WithdrawalHistory requests={withdrawalRequests} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientWithdrawal;
