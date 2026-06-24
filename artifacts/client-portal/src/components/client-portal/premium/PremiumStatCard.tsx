import { LucideIcon } from 'lucide-react';
import AnimatedCurrency from './AnimatedCurrency';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  label: string;
  value: number;
  decimals?: number;
  hint?: string;
  variant?: 'default' | 'success' | 'gold' | 'accent';
  delta?: { value: number; positive: boolean };
  className?: string;
  delay?: number;
}

const variantStyles: Record<NonNullable<Props['variant']>, { iconBg: string; iconColor: string; valueColor: string; ring: string }> = {
  default: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    valueColor: 'text-foreground',
    ring: 'ring-primary/10',
  },
  success: {
    iconBg: 'bg-[hsl(var(--premium-emerald))]/10',
    iconColor: 'text-[hsl(var(--premium-emerald))]',
    valueColor: 'text-[hsl(var(--premium-emerald))]',
    ring: 'ring-[hsl(var(--premium-emerald))]/15',
  },
  gold: {
    iconBg: 'bg-[hsl(var(--premium-gold))]/10',
    iconColor: 'text-[hsl(var(--premium-gold))]',
    valueColor: 'text-foreground',
    ring: 'ring-[hsl(var(--premium-gold))]/15',
  },
  accent: {
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
    valueColor: 'text-accent',
    ring: 'ring-accent/15',
  },
};

const PremiumStatCard = ({
  icon: Icon,
  label,
  value,
  decimals = 0,
  hint,
  variant = 'default',
  delta,
  className,
  delay = 0,
}: Props) => {
  const v = variantStyles[variant];

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-5',
        'shadow-[0_2px_12px_-4px_hsl(216_56%_23%/0.08)] hover:shadow-[var(--shadow-card-hover)]',
        'transition-all duration-300 hover:-translate-y-0.5 ring-1',
        v.ring,
        'premium-rise',
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Decorative orb */}
      <div
        aria-hidden
        className={cn('absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-60 transition-opacity group-hover:opacity-90', v.iconBg)}
      />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', v.iconBg)}>
              <Icon className={cn('w-4.5 h-4.5', v.iconColor)} strokeWidth={2.2} />
            </span>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {label}
            </span>
          </div>

          <div className={cn('text-2xl md:text-[28px] font-bold tabular-nums leading-tight pt-1', v.valueColor)}>
            <AnimatedCurrency value={value} decimals={decimals} />
          </div>

          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>

        {delta && (
          <span
            className={cn(
              'text-[11px] font-bold px-2 py-1 rounded-full tabular-nums',
              delta.positive
                ? 'bg-[hsl(var(--premium-emerald))]/10 text-[hsl(var(--premium-emerald))]'
                : 'bg-destructive/10 text-destructive',
            )}
          >
            {delta.positive ? '▲' : '▼'} {Math.abs(delta.value).toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default PremiumStatCard;
