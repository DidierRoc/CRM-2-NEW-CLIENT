import { useState } from 'react';
import { callCrmApi } from '@/lib/crmApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertCircle, Wallet, CreditCard, ShieldCheck, ArrowRight, ArrowLeft, Check,
  Loader2, Send, Clock, CheckCircle2, Landmark, BadgeCheck, Euro, Building2,
  FileText, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { track } from '@/lib/clientTracking';
import { logConnection } from '@/lib/connectionLog';

interface ContractSource {
  id: string;
  label: string;
  available: number;
}

interface TradingSource {
  id: string;
  withdrawable: number;
}

interface BankAccount {
  id: string;
  nom_banque: string;
  iban: string;
  titulaire?: string;
  bic?: string;
}

interface Props {
  leadId: string;
  clientAccountId?: string;
  contractSources: ContractSource[];
  tradingSource: TradingSource | null;
  bankAccounts: BankAccount[];
  portfolioId?: string;
  onSuccess: () => void;
}

// Process steps shown on the landing screen
const PROCESS_STEPS = [
  { num: 1, label: 'Demande envoyée', desc: 'Votre demande est transmise', icon: Send },
  { num: 2, label: 'Vérification', desc: 'Contrôle KYC / AML', icon: ShieldCheck },
  { num: 3, label: 'Validation bancaire', desc: 'Autorisation de virement', icon: Landmark },
  { num: 4, label: 'Virement en cours', desc: 'Transfert initié', icon: ArrowRight },
  { num: 5, label: 'Fonds crédités', desc: 'Disponibles sur votre compte', icon: CheckCircle2 },
];

// Form steps
const FORM_STEPS = [
  { title: 'Montant & Source', icon: Wallet },
  { title: 'Compte bancaire', icon: CreditCard },
  { title: 'Confirmation', icon: ShieldCheck },
];

interface UnifiedSource {
  key: string;
  type: 'contract' | 'trading';
  id: string;
  label: string;
  available: number;
}

const formatIban = (iban: string) => {
  const clean = iban.replace(/\s/g, '');
  const groups = [];
  for (let i = 0; i < clean.length; i += 4) groups.push(clean.slice(i, i + 4));
  return groups.join(' ');
};

const maskIban = (iban: string) => {
  const clean = iban.replace(/\s/g, '');
  return `•••• •••• •••• ${clean.slice(-4)}`;
};

const getEstimatedDate = () => {
  const d = new Date();
  let businessDays = 0;
  while (businessDays < 3) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) businessDays++;
  }
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const WithdrawalStepper = ({ leadId, clientAccountId, contractSources, tradingSource, bankAccounts, portfolioId, onSuccess }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [selectedKey, setSelectedKey] = useState('');
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const allSources: UnifiedSource[] = [
    ...contractSources.map(cs => ({
      key: `contract-${cs.id}`,
      type: 'contract' as const,
      id: cs.id,
      label: cs.label,
      available: cs.available,
    })),
    ...(tradingSource ? [{
      key: `trading-${tradingSource.id}`,
      type: 'trading' as const,
      id: tradingSource.id,
      label: 'Portefeuille Trading',
      available: tradingSource.withdrawable,
    }] : []),
  ];

  const selected = allSources.find(s => s.key === selectedKey) ?? null;
  const source = selected?.type ?? '';
  const sourceId = selected?.id ?? '';
  const maxAmount = selected?.available ?? 0;

  const selectedBank = bankAccounts.find(b => b.id === bankAccountId);
  const parsedAmount = parseFloat(amount) || 0;

  const canGoStep1 = !!selected && parsedAmount > 0 && parsedAmount <= maxAmount;
  const canGoStep2 = canGoStep1 && !!bankAccountId;

  const handleSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    track('withdrawal_submit', { amount: parsedAmount, source, sourceId: source === 'contract' ? sourceId : portfolioId });
    try {
      await callCrmApi('client-self-service', 'create-withdrawal', {
        amount: parsedAmount,
        source,
        sourceId: source === 'contract' ? sourceId : (portfolioId ?? sourceId),
        bankAccountId,
        reason: reason || null,
      });
      toast.success('Demande de retrait envoyée avec succès');
      logConnection(clientAccountId, 'withdrawal_request', `Montant : ${parsedAmount} €`);
      setShowForm(false);
      setFormStep(0);
      setSelectedKey('');
      setAmount('');
      setBankAccountId('');
      setReason('');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la demande de retrait');
    }
    setSubmitting(false);
  };

  const hasAnySources = contractSources.length > 0 || tradingSource;

  if (!hasAnySources) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6 text-muted-foreground/40" />
        </div>
        <p className="font-semibold text-foreground">Aucun investissement actif</p>
        <p className="text-sm text-muted-foreground mt-1">Vous n'avez pas de fonds disponibles pour effectuer un retrait.</p>
      </div>
    );
  }

  // ── Landing screen ──
  if (!showForm) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 sm:px-8 py-6 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">Nouvelle demande de retrait</h2>
              <p className="text-sm text-muted-foreground">Traitement sous 1 à 3 jours ouvrés</p>
            </div>
          </div>
        </div>

        {/* 5-step process */}
        <div className="px-6 sm:px-8 py-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">Comment ça fonctionne</p>
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {PROCESS_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="flex items-start flex-1 min-w-[100px]">
                  <div className="flex flex-col items-center flex-1">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20 flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="mt-3 text-center px-1">
                      <p className="text-xs font-bold text-foreground leading-tight">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{step.desc}</p>
                    </div>
                  </div>
                  {i < PROCESS_STEPS.length - 1 && (
                    <div className="h-0.5 bg-border flex-shrink-0 w-4 mt-5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Delay info */}
        <div className="mx-6 sm:mx-8 mb-6 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/60 p-4 flex items-start gap-3">
          <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Délais habituels :</span>{' '}
            Les demandes reçues avant 12h00 sont traitées le jour même. Le virement est généralement crédité sous{' '}
            <span className="font-semibold text-foreground">1 à 3 jours ouvrés</span> après validation.
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 sm:px-8 pb-8 flex justify-center">
          <Button
            onClick={() => setShowForm(true)}
            size="lg"
            className="px-10 rounded-xl font-semibold"
            style={{ background: '#0f2347' }}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Effectuer un retrait
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Form stepper ── */}
      <div className="space-y-5">
        {/* Step indicator */}
        <div className="flex items-center">
          {FORM_STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === formStep;
            const isDone = i < formStep;
            return (
              <div key={i} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isDone ? 'bg-primary border-primary text-primary-foreground' :
                    isActive ? 'border-primary text-primary bg-primary/5' :
                    'border-border text-muted-foreground bg-card'
                  }`}>
                    {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-4.5 h-4.5" />}
                  </div>
                  <p className={`text-xs mt-2 font-medium text-center ${isActive ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.title}
                  </p>
                </div>
                {i < FORM_STEPS.length - 1 && (
                  <div className={`h-0.5 w-full mx-2 mt-[-20px] rounded-full transition-all ${i < formStep ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {/* ── Step 0: Montant & Source ── */}
          {formStep === 0 && (
            <div className="p-6 space-y-5">
              <div className="space-y-1">
                <h3 className="font-bold text-foreground">Montant & Source</h3>
                <p className="text-sm text-muted-foreground">Sélectionnez le placement source et le montant souhaité.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Placement source</Label>
                <Select value={selectedKey} onValueChange={(v) => { setSelectedKey(v); setAmount(''); }}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Choisir un placement" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSources.map(s => (
                      <SelectItem key={s.key} value={s.key}>
                        <div className="flex items-center justify-between gap-4">
                          <span>{s.label}</span>
                          <span className="text-muted-foreground font-medium">
                            {s.available.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € dispo.
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selected && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-4 flex items-center justify-between">
                  <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Solde disponible</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {maxAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Montant du retrait (€)</Label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number" min="0" max={maxAmount} step="0.01"
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder={maxAmount > 0 ? maxAmount.toFixed(2) : '0.00'}
                    disabled={!selected}
                    className="pl-9 h-11 rounded-xl text-base font-semibold"
                  />
                </div>
                {maxAmount > 0 && (
                  <button type="button" className="text-xs text-primary hover:underline font-medium" onClick={() => setAmount(maxAmount.toFixed(2))}>
                    Retirer le montant maximum ({maxAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €)
                  </button>
                )}
                {parsedAmount > maxAmount && maxAmount > 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Le montant dépasse le solde disponible.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Motif du retrait <span className="text-muted-foreground font-normal">(optionnel)</span>
                </Label>
                <Textarea
                  value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex : Achat immobilier, dépenses personnelles…"
                  rows={2}
                  className="rounded-xl resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 1: Compte bancaire ── */}
          {formStep === 1 && (
            <div className="p-6 space-y-5">
              <div className="space-y-1">
                <h3 className="font-bold text-foreground">Compte bancaire de réception</h3>
                <p className="text-sm text-muted-foreground">Sélectionnez le compte sur lequel virer les fonds.</p>
              </div>

              {bankAccounts.length === 0 ? (
                <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                  <p className="text-sm text-destructive">
                    Aucun compte bancaire enregistré. Veuillez en ajouter un dans votre profil avant d'effectuer un retrait.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bankAccounts.map(ba => (
                    <button
                      key={ba.id}
                      type="button"
                      onClick={() => setBankAccountId(ba.id)}
                      className={`w-full rounded-xl border p-4 text-left transition-all ${
                        bankAccountId === ba.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border/60 bg-card hover:border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bankAccountId === ba.id ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Building2 className={`w-5 h-5 ${bankAccountId === ba.id ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm">{ba.nom_banque}</p>
                          {ba.titulaire && (
                            <p className="text-xs text-muted-foreground">{ba.titulaire}</p>
                          )}
                          <p className="font-mono text-sm text-muted-foreground mt-0.5">{maskIban(ba.iban)}</p>
                        </div>
                        {bankAccountId === ba.id && (
                          <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="rounded-xl bg-muted/40 border border-border/60 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Récapitulatif</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Placement</span>
                    <span className="font-medium text-foreground">{selected?.label ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant demandé</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {parsedAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Confirmation ── */}
          {formStep === 2 && (
            <div className="p-6 space-y-5">
              <div className="space-y-1">
                <h3 className="font-bold text-foreground">Vérification de votre demande</h3>
                <p className="text-sm text-muted-foreground">Vérifiez les informations avant de soumettre.</p>
              </div>

              {/* Amount breakdown */}
              <div className="rounded-2xl overflow-hidden border border-border/60">
                <div className="bg-muted/40 px-5 py-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Détail de l'opération</span>
                </div>
                <div className="p-5 space-y-3 text-sm bg-card">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Montant demandé</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {parsedAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Frais de virement</span>
                    <span className="font-semibold text-emerald-600">0,00 €</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">Montant effectivement viré</span>
                    <span className="text-xl font-black text-foreground tabular-nums">
                      {parsedAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
              </div>

              {/* Destination account */}
              {selectedBank && (
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">IBAN destinataire</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{selectedBank.nom_banque}</p>
                      <p className="font-mono text-sm text-muted-foreground mt-0.5 break-all">
                        {formatIban(selectedBank.iban)}
                      </p>
                      {selectedBank.titulaire && (
                        <p className="text-xs text-muted-foreground mt-0.5">Titulaire : {selectedBank.titulaire}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Estimated date */}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-4 flex items-start gap-3">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-blue-800 dark:text-blue-300">Date estimée de réception :</span>
                  <span className="text-blue-700 dark:text-blue-400"> {getEstimatedDate()}</span>
                  <p className="text-blue-600/80 dark:text-blue-400/70 text-xs mt-0.5">
                    Sous réserve de validation par notre équipe de conformité.
                  </p>
                </div>
              </div>

              {/* KYC notice */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Conformément aux obligations réglementaires (KYC/AML), votre demande sera soumise à une procédure
                  de vérification avant exécution. Des justificatifs complémentaires peuvent être requis par notre
                  service de conformité.
                </p>
              </div>

              {reason && (
                <div className="text-sm flex justify-between">
                  <span className="text-muted-foreground">Motif déclaré</span>
                  <span className="font-medium text-foreground italic">{reason}</span>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="px-6 pb-6 flex items-center justify-between border-t border-border/60 pt-4">
            <Button
              variant="outline"
              onClick={() => { if (formStep === 0) setShowForm(false); else setFormStep(s => s - 1); }}
              className="rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>

            {formStep < 2 ? (
              <Button
                onClick={() => setFormStep(s => s + 1)}
                disabled={formStep === 0 ? !canGoStep1 : !canGoStep2}
                className="rounded-xl"
              >
                Continuer
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={submitting}
                className="rounded-xl font-semibold"
                style={{ background: '#0f2347' }}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traitement…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-2" />Soumettre la demande</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirmation Dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Confirmer le retrait
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de soumettre une demande de retrait définitive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-muted/50 border border-border/60 p-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-black text-foreground text-base tabular-nums">
                  {parsedAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Placement</span>
                <span className="font-medium text-foreground">{selected?.label}</span>
              </div>
              {selectedBank && (
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Vers</span>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{selectedBank.nom_banque}</p>
                    <p className="font-mono text-xs text-muted-foreground">{maskIban(selectedBank.iban)}</p>
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Délai estimé</span>
                <span className="font-medium text-foreground">1 à 3 jours ouvrés</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Cette action est irréversible. La demande sera transmise à votre conseiller
              pour validation et exécution.
            </p>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl">
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl font-semibold"
                style={{ background: '#0f2347' }}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi…</>
                ) : (
                  <><BadgeCheck className="w-4 h-4 mr-2" />Confirmer</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WithdrawalStepper;
