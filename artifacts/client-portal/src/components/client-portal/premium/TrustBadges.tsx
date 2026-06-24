import { Shield, Lock, FileCheck, Eye } from 'lucide-react';

interface TrustItem {
  icon: typeof Shield;
  label: string;
}

const ITEMS: TrustItem[] = [
  { icon: Lock, label: 'Chiffrement SSL 256 bits' },
  { icon: Shield, label: 'Conforme RGPD' },
  { icon: FileCheck, label: 'Signature électronique légale' },
  { icon: Eye, label: 'Historique consultable' },
];

interface Props {
  variant?: 'inline' | 'card';
}

const TrustBadges = ({ variant = 'card' }: Props) => {
  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
        {ITEMS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className="w-3 h-3 text-slate-400" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-medium text-slate-600">
            Espace sécurisé & audité
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon className="w-3 h-3 text-slate-400" />
              <span className="text-[11px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustBadges;
