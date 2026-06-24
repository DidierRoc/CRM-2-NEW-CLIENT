import { AlertTriangle, ShieldCheck, Clock, Lock } from 'lucide-react';

interface ContractSource {
  id: string;
  label: string;
  deposits: number;
  available: number;
  pendingWr: number;
}

interface Props {
  contractSources?: ContractSource[];
}

const WithdrawalInfoBanner = ({ contractSources = [] }: Props) => {
  const lockedSources = contractSources.filter(c => c.deposits > 0 && c.available === 0 && c.pendingWr === 0);

  return (
    <div className="space-y-3">
      {lockedSources.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Fonds temporairement indisponibles</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
              Les fonds investis sur les comptes à terme suivants sont bloqués jusqu'à leur échéance contractuelle :{' '}
              <span className="font-semibold">{lockedSources.map(s => s.label).join(', ')}</span>.
              Aucun retrait anticipé n'est possible avant la date d'échéance prévue au contrat.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30 p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Procédure de vérification réglementaire</p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
            Conformément aux obligations légales en matière de lutte contre le blanchiment de capitaux (AML)
            et aux procédures de connaissance client (KYC), chaque demande de retrait est soumise à une vérification
            avant exécution. Ce processus garantit la sécurité de vos fonds.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-400 font-medium">
              <Clock className="w-3 h-3" /> Délai habituel : 1 à 3 jours ouvrés
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-400 font-medium">
              <AlertTriangle className="w-3 h-3" /> Des justificatifs peuvent être demandés
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalInfoBanner;
