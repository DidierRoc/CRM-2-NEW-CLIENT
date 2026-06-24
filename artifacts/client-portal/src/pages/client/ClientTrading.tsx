import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, ArrowRight, RefreshCw, AlertCircle, Lock, LineChart, Activity, Shield, Zap, TrendingUp, Sparkles, CandlestickChart } from 'lucide-react';
import { useTradingPortfolio } from '@/hooks/useClientData';
import { supabase, syncCrmRealtimeAuth } from '@/lib/crmSupabaseClient';
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
import { ClientRowsSkeleton } from '@/components/client-portal/ClientPageFallback';

const ClientTrading = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const { data: portfolioData, isLoading: loading, refetch, isFetching } = useTradingPortfolio(clientAccount?.lead_id);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tradingActive, setTradingActive] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const leadId = clientAccount?.lead_id;

  useEffect(() => {
    if (!leadId) return;

    const refreshTradingStatus = () => {
      supabase
        .from('leads')
        .select('trading_active')
        .eq('id', leadId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error) setTradingActive(!!(data as any)?.trading_active);
        });
    };

    refreshTradingStatus();
    syncCrmRealtimeAuth();

    const channel = supabase
      .channel(`lead-${leadId}`)
      .on('broadcast', { event: 'trading_mode_changed' }, ({ payload }) => {
        setTradingActive(!!payload?.trading_active);
      })
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
        (payload: any) => setTradingActive(!!payload.new?.trading_active),
      )
      .subscribe();
    const poll = setInterval(refreshTradingStatus, 20_000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  const handleRetry = async () => {
    await queryClient.invalidateQueries({ queryKey: ['client-trading', leadId] });
    refetch();
  };

  if (loading || tradingActive === null) {
    return <ClientRowsSkeleton rows={4} />;
  }

  if (!tradingActive) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 px-6">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-foreground mb-2">Plateforme indisponible</h2>
          <p className="text-sm text-muted-foreground">
            L'accès à la plateforme de trading est actuellement désactivé par votre conseiller.
          </p>
        </div>
      </div>
    );
  }

  if (!portfolioData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 px-6">
        <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-amber-500" />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-foreground mb-2">Compte de trading non activé</h2>
          <p className="text-sm text-muted-foreground mb-1">
            Votre compte de trading n'a pas encore été configuré par votre conseiller.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Contactez votre conseiller pour qu'il active votre portefeuille de trading.
          </p>
        </div>
        <button
          onClick={handleRetry}
          disabled={isFetching}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Vérification...' : 'Réessayer'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl shadow-[var(--shadow-premium)]">
        <div className="absolute inset-0" style={{ background: 'var(--gradient-hero-dark)' }} />
        <div
          aria-hidden
          className="absolute -top-24 -right-20 w-[28rem] h-[28rem] rounded-full blur-3xl premium-orb"
          style={{ background: 'radial-gradient(circle, hsl(var(--hero-glow) / 0.5), transparent 70%)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-20 w-[32rem] h-[32rem] rounded-full blur-3xl premium-orb"
          style={{
            background: 'radial-gradient(circle, hsl(var(--premium-emerald) / 0.28), transparent 70%)',
            animationDelay: '2s',
          }}
        />
        <div aria-hidden className="absolute inset-0 premium-shimmer-bg pointer-events-none" />

        {/* Decorative candlesticks */}
        <div aria-hidden className="absolute right-8 bottom-8 hidden lg:flex items-end gap-1.5 opacity-30">
          {[40, 70, 55, 90, 60, 110, 80, 130, 100, 150].map((h, i) => (
            <div
              key={i}
              className={`w-2 rounded-sm ${i % 2 === 0 ? 'bg-[hsl(var(--premium-emerald))]' : 'bg-[hsl(var(--premium-gold))]'}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        <div className="relative p-8 md:p-14 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--premium-gold))]" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/60 font-semibold">
              Trading Pro
            </span>
            <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[hsl(var(--premium-emerald))]/25 text-[hsl(152_85%_75%)] text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(152_85%_60%)] animate-pulse" />
              LIVE
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 max-w-2xl leading-[1.05]">
            Votre plateforme de <span className="text-[hsl(var(--premium-gold))]">trading</span> professionnelle
          </h1>
          <p className="text-base md:text-lg text-white/70 max-w-xl mb-8 leading-relaxed">
            Graphiques en temps réel, indicateurs techniques avancés et exécution instantanée.
            Accédez aux marchés crypto, forex et matières premières.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowConfirm(true)}
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-[hsl(var(--premium-navy,222_47%_15%))] font-bold text-sm shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all"
            >
              Accéder à la plateforme
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <span className="text-xs text-white/50 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Connexion sécurisée • Plein écran
            </span>
          </div>

          {/* Stats strip */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-white/10">
            <HeroMetric icon={<Activity className="w-3.5 h-3.5" />} label="Marchés" value="50+" />
            <HeroMetric icon={<LineChart className="w-3.5 h-3.5" />} label="Indicateurs" value="20+" hint="techniques" />
            <HeroMetric icon={<Zap className="w-3.5 h-3.5" />} label="Latence" value="<100ms" hint="exécution" />
            <HeroMetric icon={<TrendingUp className="w-3.5 h-3.5" />} label="Levier" value="x100" hint="maximum" />
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <FeatureCard
          icon={<CandlestickChart className="w-5 h-5" />}
          title="Graphiques temps réel"
          description="Chandeliers japonais, lignes, zones — toutes les unités de temps de 1m à 1 mois."
          color="emerald"
        />
        <FeatureCard
          icon={<LineChart className="w-5 h-5" />}
          title="Indicateurs avancés"
          description="RSI, MACD, Bollinger, EMA, Stochastique et plus pour affiner vos analyses."
          color="gold"
        />
        <FeatureCard
          icon={<Zap className="w-5 h-5" />}
          title="Exécution instantanée"
          description="Ordres au marché, limites, stop-loss et take-profit avec confirmation immédiate."
          color="primary"
        />
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Basculer vers la plateforme de trading</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez quitter votre espace client pour accéder à la plateforme de trading en plein écran.
              Vous pourrez revenir à votre espace client à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/client/trading/platform')}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const HeroMetric = ({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1.5 text-white/55">
      {icon}
      <p className="text-[10px] uppercase tracking-wider font-semibold">{label}</p>
    </div>
    <div className="text-2xl md:text-3xl font-bold text-white tabular-nums leading-none">
      {value}
    </div>
    {hint && <p className="text-[11px] text-white/40 mt-1">{hint}</p>}
  </div>
);

const colorMap = {
  emerald: {
    bg: 'bg-[hsl(var(--premium-emerald))]/10',
    text: 'text-[hsl(var(--premium-emerald))]',
    ring: 'ring-[hsl(var(--premium-emerald))]/15',
  },
  gold: {
    bg: 'bg-[hsl(var(--premium-gold))]/10',
    text: 'text-[hsl(var(--premium-gold))]',
    ring: 'ring-[hsl(var(--premium-gold))]/15',
  },
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    ring: 'ring-primary/10',
  },
};

const FeatureCard = ({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: keyof typeof colorMap;
}) => {
  const c = colorMap[color];
  return (
    <div className={`group rounded-2xl bg-card border border-border/60 p-5 ring-1 ${c.ring} hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all`}>
      <div className={`w-11 h-11 rounded-xl ${c.bg} ${c.text} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="font-bold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
};

export default ClientTrading;
