import { Eye, EyeOff, TrendingUp, TrendingDown, Download, Wallet, Coins, Target } from 'lucide-react';
import { useEffect, useState } from 'react';

const WELCOME_STORAGE_KEY = 'lovable.client.welcome.shown';
import AnimatedCurrency from './AnimatedCurrency';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  clientName: string;
  totalValue: number;
  totalInvested: number;
  totalInterests: number;
  performancePct: number;
  projectedInterests?: number;
  activeContracts?: number;
  averageRate?: number;
  nextMaturityMonths?: number | null;
  onDownloadStatement?: () => void;
  rightSlot?: React.ReactNode;
}

const PortfolioHeroCard = ({
  clientName,
  totalValue,
  totalInvested,
  totalInterests,
  performancePct,
  projectedInterests = 0,
  activeContracts = 0,
  averageRate = 0,
  onDownloadStatement,
  rightSlot,
}: Props) => {

  const { lang } = useLanguage();
  const [hidden, setHidden] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const positive = performancePct >= 0;

  useEffect(() => {
    try {
      if (localStorage.getItem(WELCOME_STORAGE_KEY) !== '1') {
        setShowWelcome(true);
        localStorage.setItem(WELCOME_STORAGE_KEY, '1');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const mask = '••••• €';

  return (
    <div className="relative overflow-hidden rounded-3xl text-foreground shadow-[var(--shadow-premium)] premium-rise border border-border/60">
      {/* Base navy gradient */}
      <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />

      {/* Subtle guilloché pattern (banknote feel) */}
      <svg aria-hidden className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="guilloche" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M0,30 Q15,0 30,30 T60,30" fill="none" stroke="hsl(var(--premium-gold))" strokeWidth="0.6" />
            <path d="M0,30 Q15,60 30,30 T60,30" fill="none" stroke="hsl(var(--premium-gold))" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#guilloche)" />
      </svg>

      {/* Ambient orbs */}
      <div
        aria-hidden
        className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full blur-3xl premium-orb"
        style={{ background: 'radial-gradient(circle, hsl(var(--premium-gold) / 0.32), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-24 w-[34rem] h-[34rem] rounded-full blur-3xl premium-orb"
        style={{ background: 'radial-gradient(circle, hsl(var(--premium-emerald) / 0.22), transparent 70%)', animationDelay: '2s' }}
      />
      <div aria-hidden className="absolute inset-0 premium-shimmer-bg pointer-events-none" />

      {/* Top action row */}
      <div className="relative px-7 md:px-10 pt-6 md:pt-8 flex items-center justify-end gap-2">
        {onDownloadStatement && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownloadStatement}
            className="h-9 px-3 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground text-xs gap-1.5 border border-foreground/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'en' ? 'Statement' : 'Relevé'}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHidden(h => !h)}
          className="h-9 w-9 p-0 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground border border-foreground/10"
          aria-label={hidden ? (lang === 'en' ? 'Show amounts' : 'Afficher les montants') : (lang === 'en' ? 'Hide amounts' : 'Masquer les montants')}
        >
          {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      </div>



      <div className="relative px-7 md:px-10 pt-6 md:pt-8 pb-8 md:pb-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
          <div className="flex-1 min-w-0">
            {/* Header line */}
            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-foreground/55 font-semibold mb-2">
                  {showWelcome ? (lang === 'en' ? 'Welcome' : 'Bienvenue') : (lang === 'en' ? 'Global balance' : 'Solde global')}
                </p>
                <h2 className="text-base md:text-lg font-medium text-foreground/85">
                  {showWelcome
                    ? (lang === 'en' ? <>Hello, <span className="font-bold text-foreground">{clientName}</span></> : <>Bonjour, <span className="font-bold text-foreground">{clientName}</span></>)
                    : (lang === 'en' ? <>Account overview <span className="font-semibold text-foreground">{clientName}</span></> : <>Aperçu de votre compte <span className="font-semibold text-foreground">{clientName}</span></>)}
                </h2>

              </div>
            </div>

            {/* Main amount with gold halo */}
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-8 rounded-3xl opacity-70 blur-3xl pointer-events-none premium-pulse-glow"
                style={{ background: 'radial-gradient(ellipse at left center, hsl(var(--premium-gold) / 0.22), transparent 65%)' }}
              />
              <div className="relative flex items-end gap-4 flex-wrap">
                {hidden ? (
                  <span className="text-5xl md:text-7xl font-black tracking-tight tabular-nums">••••••• €</span>
                ) : (
                  <AnimatedCurrency
                    value={totalValue}
                    decimals={2}
                    className="text-5xl md:text-7xl font-black tracking-tight tabular-nums drop-shadow-[0_4px_30px_hsl(var(--premium-gold)/0.35)]"
                  />
                )}



              </div>

              <div className="relative flex items-center gap-2 mt-3 text-xs md:text-sm text-foreground/60">
                <span>{lang === 'en' ? 'Total real value of your investments' : 'Valeur totale réelle de vos investissements'}</span>
                <span className="text-foreground/30">•</span>
                <span className="tabular-nums">
                  {lang === 'en'
                    ? `${activeContracts} active contract${activeContracts > 1 ? 's' : ''}`
                    : `${activeContracts} contrat${activeContracts > 1 ? 's' : ''} actif${activeContracts > 1 ? 's' : ''}`}
                </span>
              </div>

            </div>
          </div>

          {rightSlot && (
            <div className="lg:w-[58%] xl:w-[60%] shrink-0">
              {rightSlot}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

const GlassStat = ({
  icon,
  label,
  value,
  accent = 'white',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: 'white' | 'gold' | 'emerald';
}) => {
  const accentClasses = {
    white: 'text-white',
    gold: 'text-[hsl(var(--premium-gold))]',
    emerald: 'text-[hsl(152_85%_78%)]',
  }[accent];
  const ringColor = {
    white: 'before:bg-white/40',
    gold: 'before:bg-[hsl(var(--premium-gold))]',
    emerald: 'before:bg-[hsl(var(--premium-emerald))]',
  }[accent];
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 p-4 transition-all duration-300 hover:bg-white/[0.09] hover:border-white/20 hover:-translate-y-0.5">
      {/* Left accent bar */}
      <span aria-hidden className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${ringColor.replace('before:', '')}`} />
      <div className="flex items-center gap-1.5 mb-2 text-white/55 pl-2">
        {icon}
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold">{label}</p>
      </div>
      <div className={`text-xl md:text-[26px] font-bold tabular-nums leading-tight pl-2 ${accentClasses}`}>
        {value}
      </div>
    </div>
  );
};

export default PortfolioHeroCard;
