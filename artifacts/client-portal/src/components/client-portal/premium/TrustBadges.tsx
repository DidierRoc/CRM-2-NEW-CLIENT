import { Shield, Lock, FileCheck, Eye } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TrustItem {
  icon: typeof Shield;
  labelFr: string;
  labelEn: string;
}

const ITEMS: TrustItem[] = [
  { icon: Lock, labelFr: 'Chiffrement SSL 256 bits', labelEn: 'SSL 256-bit encryption' },
  { icon: Shield, labelFr: 'Conforme RGPD', labelEn: 'GDPR compliant' },
  { icon: FileCheck, labelFr: 'Signature électronique légale', labelEn: 'Legal e-signature' },
  { icon: Eye, labelFr: 'Historique consultable', labelEn: 'Auditable history' },
];

interface Props {
  variant?: 'inline' | 'card';
}

const TrustBadges = ({ variant = 'card' }: Props) => {
  const { lang } = useLanguage();

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
        {ITEMS.map(({ icon: Icon, labelFr, labelEn }) => (
          <div key={labelFr} className="flex items-center gap-1.5">
            <Icon className="w-3 h-3 text-slate-400" />
            <span>{lang === 'en' ? labelEn : labelFr}</span>
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
            {lang === 'en' ? 'Secure & audited area' : 'Espace sécurisé & audité'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {ITEMS.map(({ icon: Icon, labelFr, labelEn }) => (
            <div key={labelFr} className="flex items-center gap-1.5">
              <Icon className="w-3 h-3 text-slate-400" />
              <span className="text-[11px] text-slate-500">{lang === 'en' ? labelEn : labelFr}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustBadges;
