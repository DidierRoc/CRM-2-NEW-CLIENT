import { useState, useMemo } from 'react';
import { formatMarketPrice, getBidAskPrices } from '@/lib/tradingMarketData';

interface SymbolDef {
  symbol: string;
  label: string;
  type: string;
  spreadKey: string;
}

interface Props {
  symbols: SymbolDef[];
  categories: { key: string; label: string }[];
  livePrices: Record<string, number>;
  spreadsConfig: Record<string, number>;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

const MT4MarketWatch = ({ symbols, categories, livePrices, spreadsConfig, selectedSymbol, onSelectSymbol }: Props) => {
  const [activeCategory, setActiveCategory] = useState('crypto');

  const filteredSymbols = useMemo(
    () => symbols.filter(s => s.type === activeCategory),
    [symbols, activeCategory]
  );

  const formatPrice = (symbol: string, price: number) => {
    if (!price) return '—';
    return formatMarketPrice(symbol, price);
  };

  return (
    <div className="w-[220px] shrink-0 border-r border-[#3a3a52] bg-[#1e1e32] flex flex-col overflow-hidden">
      {/* Title */}
      <div className="px-2 py-1.5 border-b border-[#2d2d44] bg-[#252540]">
        <p className="text-[10px] font-bold text-[#8a8fa3] uppercase tracking-wider">Market Watch</p>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-[#2d2d44]">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex-1 py-1 text-[10px] font-medium transition-colors ${
              activeCategory === cat.key
                ? 'text-[#4a90d9] bg-[#1e1e32] border-b border-[#4a90d9]'
                : 'text-[#6b7082] hover:text-[#8a8fa3] bg-[#252540]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_60px_60px] px-2 py-1 text-[9px] font-bold text-[#6b7082] uppercase border-b border-[#2d2d44] bg-[#252540]">
        <span>Symbol</span>
        <span className="text-right">Bid</span>
        <span className="text-right">Ask</span>
      </div>

      {/* Symbol list */}
      <div className="flex-1 overflow-y-auto">
        {filteredSymbols.map(sym => {
          const mid = livePrices[sym.symbol] || 0;
          const spread = spreadsConfig[sym.spreadKey] || 0;
          const { bid, ask } = getBidAskPrices(sym.symbol, mid, spread);
          const isSelected = selectedSymbol === sym.symbol;

          return (
            <button
              key={sym.symbol}
              onClick={() => onSelectSymbol(sym.symbol)}
              onDoubleClick={() => onSelectSymbol(sym.symbol)}
              className={`w-full grid grid-cols-[1fr_60px_60px] px-2 py-[5px] text-left transition-colors border-b border-[#2d2d44]/50 ${
                isSelected
                  ? 'bg-[#4a90d9]/15 text-[#c5c8d6]'
                  : 'text-[#8a8fa3] hover:bg-[#2d2d44]'
              }`}
            >
              <span className="text-[11px] font-medium truncate">{sym.label}</span>
              <span className="text-[10px] font-mono text-right text-red-400">{bid > 0 ? formatPrice(sym.symbol, bid) : '—'}</span>
              <span className="text-[10px] font-mono text-right text-blue-400">{ask > 0 ? formatPrice(sym.symbol, ask) : '—'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MT4MarketWatch;
