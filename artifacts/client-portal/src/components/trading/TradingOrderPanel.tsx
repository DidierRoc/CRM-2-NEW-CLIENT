import { useState } from 'react';
import { callCrmApi } from '@/lib/crmApi';
import { useToast } from '@/hooks/use-toast';
import { formatMarketPrice, getBidAskPrices } from '@/lib/tradingMarketData';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  symbol: string;
  symbolLabel: string;
  currentPrice: number;
  portfolio: any;
  leadId: string;
  onOrderPlaced: () => void;
  onPortfolioUpdate: (p: any) => void;
  spread?: number;
}

const TradingOrderPanel = ({
  symbol, symbolLabel, currentPrice, portfolio, leadId,
  onOrderPlaced, onPortfolioUpdate, spread = 0
}: Props) => {
  const { toast } = useToast();
  const { lang } = useLanguage();
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [quantity, setQuantity] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [leverage, setLeverage] = useState('1');
  const [loading, setLoading] = useState(false);

  const { bid: bidPrice, ask: askPrice } = getBidAskPrices(symbol, currentPrice, spread);
  const executionPrice = direction === 'long' ? askPrice : bidPrice;
  const cost = executionPrice * parseFloat(quantity || '0');

  const fmt = (p: number) => {
    if (p === 0) return '0.00';
    return formatMarketPrice(symbol, p);
  };

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast({ title: lang === 'en' ? 'Error' : 'Erreur', description: lang === 'en' ? 'Invalid quantity' : 'Quantité invalide', variant: 'destructive' }); return; }
    if (orderType === 'market' && (!Number.isFinite(executionPrice) || executionPrice <= 0)) { toast({ title: lang === 'en' ? 'Error' : 'Erreur', description: lang === 'en' ? 'Price unavailable' : 'Prix indisponible', variant: 'destructive' }); return; }

    const price = orderType === 'market' ? executionPrice : parseFloat(targetPrice);
    if (orderType !== 'market' && (!price || price <= 0)) { toast({ title: lang === 'en' ? 'Error' : 'Erreur', description: lang === 'en' ? 'Invalid target price' : 'Prix cible invalide', variant: 'destructive' }); return; }

    const totalCost = (orderType === 'market' ? executionPrice : price) * qty;
    if (totalCost > portfolio.balance) {
      toast({ title: lang === 'en' ? 'Insufficient funds' : 'Fonds insuffisants', description: `${lang === 'en' ? 'Cost' : 'Coût'}: $${fmt(totalCost)}, ${lang === 'en' ? 'Balance' : 'Solde'}: $${fmt(portfolio.balance)}`, variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await callCrmApi('client-trading', 'place-order', {
        symbol, direction, quantity: qty, orderType,
        targetPrice: orderType !== 'market' ? price : undefined,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        leverage: parseInt(leverage) || 1,
        executionPrice: orderType === 'market' ? executionPrice : undefined,
      });

      if (result?.portfolio) onPortfolioUpdate(result.portfolio);
      else onPortfolioUpdate({ ...portfolio, balance: portfolio.balance - totalCost });

      toast({ title: lang === 'en' ? 'Success' : 'Succès', description: orderType === 'market' ? (lang === 'en' ? 'Position opened' : 'Position ouverte') : (lang === 'en' ? 'Order placed' : 'Ordre placé') });
      setQuantity(''); setTargetPrice(''); setStopLoss(''); setTakeProfit('');
      onOrderPlaced();
    } catch (err: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Erreur', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const inputClass = "w-full h-7 px-2 text-[11px] font-mono bg-[#1b1b2f] border border-[#3a3a52] rounded text-[#c5c8d6] focus:border-[#4a90d9] focus:outline-none";
  const labelClass = "text-[10px] text-[#6b7082] uppercase font-medium mb-0.5 block";

  return (
    <div className="p-3 space-y-2.5">
      {/* Title */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-[#c5c8d6]">{symbolLabel}</p>
        <p className="text-[10px] font-mono text-[#6b7082]">{lang === 'en' ? 'New Order' : 'Nouvel Ordre'}</p>
      </div>

      {/* Buy/Sell buttons */}
      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={() => setDirection('long')}
          className={`py-2 rounded text-[11px] font-bold transition-all ${
            direction === 'long' ? 'bg-[#26a69a] text-white' : 'bg-[#252540] text-[#6b7082] hover:bg-[#2d2d44]'
          }`}
        >
          <div className="text-[9px] font-normal opacity-80">{lang === 'en' ? 'Buy' : 'Achat'}</div>
          <div className="font-mono">{fmt(askPrice)}</div>
        </button>
        <button
          onClick={() => setDirection('short')}
          className={`py-2 rounded text-[11px] font-bold transition-all ${
            direction === 'short' ? 'bg-[#ef5350] text-white' : 'bg-[#252540] text-[#6b7082] hover:bg-[#2d2d44]'
          }`}
        >
          <div className="text-[9px] font-normal opacity-80">{lang === 'en' ? 'Sell' : 'Vente'}</div>
          <div className="font-mono">{fmt(bidPrice)}</div>
        </button>
      </div>

      {/* Spread display */}
      {spread > 0 && (
        <div className="text-center">
          <span className="text-[9px] text-[#6b7082]">Spread: <span className="text-[#8a8fa3] font-mono">{spread} pts</span></span>
        </div>
      )}

      {/* Order type */}
      <div className="grid grid-cols-3 gap-0.5 bg-[#252540] rounded p-0.5">
        {(['market', 'limit', 'stop'] as const).map(t => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`py-1 rounded text-[10px] font-medium transition-colors ${
              orderType === t ? 'bg-[#4a90d9] text-white' : 'text-[#6b7082] hover:text-[#8a8fa3]'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Target price for limit/stop */}
      {orderType !== 'market' && (
        <div>
          <label className={labelClass}>{lang === 'en' ? 'Target price' : 'Prix cible'}</label>
          <input type="number" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder="0.00" className={inputClass} />
        </div>
      )}

      {/* Volume / Quantity */}
      <div>
        <label className={labelClass}>{lang === 'en' ? 'Volume (Quantity)' : 'Volume (Quantité)'}</label>
        <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.01" className={inputClass} />
      </div>

      {/* Leverage */}
      <div>
        <label className={labelClass}>{lang === 'en' ? 'Leverage' : 'Levier'}</label>
        <div className="flex gap-0.5">
          {['1', '2', '5', '10', '25', '50', '100'].map(l => (
            <button
              key={l}
              onClick={() => setLeverage(l)}
              className={`flex-1 py-1 text-[10px] font-mono rounded transition-colors ${
                leverage === l ? 'bg-[#4a90d9] text-white' : 'bg-[#252540] text-[#6b7082] hover:bg-[#2d2d44]'
              }`}
            >
              {l}x
            </button>
          ))}
        </div>
      </div>

      {/* SL / TP */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className={labelClass}>Stop Loss</label>
          <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="—" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Take Profit</label>
          <input type="number" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} placeholder="—" className={inputClass} />
        </div>
      </div>

      {/* Cost estimate */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#252540] rounded text-[10px]">
        <span className="text-[#6b7082]">{lang === 'en' ? 'Estimated cost' : 'Coût estimé'}</span>
        <span className="font-mono font-bold text-[#c5c8d6]">${fmt(cost)}</span>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between px-2 py-1 text-[10px]">
        <span className="text-[#6b7082]">{lang === 'en' ? 'Available balance' : 'Solde disponible'}</span>
        <span className="font-mono text-[#8a8fa3]">${fmt(portfolio.balance || 0)}</span>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !quantity}
        className={`w-full py-2.5 rounded font-bold text-[12px] text-white transition-all disabled:opacity-40 ${
          direction === 'long'
            ? 'bg-[#26a69a] hover:bg-[#2bbbad]'
            : 'bg-[#ef5350] hover:bg-[#f44336]'
        }`}
      >
        {loading ? (lang === 'en' ? 'Sending...' : 'Envoi...') : direction === 'long' ? `Buy ${symbolLabel}` : `Sell ${symbolLabel}`}
      </button>
    </div>
  );
};

export default TradingOrderPanel;
