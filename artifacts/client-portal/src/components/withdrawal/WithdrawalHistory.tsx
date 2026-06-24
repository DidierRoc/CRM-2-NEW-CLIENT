import { useState } from 'react';
import { Clock, CheckCircle2, XCircle, Banknote, FileText, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WithdrawalRequest {
  id: string;
  source: string;
  amount: number;
  status: string;
  reason?: string | null;
  admin_note?: string | null;
  created_at: string;
  processed_at?: string | null;
  client_bank_accounts?: {
    iban: string;
    nom_banque: string;
    titulaire: string;
  } | null;
}

interface Props {
  requests: WithdrawalRequest[];
}

const statusConfig: Record<string, {
  label: string;
  icon: any;
  pill: string;
  pillText: string;
  dot: string;
  stepActive: number;
}> = {
  pending: {
    label: 'En attente',
    icon: Clock,
    dot: 'bg-amber-400',
    pill: 'bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/50',
    pillText: 'text-amber-700 dark:text-amber-400',
    stepActive: 0,
  },
  approved: {
    label: 'Vérification',
    icon: CheckCircle2,
    dot: 'bg-blue-400',
    pill: 'bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/50',
    pillText: 'text-blue-700 dark:text-blue-400',
    stepActive: 2,
  },
  processed: {
    label: 'Fonds crédités',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/50',
    pillText: 'text-emerald-700 dark:text-emerald-400',
    stepActive: 4,
  },
  rejected: {
    label: 'Refusé',
    icon: XCircle,
    dot: 'bg-red-400',
    pill: 'bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800/50',
    pillText: 'text-red-700 dark:text-red-400',
    stepActive: -1,
  },
};

const STEPS = ['Demande', 'Vérification', 'Validation bancaire', 'Virement', 'Fonds crédités'];

const formatIban = (iban: string) => {
  const clean = iban.replace(/\s/g, '');
  return `•••• •••• •••• ${clean.slice(-4)}`;
};

const shortRef = (id: string) => id.slice(0, 8).toUpperCase();

const WithdrawalHistory = ({ requests }: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <FileText className="w-6 h-6 text-muted-foreground/40" />
        </div>
        <p className="font-semibold text-foreground">Aucun retrait effectué</p>
        <p className="text-sm text-muted-foreground mt-1">Vos demandes de retrait apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table header */}
      <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_40px] gap-4 px-4 pb-2 border-b border-border/60">
        {['Date', 'Référence', 'Montant', 'Compte bénéficiaire', 'Statut', ''].map(h => (
          <p key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</p>
        ))}
      </div>

      {requests.map((wr) => {
        const cfg = statusConfig[wr.status] || statusConfig.pending;
        const Icon = cfg.icon;
        const bank = wr.client_bank_accounts;
        const isExpanded = expandedId === wr.id;

        return (
          <div
            key={wr.id}
            className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm transition-all duration-200"
          >
            {/* Main row */}
            <button
              className="w-full text-left"
              onClick={() => setExpandedId(isExpanded ? null : wr.id)}
            >
              <div className="p-4 md:p-0">
                {/* Mobile layout */}
                <div className="flex items-center justify-between md:hidden">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Banknote className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        − {Number(wr.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(wr.created_at), 'dd MMM yyyy', { locale: fr })}
                        {' · '}
                        <span className="font-mono">{shortRef(wr.id)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.pill} ${cfg.pillText}`}>
                      <Icon className="w-3 h-3" />{cfg.label}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Desktop table row */}
                <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_40px] gap-4 items-center px-4 py-3.5">
                  <p className="text-sm text-foreground">
                    {format(new Date(wr.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-sm font-mono text-muted-foreground tracking-wider">{shortRef(wr.id)}</p>
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    − {Number(wr.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </p>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {bank ? (
                      <>
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">{bank.nom_banque}</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground/50">—</span>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold w-fit ${cfg.pill} ${cfg.pillText}`}>
                    <Icon className="w-3 h-3" />{cfg.label}
                  </span>
                  <div className="flex justify-center">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-border/60 bg-muted/30 p-4 space-y-4">
                {/* 5-step progress */}
                {wr.status !== 'rejected' && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Progression</p>
                    <div className="flex items-center gap-0">
                      {STEPS.map((step, i) => {
                        const active = cfg.stepActive;
                        const isDone = i <= active;
                        const isCurrent = i === active;
                        return (
                          <div key={step} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-all ${
                                isDone
                                  ? 'bg-emerald-500 text-white'
                                  : isCurrent
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted border border-border text-muted-foreground'
                              }`}>
                                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                              </div>
                              <p className={`text-[9px] mt-1 text-center leading-tight max-w-[60px] ${isDone || isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                {step}
                              </p>
                            </div>
                            {i < STEPS.length - 1 && (
                              <div className={`flex-1 h-0.5 mb-4 ${i < active ? 'bg-emerald-500' : 'bg-border'}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-card rounded-xl border border-border/60 p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Référence opération</p>
                    <p className="font-mono text-foreground font-semibold tracking-wider">{wr.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="bg-card rounded-xl border border-border/60 p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Source</p>
                    <p className="text-foreground font-medium">{wr.source === 'trading' ? 'Compte Trading' : 'Contrat d\'investissement'}</p>
                  </div>
                  {bank && (
                    <div className="bg-card rounded-xl border border-border/60 p-3 space-y-1 sm:col-span-2">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Compte bénéficiaire</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{bank.nom_banque}</span>
                        {bank.iban && (
                          <span className="text-muted-foreground font-mono text-sm">· {formatIban(bank.iban)}</span>
                        )}
                      </div>
                      {bank.titulaire && (
                        <p className="text-muted-foreground text-xs">Titulaire : {bank.titulaire}</p>
                      )}
                    </div>
                  )}
                  {wr.reason && (
                    <div className="bg-card rounded-xl border border-border/60 p-3 space-y-1 sm:col-span-2">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Motif déclaré</p>
                      <p className="text-foreground">{wr.reason}</p>
                    </div>
                  )}
                  {wr.admin_note && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50 p-3 space-y-1 sm:col-span-2">
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wider">Note de votre conseiller</p>
                      <p className="text-amber-800 dark:text-amber-300">{wr.admin_note}</p>
                    </div>
                  )}
                  {wr.processed_at && (
                    <div className="bg-card rounded-xl border border-border/60 p-3 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Traité le</p>
                      <p className="text-foreground font-medium">
                        {format(new Date(wr.processed_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WithdrawalHistory;
