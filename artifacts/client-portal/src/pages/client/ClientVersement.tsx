import { useState, useRef, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, Copy, Check, Upload, Loader2,
  CreditCard, CheckCircle, FileText, Info, Landmark,
  ShieldCheck, ChevronRight, Clock, Banknote, PartyPopper,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/crmSupabaseClient';
import { callCrmApi } from '@/lib/crmApi';
import { useCompanySignature } from '@/hooks/useCompanySignature';
import { useClientContracts, getLatestClientContract } from '@/hooks/useClientData';

// ── helpers ──────────────────────────────────────────────────────

function formatIban(iban: string) {
  return iban.replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') ?? iban;
}

function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text.replace(/\s/g, '')).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);
  return { copied, copy };
}

// ── bank settings hook ─────────────────────────────────────────

interface BankSettings {
  beneficiary: string;
  iban: string;
  bic: string;
  bankName: string;
  bankAddress: string;
}

function useBankSettings(companyName: string) {
  return useQuery<BankSettings>({
    queryKey: ['company-bank-settings'],
    queryFn: async () => {
      // Try company_settings table first (where contract placeholders are stored)
      const { data } = await supabase
        .from('company_settings' as any)
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        const d = data as any;
        const iban =
          d.bank_iban || d.banque_iban || d.iban || d.bank_account_iban || '';
        const bic =
          d.bank_bic || d.banque_bic || d.bic || d.bank_bic_swift || d.swift || '';
        const bankName =
          d.bank_nom || d.banque_nom || d.bank_name || d.nom_banque || '';
        const beneficiary =
          d.bank_beneficiary || d.beneficiaire || d.beneficiary || d.titulaire || companyName || '';
        const bankAddress =
          d.bank_address || d.banque_adresse || d.bank_adresse || '';

        if (iban || bic || bankName) {
          return { beneficiary, iban, bic, bankName, bankAddress };
        }
      }

      // Fallback: try public-branding for extended bank fields
      const branding = await callCrmApi('public-branding');
      if (branding) {
        const b = branding as any;
        return {
          beneficiary: b.bank_beneficiary || b.beneficiaire || companyName || '',
          iban: b.bank_iban || b.banque_iban || '',
          bic: b.bank_bic || b.banque_bic || '',
          bankName: b.bank_nom || b.banque_nom || '',
          bankAddress: b.bank_address || '',
        };
      }

      return { beneficiary: companyName || '', iban: '', bic: '', bankName: '', bankAddress: '' };
    },
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

// ── Copy button ────────────────────────────────────────────────

function CopyButton({
  value, label, copied, onCopy,
}: { value: string; label: string; copied: boolean; onCopy: () => void }) {
  return (
    <button
      onClick={onCopy}
      disabled={!value}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
        copied
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
          : 'bg-[#111111]/8 text-[#111111] hover:bg-[#111111]/16 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copié !' : `Copier ${label}`}
    </button>
  );
}

// ── Upload proof for a subscription ───────────────────────────

function UploadProof({
  subId, leadId, subName,
}: { subId: string; leadId: string; subName: string }) {
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${leadId}/preuve-virement-${subId.slice(0, 8)}.${ext}`;
      const { error } = await supabase.storage.from('lead-documents').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('lead-documents').getPublicUrl(path);
      await supabase.from('documents').insert({
        lead_id: leadId,
        nom: `Preuve de virement — ${subName}`,
        type: 'virement',
        url: urlData.publicUrl || path,
      });
      toast.success('Preuve de virement envoyée ! Votre conseiller validera sous 48h.');
      setDone(true);
    } catch {
      toast.error("Erreur lors de l'envoi. Réessayez ou contactez votre conseiller.");
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-3">
        <CheckCircle className="w-4 h-4 shrink-0" />
        Preuve envoyée — votre conseiller va valider votre versement.
      </div>
    );
  }

  return (
    <>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFile} />
      <button
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#cc0000] disabled:opacity-60 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Envoi en cours…</>
        ) : (
          <><Upload className="w-4 h-4" />J'ai effectué mon virement</>
        )}
      </button>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function ClientVersement() {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const navigate = useNavigate();
  const leadId = clientAccount?.lead_id;
  const { copied, copy } = useCopyToClipboard();
  const { branding } = useCompanySignature();
  const { data: allSubs, isLoading } = useClientContracts(leadId);
  const { data: bank, isLoading: bankLoading } = useBankSettings(branding.companyName);

  const pendingPaymentSubs = (allSubs || []).filter((s: any) =>
    ['pending_payment', 'signed'].includes(s.status) &&
    !(s.client_transactions || []).some((t: any) => t.type === 'deposit' && t.status === 'confirmed')
  );

  const hasBank = !!(bank?.iban || bank?.bic || bank?.bankName);

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080808] via-[#111111] to-[#0A0A0A] p-6 md:p-8 text-white shadow-xl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-[#c9a84c]/10 blur-2xl" />
          <div className="absolute top-1/2 right-1/4 w-0.5 h-16 bg-white/10 rotate-45" />
          <div className="absolute top-1/3 right-1/3 w-0.5 h-10 bg-white/10 rotate-12" />
        </div>

        <button
          onClick={() => navigate(-1)}
          className="relative inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-medium mb-5 transition-colors duration-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <CreditCard className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#c9a84c]" />
              <span className="text-[10px] text-white/60 uppercase tracking-[0.2em] font-semibold">Espace sécurisé</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Effectuer un versement
            </h1>
            <p className="text-sm text-white/60 mt-1">
              Transférez vos fonds sur le compte indiqué ci-dessous pour activer votre investissement.
            </p>
          </div>
        </div>
      </div>

      {/* ── No pending subs ──────────────────────────────────── */}
      {!isLoading && pendingPaymentSubs.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Aucun versement en attente</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed mb-5">
            Tous vos contrats sont à jour. Si vous souhaitez souscrire à un nouveau placement, découvrez nos produits disponibles.
          </p>
          <button
            onClick={() => navigate('/client/products')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#cc0000] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Découvrir nos placements <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Pending subs ─────────────────────────────────────── */}
      {(isLoading || pendingPaymentSubs.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-[0.12em]">
              {isLoading ? 'Versements en attente' : `${pendingPaymentSubs.length} versement${pendingPaymentSubs.length > 1 ? 's' : ''} en attente`}
            </h2>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-border/60 bg-card p-6 animate-pulse">
              <div className="h-5 bg-muted rounded w-48 mb-3" />
              <div className="h-4 bg-muted rounded w-32" />
            </div>
          ) : (
            pendingPaymentSubs.map((sub: any) => {
              const contract = getLatestClientContract(sub.client_contracts) as any;
              const ref = contract?.reference || `CONT-${sub.id.slice(0, 8).toUpperCase()}`;
              const amount = Number(sub.amount) || 0;
              const productName = sub.products?.nom || sub.custom_name || 'Contrat';

              return (
                <div key={sub.id} className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20 shadow-sm overflow-hidden">

                  {/* Top banner */}
                  <div className="flex items-start gap-4 p-5">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                      <PartyPopper className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-foreground">{productName}</h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-800 dark:bg-amber-900/60 dark:text-amber-400 uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          En attente de versement
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Contrat signé le {new Date(contract?.signed_at || sub.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-foreground tabular-nums">
                        {amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">à virer</p>
                    </div>
                  </div>

                  {/* Reference highlight */}
                  <div className="mx-5 mb-4 rounded-xl bg-white dark:bg-slate-800 border border-[#111111]/12 dark:border-slate-700 p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.18em] font-semibold mb-1">
                          Référence à indiquer dans le motif du virement
                        </p>
                        <p className="font-mono font-bold text-lg text-[#111111] dark:text-white tracking-widest">
                          {ref}
                        </p>
                      </div>
                      <CopyButton
                        value={ref}
                        label="la référence"
                        copied={copied === `ref-${sub.id}`}
                        onCopy={() => copy(ref, `ref-${sub.id}`)}
                      />
                    </div>
                    <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border/40">
                      <Info className="w-3.5 h-3.5 text-[#E60000] shrink-0 mt-0.5" />
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Cette référence est <strong className="text-foreground">obligatoire</strong> dans le champ "Motif / Communication" de votre virement afin que nous puissions identifier votre paiement et activer votre investissement rapidement.
                      </p>
                    </div>
                  </div>

                  {/* Upload proof */}
                  <div className="px-5 pb-5">
                    <UploadProof subId={sub.id} leadId={leadId} subName={productName} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Bank coordinates ──────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">

        {/* Card header */}
        <div className="bg-gradient-to-br from-[#111111]/6 to-transparent px-6 py-5 border-b border-border/60 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#111111]/10 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5 text-[#111111] dark:text-slate-300" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Coordonnées bancaires</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Effectuez votre virement sur ce compte
            </p>
          </div>
        </div>

        {/* Bank fields */}
        <div className="p-6 space-y-4">
          {bankLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-muted/60 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !hasBank ? (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-4">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Coordonnées non encore configurées</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Les coordonnées bancaires n'ont pas encore été renseignées par votre conseiller. Contactez-le directement pour obtenir les informations de virement.
                </p>
                <button
                  onClick={() => navigate('/client/help')}
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#E60000] hover:underline"
                >
                  Contacter mon conseiller <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {[
                {
                  key: 'beneficiary',
                  label: 'Bénéficiaire',
                  value: bank?.beneficiary || branding.companyName,
                  display: bank?.beneficiary || branding.companyName,
                  mono: false,
                  icon: Building2,
                },
                {
                  key: 'iban',
                  label: 'IBAN',
                  value: bank?.iban || '',
                  display: bank?.iban ? formatIban(bank.iban) : '',
                  mono: true,
                  icon: CreditCard,
                },
                {
                  key: 'bic',
                  label: 'BIC / SWIFT',
                  value: bank?.bic || '',
                  display: bank?.bic || '',
                  mono: true,
                  icon: Banknote,
                },
                ...(bank?.bankName ? [{
                  key: 'bankName',
                  label: 'Banque',
                  value: bank.bankName,
                  display: bank.bankName,
                  mono: false,
                  icon: Landmark,
                }] : []),
                ...(bank?.bankAddress ? [{
                  key: 'bankAddress',
                  label: 'Adresse de la banque',
                  value: bank.bankAddress,
                  display: bank.bankAddress,
                  mono: false,
                  icon: FileText,
                }] : []),
              ].map(({ key, label, value, display, mono, icon: Icon }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 dark:bg-slate-800/60 border border-border/50 px-4 py-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#111111]/8 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-[#111111] dark:text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">{label}</p>
                      <p className={`text-sm font-bold text-foreground truncate ${mono ? 'font-mono tracking-wider' : ''}`}>
                        {display || <span className="text-muted-foreground font-normal italic">Non renseigné</span>}
                      </p>
                    </div>
                  </div>
                  {value && (
                    <CopyButton
                      value={value}
                      label={label.toLowerCase()}
                      copied={copied === key}
                      onCopy={() => copy(value, key)}
                    />
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Step-by-step instructions ─────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-[#E60000]/6 to-transparent px-6 py-5 border-b border-border/60 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#E60000]/10 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-[#E60000]" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Comment effectuer votre virement</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Suivez ces étapes pour finaliser votre investissement</p>
          </div>
        </div>

        <div className="p-6">
          <ol className="space-y-4">
            {[
              {
                n: '1',
                title: 'Connectez-vous à votre banque',
                desc: 'Accédez à votre espace bancaire en ligne ou rendez-vous en agence pour effectuer un virement.',
                color: 'bg-[#E60000]',
              },
              {
                n: '2',
                title: 'Saisissez les coordonnées ci-dessus',
                desc: 'Renseignez l\'IBAN, le BIC et le nom du bénéficiaire exactement comme indiqué. Utilisez les boutons "Copier" pour éviter toute erreur.',
                color: 'bg-[#E60000]',
              },
              {
                n: '3',
                title: 'Indiquez la référence dans le motif',
                desc: 'Ce champ est indispensable. Sans référence, votre virement ne pourra pas être rattaché automatiquement à votre contrat.',
                color: 'bg-[#c9a84c]',
                highlight: true,
              },
              {
                n: '4',
                title: 'Envoyez votre preuve de virement',
                desc: 'Une fois le virement effectué, uploadez votre capture d\'écran ou relevé via le bouton "J\'ai effectué mon virement" ci-dessus. Votre conseiller validera sous 48h.',
                color: 'bg-emerald-600',
              },
            ].map(({ n, title, desc, color, highlight }) => (
              <li key={n} className={`flex gap-4 ${highlight ? 'relative' : ''}`}>
                {highlight && (
                  <div className="absolute -inset-3 rounded-xl bg-[#c9a84c]/8 dark:bg-[#c9a84c]/5 border border-[#c9a84c]/20 pointer-events-none" />
                )}
                <div className={`relative w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm`}>
                  {n}
                </div>
                <div className="relative pt-0.5">
                  <p className={`text-sm font-bold text-foreground mb-0.5 ${highlight ? 'text-[#a07828] dark:text-[#c9a84c]' : ''}`}>{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Security note ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-2xl bg-muted/40 border border-border/50 px-5 py-4">
        <ShieldCheck className="w-4 h-4 text-[#E60000] shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Sécurité :</strong> {branding.companyName || 'Notre société'} ne vous demandera jamais vos identifiants bancaires ni de modifier les coordonnées de virement par e-mail ou SMS. En cas de doute, contactez directement votre conseiller.
        </p>
      </div>

    </div>
  );
}
