import { CheckCircle2, FileText, BadgePercent, Clock } from 'lucide-react';

interface Props {
  activeContracts: number;
  averageRate: number;
  nextMaturityMonths?: number | null;
}

const TransparencyCard = ({ activeContracts, averageRate, nextMaturityMonths }: Props) => {
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const items = [
    {
      icon: FileText,
      label: 'Contrats actifs',
      value: `${activeContracts}`,
      hint: 'signés et conservés',
    },
    {
      icon: BadgePercent,
      label: 'Taux moyen',
      value: averageRate > 0 ? `${averageRate.toFixed(2)}%` : '—',
      hint: 'rémunération annuelle',
    },
    {
      icon: Clock,
      label: 'Prochaine échéance',
      value: nextMaturityMonths != null && nextMaturityMonths > 0 ? `${nextMaturityMonths} mois` : '—',
      hint: 'visible à tout moment',
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800">Transparence totale</h3>
            <p className="text-[11px] text-slate-500">
              Tous vos engagements et taux contractuels sont consultables à tout moment.
            </p>
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Mis à jour le {today}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map(({ icon: Icon, label, value, hint }) => (
          <div
            key={label}
            className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100"
          >
            <Icon className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{label}</p>
              <p className="text-base font-bold text-slate-800 leading-tight mt-0.5">{value}</p>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransparencyCard;
