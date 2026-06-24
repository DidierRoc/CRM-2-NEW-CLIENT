import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, AlertTriangle } from 'lucide-react';
import TradingDashboardMT4 from '@/components/trading/TradingDashboardMT4';
import TradingLoadingScreen from '@/components/trading/TradingLoadingScreen';
import { callCrmApi } from '@/lib/crmApi';
import { useCrm } from '@/contexts/CrmContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ClientTradingPlatform = () => {
  const navigate = useNavigate();
  const { user: crmUser, authReady } = useCrm();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [localPortfolio, setLocalPortfolio] = useState<any>(undefined);
  const [leadId, setLeadId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pricesReady, setPricesReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    if (!authReady) return;
    if (!crmUser) { navigate('/client/login', { replace: true }); return; }

    const load = async () => {
      try {
        setLoadProgress(15);
        const profile = await callCrmApi('client-self-service', 'get-profile');
        const resolvedLeadId = profile?.clientAccount?.lead_id || profile?.lead?.id;
        if (!resolvedLeadId) { setLoading(false); return; }
        setLeadId(resolvedLeadId);
        setLoadProgress(35);
        const tradingData = await callCrmApi('client-trading', 'get-portfolio');
        setPortfolio(tradingData?.portfolio || tradingData);
        setLoadProgress(55);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [authReady, crmUser, navigate]);

  // Let the WebSocket market-data layer initialize without blocking the terminal UI.
  useEffect(() => {
    if (!portfolio) return;
    let cancelled = false;
    setLoadProgress(90);
    const timer = window.setTimeout(() => {
      if (!cancelled) { setLoadProgress(100); setPricesReady(true); }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [portfolio]);

  const effectivePortfolio = localPortfolio !== undefined ? localPortfolio : portfolio;

  if (!authReady || loading || (effectivePortfolio && !pricesReady)) {
    return <TradingLoadingScreen progress={loadProgress} />;
  }

  if (!effectivePortfolio) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1b1b2f]">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-[#4a90d9]/40" />
          <p className="text-[#8a8fa3]">Trading non disponible</p>
          <button onClick={() => navigate('/client/dashboard')} className="mt-4 underline text-sm text-[#4a90d9]">
            Retour à l'espace client
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#1b1b2f] overflow-hidden">
      <header className="h-8 flex items-center justify-between px-2 bg-[#2d2d44] border-b border-[#3a3a52] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-[#8a8fa3] hover:text-[#c5c8d6] hover:bg-[#3a3a52] transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Espace Client
          </button>
          <div className="h-4 w-px bg-[#3a3a52]" />
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#4a90d9]" />
            <span className="text-[11px] font-semibold text-[#c5c8d6]">Trading Platform</span>
          </div>
        </div>
      </header>

      <TradingDashboardMT4
        portfolio={effectivePortfolio}
        leadId={leadId}
        onPortfolioUpdate={setLocalPortfolio}
      />

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent className="bg-[#252540] border-[#3a3a52] text-[#c5c8d6] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <AlertDialogTitle className="text-[#e2e4ea] text-lg">
                Quitter la plateforme de trading ?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-[#8a8fa3] text-sm leading-relaxed">
              Vous êtes sur le point de quitter la plateforme de trading pour revenir à votre espace client.
              <br /><br />
              <span className="text-amber-400/90 font-medium">⚠ Attention :</span> Les positions ouvertes resteront actives. Assurez-vous d'avoir vérifié vos ordres en cours avant de quitter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-2">
            <AlertDialogCancel className="bg-[#3a3a52] border-[#4a4a62] text-[#c5c8d6] hover:bg-[#4a4a62] hover:text-[#e2e4ea]">
              Rester sur la plateforme
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => navigate('/client/dashboard')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              Confirmer et quitter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientTradingPlatform;
