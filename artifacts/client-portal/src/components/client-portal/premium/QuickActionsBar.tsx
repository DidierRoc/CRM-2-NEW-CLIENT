import { useNavigate } from 'react-router-dom';
import { BarChart3, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/clientTracking';

const QuickActionsBar = ({ tradingActive = true }: { tradingActive?: boolean }) => {
  const navigate = useNavigate();

  if (!tradingActive) return null;

  return (
    <button
      onClick={() => {
        track('page_view', { source: 'quick_actions_bar', label: 'Trading' });
        navigate('/client/trading');
      }}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-4 w-full',
        'flex items-center gap-4 text-left transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] hover:border-transparent',
        'premium-rise',
      )}
      style={{ animationDelay: '120ms' }}
    >
      <div
        aria-hidden
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-25 transition-opacity duration-500 bg-gradient-to-br from-[hsl(var(--premium-gold))] to-[hsl(28_92%_50%)]"
      />
      <span
        className={cn(
          'w-11 h-11 rounded-xl bg-gradient-to-br shrink-0 flex items-center justify-center text-white',
          'shadow-[0_8px_20px_-8px_rgba(0,0,0,0.2)] transition-transform group-hover:scale-110',
          'from-[hsl(var(--premium-gold))] to-[hsl(28_92%_50%)]',
        )}
      >
        <BarChart3 className="w-5 h-5" strokeWidth={2.2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Trading</p>
        <p className="text-[11px] text-muted-foreground">Marchés en direct • Forex, Crypto, Indices</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </button>
  );
};

export default QuickActionsBar;
