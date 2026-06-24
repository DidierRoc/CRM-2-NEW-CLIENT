import { Globe, ArrowUpRight, Clock, TrendingUp, ShieldCheck } from 'lucide-react';

interface ContractSource {
  id: string;
  label: string;
  deposits: number;
  interests: number;
  withdrawals: number;
  pendingWr: number;
  available: number;
  rate: number;
}

interface TradingSource {
  id: string;
  initialBalance: number;
  currentBalance: number;
  realizedPnl: number;
  bonus: number;
  pendingWr: number;
  withdrawable: number;
}

interface Props {
  contractSources: ContractSource[];
  tradingSource: TradingSource | null;
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const WithdrawalPortfolio = ({ contractSources, tradingSource }: Props) => {
  const totalAvailable =
    contractSources.reduce((s, c) => s + c.available, 0) + (tradingSource?.withdrawable || 0);
  const totalPendingWr =
    contractSources.reduce((s, c) => s + c.pendingWr, 0) + (tradingSource?.pendingWr || 0);
  const contractsActiveCapital = contractSources.reduce(
    (s, c) => s + Math.max(0, c.deposits - c.withdrawals),
    0,
  );
  const tradingActiveCapital = tradingSource?.currentBalance ?? 0;
  const totalInvested = contractsActiveCapital + tradingActiveCapital;
  const totalGlobal =
    contractSources.reduce((s, c) => s + Math.max(0, c.deposits + c.interests - c.withdrawals), 0) +
    tradingActiveCapital;

  const metrics = [
    {
      label: 'Solde disponible',
      value: totalAvailable,
      icon: ArrowUpRight,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      valueColor: 'text-emerald-300',
    },
    {
      label: 'Capital investi',
      value: totalInvested,
      icon: TrendingUp,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      valueColor: 'text-blue-300',
    },
    {
      label: 'En cours de traitement',
      value: totalPendingWr,
      icon: Clock,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      valueColor: 'text-amber-300',
    },
    {
      label: 'Patrimoine total',
      value: totalGlobal,
      icon: Globe,
      iconBg: 'bg-[#c9a84c]/20',
      iconColor: 'text-[#c9a84c]',
      valueColor: 'text-[#f0d080]',
    },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-xl"
      style={{ background: 'linear-gradient(135deg, #111111 0%, #cc0000 100%)' }}
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Globe className="w-4 h-4 text-white/70" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Vue d'ensemble du compte</h2>
            <p className="text-white/40 text-[11px]">Données calculées en temps réel</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map(({ label, value, icon: Icon, iconBg, iconColor, valueColor }) => (
            <div key={label} className="space-y-3">
              <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div>
                <p className={`text-xl sm:text-2xl font-black ${valueColor} leading-none tabular-nums`}>
                  {fmt(value)}
                </p>
                <p className="text-white/50 text-xs mt-1.5 font-medium leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-black/20 border-t border-white/10 px-6 sm:px-8 py-3 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
        <span className="text-white/40 text-[11px]">
          Vos fonds sont sécurisés · Toute demande est soumise à la procédure de conformité (KYC/AML)
        </span>
      </div>
    </div>
  );
};

export default WithdrawalPortfolio;
