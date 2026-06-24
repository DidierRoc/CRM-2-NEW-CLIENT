import { useState } from 'react';
import { Activity } from 'lucide-react';
import { AVAILABLE_INDICATORS, IndicatorDef } from '@/lib/tradingIndicators';

interface Props {
  activeIndicators: string[];
  onToggle: (id: string) => void;
}

const INDICATOR_COLORS: Record<string, string> = {
  sma20: '#f59e0b',
  sma50: '#3b82f6',
  sma200: '#ef4444',
  ema12: '#a855f7',
  ema26: '#ec4899',
  ema200: '#fbbf24',
  bollinger: '#06b6d4',
  support_resistance: '#22d3ee',
  vwap: '#f97316',
  rsi: '#8b5cf6',
  macd: '#10b981',
  stochastic: '#f43f5e',
  atr: '#64748b',
};

const TradingIndicatorSelector = ({ activeIndicators, onToggle }: Props) => {
  const [open, setOpen] = useState(false);

  const overlays = AVAILABLE_INDICATORS.filter(i => i.category === 'overlay');
  const oscillators = AVAILABLE_INDICATORS.filter(i => i.category === 'oscillator');

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[#8a8fa3] hover:text-[#c5c8d6] hover:bg-[#2d2d44] transition-colors"
      >
        <Activity className="w-3 h-3" />
        Indicateurs
        {activeIndicators.length > 0 && (
          <span className="bg-[#4a90d9] text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center font-bold">
            {activeIndicators.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#252540] border border-[#3a3a52] rounded-lg shadow-2xl w-64 max-h-[60vh] overflow-y-auto">
            {/* Overlays */}
            <div className="px-2 py-1.5 border-b border-[#2d2d44]">
              <p className="text-[9px] font-bold text-[#6b7082] uppercase tracking-wider">Superposition</p>
            </div>
            <div className="py-0.5">
              {overlays.map(ind => (
                <IndicatorRow key={ind.id} indicator={ind} active={activeIndicators.includes(ind.id)} color={INDICATOR_COLORS[ind.id]} onToggle={onToggle} />
              ))}
            </div>

            {/* Oscillators */}
            <div className="px-2 py-1.5 border-b border-t border-[#2d2d44]">
              <p className="text-[9px] font-bold text-[#6b7082] uppercase tracking-wider">Oscillateurs</p>
            </div>
            <div className="py-0.5">
              {oscillators.map(ind => (
                <IndicatorRow key={ind.id} indicator={ind} active={activeIndicators.includes(ind.id)} color={INDICATOR_COLORS[ind.id]} onToggle={onToggle} />
              ))}
            </div>

            {activeIndicators.length > 0 && (
              <div className="border-t border-[#2d2d44] p-1.5">
                <button
                  onClick={() => activeIndicators.forEach(id => onToggle(id))}
                  className="w-full text-[10px] text-[#6b7082] hover:text-[#ef5350] py-1 text-center transition-colors"
                >
                  Tout désactiver
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

function IndicatorRow({ indicator, active, color, onToggle }: {
  indicator: IndicatorDef; active: boolean; color: string; onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(indicator.id)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
        active ? 'bg-[#4a90d920]' : 'hover:bg-[#2d2d44]'
      }`}
    >
      <div className="w-2.5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: active ? color : '#6b7082' }} />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-medium text-[#c5c8d6]">{indicator.label}</span>
        <span className="text-[9px] text-[#6b7082] ml-1.5">{indicator.description}</span>
      </div>
      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
        active ? 'bg-[#4a90d9] border-[#4a90d9]' : 'border-[#3a3a52]'
      }`}>
        {active && <span className="text-white text-[8px]">✓</span>}
      </div>
    </button>
  );
}

export default TradingIndicatorSelector;
export { INDICATOR_COLORS };
