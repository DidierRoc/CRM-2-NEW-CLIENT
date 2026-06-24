import { useState, useCallback, useMemo } from 'react';
import TradingChart from './TradingChart';
import TradingOrderPanel from './TradingOrderPanel';
import TradingPositions from './TradingPositions';
import TradingOrders from './TradingOrders';
import MT4MarketWatch from './MT4MarketWatch';
import MT4AccountBar from './MT4AccountBar';
import { useTradingData } from '@/hooks/useTradingData';
import { useRealtimeMarketPrices } from '@/hooks/useRealtimeMarketPrices';
import { getBidAskPrices } from '@/lib/tradingMarketData';
import { SYMBOLS, SYMBOL_CATEGORIES, TERMINAL_TABS } from '@/lib/tradingSymbols';

interface Props {
  portfolio: any;
  leadId: string;
  onPortfolioUpdate: (p: any) => void;
}

const TradingDashboardMT4 = ({ portfolio, leadId, onPortfolioUpdate }: Props) => {
  const [selectedSymbol, setSelectedSymbol] = useState(SYMBOLS[0]);
  const [activeTerminalTab, setActiveTerminalTab] = useState('positions');
  const [showOrderPanel, setShowOrderPanel] = useState(true);

  const { positions, orders, refreshPositions, refreshOrders } = useTradingData(portfolio.id, leadId);
  const openPositions = positions.filter(p => p.status === 'open');
  const openSymbolsKey = [...new Set(openPositions.map(p => p.symbol as string))].sort().join(',');
  const streamedSymbols = useMemo(() => {
    const allSymbols = new Set(SYMBOLS.map(s => s.symbol));
    if (openSymbolsKey) openSymbolsKey.split(',').forEach(s => allSymbols.add(s));
    return [...allSymbols].map(symbol => SYMBOLS.find(s => s.symbol === symbol) || { symbol, label: symbol, type: 'crypto', spreadKey: symbol });
  }, [openSymbolsKey]);
  const { prices: livePrices } = useRealtimeMarketPrices(streamedSymbols);
  const currentPrice = livePrices[selectedSymbol.symbol] || 0;

  const spreadsConfig = useMemo(() => (portfolio?.spreads_config as Record<string, number>) || {}, [portfolio?.spreads_config]);
  const currentSpread = useMemo(() => spreadsConfig[selectedSymbol.spreadKey] || 0, [spreadsConfig, selectedSymbol.spreadKey]);
  const symbolSpreadMap = useMemo(() => {
    const map: Record<string, number> = {};
    SYMBOLS.forEach(s => { map[s.symbol] = spreadsConfig[s.spreadKey] || 0; });
    return map;
  }, [spreadsConfig]);

  const handlePriceChange = useCallback((_price: number) => {}, []);

  // Account stats — apply spread (bid/ask) on the close side so PnL reflects real spread cost
  let unrealizedPnl = 0;
  let investedAmount = 0;
  for (const pos of openPositions) {
    const cost = parseFloat(pos.entry_price) * parseFloat(pos.quantity);
    investedAmount += cost;
    const livePrice = livePrices[pos.symbol];
    if (livePrice) {
      const spread = symbolSpreadMap[pos.symbol] || 0;
      const { bid, ask } = getBidAskPrices(pos.symbol, livePrice, spread);
      const closePrice = pos.direction === 'long' ? bid : ask;
      const pnl = pos.direction === 'long'
        ? (closePrice - parseFloat(pos.entry_price)) * parseFloat(pos.quantity) * (pos.leverage || 1)
        : (parseFloat(pos.entry_price) - closePrice) * parseFloat(pos.quantity) * (pos.leverage || 1);
      unrealizedPnl += pnl;
    }
  }
  const equity = portfolio.balance + investedAmount + unrealizedPnl;
  const margin = investedAmount;
  const freeMargin = equity - margin;
  const marginLevel = margin > 0 ? (equity / margin) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden mt4-zoom">
      <style>{`
        .mt4-zoom { zoom: 1.18; }
        @supports not (zoom: 1) {
          .mt4-zoom { transform: scale(1.18); transform-origin: top left; width: 84.75%; height: 84.75%; }
        }
      `}</style>
      <MT4AccountBar
        balance={portfolio.balance}
        equity={equity}
        margin={margin}
        freeMargin={freeMargin}
        marginLevel={marginLevel}
        unrealizedPnl={unrealizedPnl}
      />

      <div className="flex-1 flex overflow-hidden">
        <MT4MarketWatch
          symbols={SYMBOLS}
          categories={SYMBOL_CATEGORIES}
          livePrices={livePrices}
          spreadsConfig={spreadsConfig}
          selectedSymbol={selectedSymbol.symbol}
          onSelectSymbol={(sym) => {
            const found = SYMBOLS.find(s => s.symbol === sym);
            if (found) setSelectedSymbol(found);
          }}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <TradingChart
            symbol={selectedSymbol.symbol}
            onPriceChange={handlePriceChange}
            spread={currentSpread}
            livePrice={currentPrice}
          />
        </div>

        {showOrderPanel && (
          <div className="w-[280px] shrink-0 border-l border-[#3a3a52] overflow-y-auto bg-[#1e1e32]">
            <TradingOrderPanel
              symbol={selectedSymbol.symbol}
              symbolLabel={selectedSymbol.label}
              currentPrice={currentPrice}
              portfolio={portfolio}
              leadId={leadId}
              onOrderPlaced={() => { refreshPositions(); refreshOrders(); }}
              onPortfolioUpdate={onPortfolioUpdate}
              spread={currentSpread}
            />
          </div>
        )}
      </div>

      <div className="h-[200px] shrink-0 border-t border-[#3a3a52] bg-[#1e1e32] flex flex-col">
        <div className="flex items-center border-b border-[#2d2d44] bg-[#252540]">
          {TERMINAL_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTerminalTab(tab.key)}
              className={`px-4 py-1.5 text-[11px] font-medium border-r border-[#2d2d44] transition-colors ${
                activeTerminalTab === tab.key
                  ? 'bg-[#1e1e32] text-[#4a90d9] border-b-2 border-b-[#4a90d9]'
                  : 'text-[#8a8fa3] hover:text-[#c5c8d6] hover:bg-[#2d2d44]'
              }`}
            >
              {tab.label}
              {tab.key === 'positions' && openPositions.length > 0 && (
                <span className="ml-1 text-[10px] text-[#4a90d9]">({openPositions.length})</span>
              )}
              {tab.key === 'orders' && orders.filter(o => o.status === 'pending').length > 0 && (
                <span className="ml-1 text-[10px] text-[#4a90d9]">({orders.filter(o => o.status === 'pending').length})</span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setShowOrderPanel(!showOrderPanel)}
            className="px-3 py-1 text-[10px] text-[#8a8fa3] hover:text-[#c5c8d6] transition-colors"
          >
            {showOrderPanel ? 'Masquer Ordres' : 'Afficher Ordres'}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-1">
          {activeTerminalTab === 'positions' && (
            <TradingPositions
              positions={openPositions}
              portfolioId={portfolio.id}
              leadId={leadId}
              onClose={refreshPositions}
              onPortfolioUpdate={onPortfolioUpdate}
              currentPrices={livePrices}
              symbolSpreads={symbolSpreadMap}
            />
          )}
          {activeTerminalTab === 'orders' && (
            <TradingOrders
              orders={orders.filter(o => o.status === 'pending')}
              onCancel={refreshOrders}
            />
          )}
          {activeTerminalTab === 'history' && (
            <TradingPositions
              positions={positions.filter(p => p.status === 'closed')}
              portfolioId={portfolio.id}
              leadId={leadId}
              isHistory
            />
          )}
          {activeTerminalTab === 'account' && (
            <div className="grid grid-cols-6 gap-2 p-2 text-[11px]">
              {[
                { label: 'Solde',        value: `$${portfolio.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,                     color: '#c5c8d6' },
                { label: 'Equité',       value: `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,                                 color: '#c5c8d6' },
                { label: 'Marge',        value: `$${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,                                  color: '#f0ad4e' },
                { label: 'Marge libre',  value: `$${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,                             color: freeMargin >= 0 ? '#5cb85c' : '#d9534f' },
                { label: 'Niveau marge', value: margin > 0 ? `${marginLevel.toFixed(1)}%` : '—',                                                     color: marginLevel > 100 ? '#5cb85c' : '#d9534f' },
                { label: 'PnL flottant', value: `${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)}`,                                     color: unrealizedPnl >= 0 ? '#5cb85c' : '#d9534f' },
              ].map(item => (
                <div key={item.label} className="bg-[#252540] rounded p-2">
                  <p className="text-[#6b7082] mb-0.5">{item.label}</p>
                  <p className="font-mono font-bold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradingDashboardMT4;
