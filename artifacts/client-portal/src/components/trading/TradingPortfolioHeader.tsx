import { Wallet, TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';

interface Props {
  portfolio: any;
  positions: any[];
  currentPrices: Record<string, number>;
}

const TradingPortfolioHeader = ({ portfolio, positions, currentPrices }: Props) => {
  const openPositions = positions.filter(p => p.status === 'open');
  const closedPositions = positions.filter(p => p.status === 'closed');
  const realizedPnl = closedPositions.reduce((sum, p) => sum + (parseFloat(p.pnl) || 0), 0);

  // Calculate unrealized PnL from live prices
  let unrealizedPnl = 0;
  let investedAmount = 0;
  for (const pos of openPositions) {
    const cost = parseFloat(pos.entry_price) * parseFloat(pos.quantity);
    investedAmount += cost;
    const livePrice = currentPrices[pos.symbol];
    if (livePrice) {
      const pnl = pos.direction === 'long'
        ? (livePrice - parseFloat(pos.entry_price)) * parseFloat(pos.quantity) * (pos.leverage || 1)
        : (parseFloat(pos.entry_price) - livePrice) * parseFloat(pos.quantity) * (pos.leverage || 1);
      unrealizedPnl += pnl;
    }
  }

  const totalEquity = portfolio.balance + investedAmount + unrealizedPnl;
  const totalPnl = realizedPnl + unrealizedPnl;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Wallet className="w-4 h-4" />
          <span className="text-xs font-medium">Solde disponible</span>
        </div>
        <p className="text-xl font-bold font-mono text-foreground">
          ${portfolio.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <BarChart3 className="w-4 h-4" />
          <span className="text-xs font-medium">Équité totale</span>
        </div>
        <p className="text-xl font-bold font-mono text-foreground">
          ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Activity className="w-4 h-4" />
          <span className="text-xs font-medium">PnL non réalisé</span>
        </div>
        <p className={`text-xl font-bold font-mono ${unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {totalPnl >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
          <span className="text-xs font-medium">PnL total</span>
        </div>
        <p className={`text-xl font-bold font-mono ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-medium">Positions ouvertes</span>
        </div>
        <p className="text-xl font-bold text-foreground">{openPositions.length}</p>
      </div>
    </div>
  );
};

export default TradingPortfolioHeader;
