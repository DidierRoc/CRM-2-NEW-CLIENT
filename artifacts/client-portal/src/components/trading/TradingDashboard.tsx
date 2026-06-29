import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, History, ListOrdered } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import TradingChart from './TradingChart';
import TradingOrderPanel from './TradingOrderPanel';
import TradingPositions from './TradingPositions';
import TradingOrders from './TradingOrders';
import TradingPortfolioHeader from './TradingPortfolioHeader';
import { useTradingData } from '@/hooks/useTradingData';

interface Props {
  portfolio: any;
  leadId: string;
  onPortfolioUpdate: (p: any) => void;
}

const SYMBOLS = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT', type: 'crypto', spreadKey: 'BTCUSDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT', type: 'crypto', spreadKey: 'ETHUSDT' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT', type: 'crypto', spreadKey: 'BNBUSDT' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT', type: 'crypto', spreadKey: 'SOLUSDT' },
  { symbol: 'XRPUSDT', label: 'XRP/USDT', type: 'crypto', spreadKey: 'XRPUSDT' },
  { symbol: 'DOGEUSDT', label: 'DOGE/USDT', type: 'crypto', spreadKey: 'DOGEUSDT' },
  { symbol: 'ADAUSDT', label: 'ADA/USDT', type: 'crypto', spreadKey: 'ADAUSDT' },
  { symbol: 'AVAXUSDT', label: 'AVAX/USDT', type: 'crypto', spreadKey: 'AVAXUSDT' },
  { symbol: 'EURUSDT', label: 'EUR/USD', type: 'forex', spreadKey: 'EURUSD' },
  { symbol: 'GBPUSDT', label: 'GBP/USD', type: 'forex', spreadKey: 'GBPUSD' },
  { symbol: 'JPYUSDT', label: 'USD/JPY', type: 'forex', spreadKey: 'JPYUSDT' },
  { symbol: 'CHFUSDT', label: 'USD/CHF', type: 'forex', spreadKey: 'CHFUSDT' },
  { symbol: 'AUDUSDT', label: 'AUD/USD', type: 'forex', spreadKey: 'AUDUSDT' },
  { symbol: 'CADUSDT', label: 'USD/CAD', type: 'forex', spreadKey: 'CADUSDT' },
  { symbol: 'PAXGUSDT', labelFr: 'Or (PAXG)', labelEn: 'Gold (PAXG)', type: 'commodities', spreadKey: 'XAUUSD' },
  { symbol: 'AUCTIONUSDT', labelFr: 'Argent (AUCTION)', labelEn: 'Silver (AUCTION)', type: 'commodities', spreadKey: 'XAGUSD' },
];

const TradingDashboard = ({ portfolio, leadId, onPortfolioUpdate }: Props) => {
  const { lang } = useLanguage();
  const SYMBOL_CATEGORIES = [
    { key: 'crypto', label: 'Crypto' },
    { key: 'forex', label: 'Forex' },
    { key: 'commodities', label: lang === 'en' ? 'Commodities' : 'Matières Premières' },
  ];
  const [selectedSymbol, setSelectedSymbol] = useState(SYMBOLS[0]);
  const [selectedCategory, setSelectedCategory] = useState('crypto');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const priceWsRef = useRef<WebSocket | null>(null);

  const filteredSymbols = SYMBOLS.filter(s => s.type === selectedCategory);
  const { positions, orders, refreshPositions, refreshOrders } = useTradingData(portfolio.id, leadId);

  const openPositions = positions.filter(p => p.status === 'open');
  const openSymbolsKey = [...new Set(openPositions.map(p => p.symbol as string))].sort().join(',');

  // Extract spreads config
  const spreadsConfig = useMemo(() => {
    return (portfolio?.spreads_config as Record<string, number>) || {};
  }, [portfolio?.spreads_config]);

  // Get spread for current symbol
  const currentSpread = useMemo(() => {
    return spreadsConfig[selectedSymbol.spreadKey] || 0;
  }, [spreadsConfig, selectedSymbol.spreadKey]);

  // Build a map of symbol -> spread for positions
  const symbolSpreadMap = useMemo(() => {
    const map: Record<string, number> = {};
    SYMBOLS.forEach(s => {
      map[s.symbol] = spreadsConfig[s.spreadKey] || 0;
    });
    return map;
  }, [spreadsConfig]);

  // Subscribe to live prices for all open position symbols via a single combined stream
  useEffect(() => {
    if (priceWsRef.current) {
      priceWsRef.current.close();
      priceWsRef.current = null;
    }

    if (!openSymbolsKey) return;
    const openSymbols = openSymbolsKey.split(',');

    const streams = openSymbols.map(s => `${s.toLowerCase()}@trade`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const data = msg.data;
        if (data?.s && data?.p) {
          setLivePrices(prev => ({ ...prev, [data.s]: parseFloat(data.p) }));
        }
      } catch {}
    };

    priceWsRef.current = ws;
    return () => ws.close();
  }, [openSymbolsKey]);

  // Also update livePrices from the chart's selected symbol
  const handlePriceChange = useCallback((price: number) => {
    setCurrentPrice(price);
    setLivePrices(prev => ({ ...prev, [selectedSymbol.symbol]: price }));
  }, [selectedSymbol.symbol]);

  return (
    <div className="space-y-4">
      <TradingPortfolioHeader portfolio={portfolio} positions={positions} currentPrices={livePrices} />

      {/* Category tabs */}
      <div className="flex gap-2">
        {SYMBOL_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => {
              setSelectedCategory(cat.key);
              const first = SYMBOLS.find(s => s.type === cat.key);
              if (first) setSelectedSymbol(first);
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === cat.key
                ? 'bg-primary text-primary-foreground shadow'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Symbol selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filteredSymbols.map(s => (
          <button
            key={s.symbol}
            onClick={() => setSelectedSymbol(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              selectedSymbol.symbol === s.symbol
                ? 'bg-accent text-accent-foreground shadow'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {(s as any).labelEn ? (lang === 'en' ? (s as any).labelEn : (s as any).labelFr) : s.label}
          </button>
        ))}
      </div>

      {/* Chart + Order panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TradingChart
            symbol={selectedSymbol.symbol}
            onPriceChange={handlePriceChange}
            spread={currentSpread}
          />
        </div>
        <div>
          <TradingOrderPanel
            symbol={selectedSymbol.symbol}
            symbolLabel={(selectedSymbol as any).labelEn ? (lang === 'en' ? (selectedSymbol as any).labelEn : (selectedSymbol as any).labelFr) : selectedSymbol.label}
            currentPrice={currentPrice}
            portfolio={portfolio}
            leadId={leadId}
            onOrderPlaced={() => { refreshPositions(); refreshOrders(); }}
            onPortfolioUpdate={onPortfolioUpdate}
            spread={currentSpread}
          />
        </div>
      </div>

      {/* Positions & Orders tabs */}
      <Tabs defaultValue="positions" className="bg-card rounded-xl border shadow-sm">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent px-4 pt-2">
          <TabsTrigger value="positions" className="gap-1.5 data-[state=active]:bg-primary/10">
            <TrendingUp className="w-3.5 h-3.5" />Positions ({openPositions.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5 data-[state=active]:bg-primary/10">
            <ListOrdered className="w-3.5 h-3.5" />{lang === 'en' ? 'Orders' : 'Ordres'} ({orders.filter(o => o.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 data-[state=active]:bg-primary/10">
            <History className="w-3.5 h-3.5" />{lang === 'en' ? 'History' : 'Historique'}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="positions" className="p-4">
          <TradingPositions
            positions={openPositions}
            portfolioId={portfolio.id}
            leadId={leadId}
            onClose={() => { refreshPositions(); }}
            onPortfolioUpdate={onPortfolioUpdate}
            currentPrices={livePrices}
            symbolSpreads={symbolSpreadMap}
          />
        </TabsContent>
        <TabsContent value="orders" className="p-4">
          <TradingOrders
            orders={orders.filter(o => o.status === 'pending')}
            onCancel={refreshOrders}
          />
        </TabsContent>
        <TabsContent value="history" className="p-4">
          <TradingPositions
            positions={positions.filter(p => p.status === 'closed')}
            portfolioId={portfolio.id}
            leadId={leadId}
            isHistory
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TradingDashboard;
