import { useState } from 'react';
import { callCrmApi } from '@/lib/crmApi';
import { useToast } from '@/hooks/use-toast';
import { getBidAskPrices } from '@/lib/tradingMarketData';

interface Props {
  positions: any[];
  portfolioId: string;
  leadId: string;
  onClose?: () => void;
  onPortfolioUpdate?: (p: any) => void;
  isHistory?: boolean;
  currentPrices?: Record<string, number>;
  symbolSpreads?: Record<string, number>;
}

const TradingPositions = ({ positions, portfolioId, leadId, onClose, onPortfolioUpdate, isHistory, currentPrices = {}, symbolSpreads = {} }: Props) => {
  const { toast } = useToast();
  const [closingId, setClosingId] = useState<string | null>(null);

  const getClosePrice = (pos: any) => {
    const midPrice = currentPrices[pos.symbol];
    if (!midPrice) return null;
    const spread = symbolSpreads[pos.symbol] || 0;
    const { bid, ask } = getBidAskPrices(pos.symbol, midPrice, spread);
    return pos.direction === 'long' ? bid : ask;
  };

  const calcPnl = (pos: any) => {
    const closePrice = getClosePrice(pos);
    if (closePrice === null) return null;
    return pos.direction === 'long'
      ? (closePrice - pos.entry_price) * pos.quantity * pos.leverage
      : (pos.entry_price - closePrice) * pos.quantity * pos.leverage;
  };

  const closePosition = async (pos: any, exitPrice: number) => {
    setClosingId(pos.id);
    try {
      const pnl = pos.direction === 'long'
        ? (exitPrice - pos.entry_price) * pos.quantity * pos.leverage
        : (pos.entry_price - exitPrice) * pos.quantity * pos.leverage;

      const result = await callCrmApi('client-trading', 'close-position', { positionId: pos.id, exitPrice, pnl });
      if (result?.portfolio) onPortfolioUpdate?.(result.portfolio);
      toast({ title: 'Position fermée', description: `PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` });
      onClose?.();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally { setClosingId(null); }
  };

  if (positions.length === 0) {
    return <p className="text-[11px] text-[#6b7082] text-center py-4">{isHistory ? 'Aucun historique' : 'Aucune position ouverte'}</p>;
  }

  const fmt = (v: number) => {
    if (v < 1) return v.toFixed(6);
    if (v < 100) return v.toFixed(4);
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-[#6b7082] uppercase border-b border-[#2d2d44]">
            <th className="text-left py-1 px-2 font-medium">#</th>
            <th className="text-left py-1 px-2 font-medium">Symbole</th>
            <th className="text-center py-1 px-2 font-medium">Type</th>
            <th className="text-right py-1 px-2 font-medium">Volume</th>
            <th className="text-right py-1 px-2 font-medium">Entrée</th>
            <th className="text-right py-1 px-2 font-medium">S/L</th>
            <th className="text-right py-1 px-2 font-medium">T/P</th>
            <th className="text-right py-1 px-2 font-medium">{isHistory ? 'Sortie' : 'Prix'}</th>
            <th className="text-right py-1 px-2 font-medium">Levier</th>
            <th className="text-right py-1 px-2 font-medium">Profit</th>
            {!isHistory && <th className="text-center py-1 px-2 font-medium">Action</th>}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, idx) => {
            const pnl = !isHistory ? calcPnl(pos) : parseFloat(pos.pnl || 0);
            const closePrice = !isHistory ? getClosePrice(pos) : parseFloat(pos.exit_price || 0);
            const currentMid = currentPrices[pos.symbol];

            return (
              <tr
                key={pos.id}
                className="border-b border-[#2d2d44]/50 hover:bg-[#2d2d44]/30 transition-colors"
              >
                <td className="py-1 px-2 text-[#6b7082]">{idx + 1}</td>
                <td className="py-1 px-2 font-medium text-[#c5c8d6]">{pos.symbol?.replace('USDT', '/USDT')}</td>
                <td className="py-1 px-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    pos.direction === 'long' ? 'text-[#26a69a] bg-[#26a69a15]' : 'text-[#ef5350] bg-[#ef535015]'
                  }`}>
                    {pos.direction === 'long' ? 'BUY' : 'SELL'}
                  </span>
                </td>
                <td className="py-1 px-2 text-right font-mono text-[#8a8fa3]">{pos.quantity}</td>
                <td className="py-1 px-2 text-right font-mono text-[#c5c8d6]">{fmt(parseFloat(pos.entry_price))}</td>
                <td className="py-1 px-2 text-right font-mono text-[#6b7082]">{pos.stop_loss ? fmt(parseFloat(pos.stop_loss)) : '—'}</td>
                <td className="py-1 px-2 text-right font-mono text-[#6b7082]">{pos.take_profit ? fmt(parseFloat(pos.take_profit)) : '—'}</td>
                <td className="py-1 px-2 text-right font-mono text-[#8a8fa3]">
                  {isHistory ? (pos.exit_price ? fmt(parseFloat(pos.exit_price)) : '—') : (currentMid ? fmt(currentMid) : '—')}
                </td>
                <td className="py-1 px-2 text-right font-mono text-[#8a8fa3]">x{pos.leverage}</td>
                <td className={`py-1 px-2 text-right font-mono font-bold ${
                  pnl !== null && pnl >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'
                }`}>
                  {pnl !== null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '—'}
                </td>
                {!isHistory && (
                  <td className="py-1 px-2 text-center">
                    <button
                      disabled={closingId === pos.id || !closePrice}
                      onClick={() => { if (closePrice) closePosition(pos, closePrice); }}
                      className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#ef5350] text-white hover:bg-[#f44336] disabled:opacity-30 transition-colors"
                    >
                      {closingId === pos.id ? '...' : 'Fermer'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TradingPositions;
