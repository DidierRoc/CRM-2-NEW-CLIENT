interface Props {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/** Static currency display (count-up animation removed for stability). */
const AnimatedCurrency = ({
  value,
  decimals = 0,
  className,
  prefix = '',
  suffix = '€',
}: Props) => {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = safe.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export default AnimatedCurrency;

