interface Props {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  unrealizedPnl: number;
}

const MT4AccountBar = ({ balance, equity, margin, freeMargin, marginLevel, unrealizedPnl }: Props) => {
  const fmt = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="h-7 flex items-center gap-0 bg-[#252540] border-b border-[#3a3a52] px-2 shrink-0 overflow-x-auto">
      {[
        { label: 'Balance', value: fmt(balance), color: '#c5c8d6' },
        { label: 'Equity', value: fmt(equity), color: '#c5c8d6' },
        { label: 'Margin', value: fmt(margin), color: '#f0ad4e' },
        { label: 'Free Margin', value: fmt(freeMargin), color: freeMargin >= 0 ? '#5cb85c' : '#d9534f' },
        { label: 'Margin Level', value: margin > 0 ? `${marginLevel.toFixed(1)}%` : '—', color: marginLevel > 100 ? '#5cb85c' : '#d9534f' },
        { label: 'Profit', value: `${unrealizedPnl >= 0 ? '+' : ''}${fmt(unrealizedPnl)}`, color: unrealizedPnl >= 0 ? '#5cb85c' : '#d9534f' },
      ].map((item, i) => (
        <div key={item.label} className="flex items-center gap-1.5 px-3 border-r border-[#3a3a52] last:border-r-0 whitespace-nowrap">
          <span className="text-[10px] text-[#6b7082]">{item.label}:</span>
          <span className="text-[11px] font-mono font-bold" style={{ color: item.color }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
};

export default MT4AccountBar;
