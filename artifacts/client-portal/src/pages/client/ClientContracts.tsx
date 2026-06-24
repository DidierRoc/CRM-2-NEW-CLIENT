import { useState, useRef, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/crmSupabaseClient';
import { callCrmApi } from '@/lib/crmApi';
import {
  FileText, Clock, CheckCircle, AlertCircle, Eye, Banknote, PartyPopper,
  Upload, Loader2, Download, Search, Filter, TrendingUp, Calendar,
  ShieldCheck, ChevronRight, X, PenLine, ArrowRight, Wallet, BarChart3,
} from 'lucide-react';
import { logConnection } from '@/lib/connectionLog';
import { downloadContractWithToast } from '@/lib/downloadContract';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ContractHtmlFrame from '@/components/client-portal/ContractHtmlFrame';
import ContractSchedule from '@/components/contracts/ContractSchedule';
import { getLatestClientContract, useClientContracts, useClientProfile } from '@/hooks/useClientData';
import { ClientRowsSkeleton } from '@/components/client-portal/ClientPageFallback';
import { useCompanySignature } from '@/hooks/useCompanySignature';
import { appendSignatureBlockToHtml, renderContractHtml } from '@/lib/contractRendering';

/**
 * Résout la durée en mois depuis toutes les sources possibles :
 *  - champ numérique sub.duration_months / contract.duration_months
 *  - chaîne produit : "60 mois", "5 ans", "60", etc.
 */
function parseDuration(
  subMonths: number | null | undefined,
  contractMonths: number | null | undefined,
  productDuree: string | null | undefined,
): number {
  // 1. Champ numérique de la souscription (source la plus fiable)
  if (subMonths && Number(subMonths) > 0) return Number(subMonths);
  // 2. Chaîne du produit : "60 mois" → 60, "5 ans" → 60, "60" → 60
  if (productDuree) {
    const s = String(productDuree).toLowerCase().trim();
    const anMatch  = s.match(/(\d+)\s*an/);   // "5 ans" ou "5 an"
    const mosMatch = s.match(/(\d+)/);          // premier nombre
    if (anMatch)  return parseInt(anMatch[1])  * 12;
    if (mosMatch) return parseInt(mosMatch[1]);
  }
  // 3. Champ numérique du contrat (peut être mal rempli)
  if (contractMonths && Number(contractMonths) > 0) return Number(contractMonths);
  return 12; // défaut de sécurité
}

/** Extrait un taux numérique depuis une chaîne comme "8% annuel", "8.5%", "8", etc. */
function parseRate(rateStr: string | null | undefined): number {
  if (!rateStr) return 0;
  const match = String(rateStr).match(/[\d]+([.,]\d+)?/);
  if (!match) return 0;
  return parseFloat(match[0].replace(',', '.'));
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; icon: any }> = {
  pending_signature: {
    label: 'À signer',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
    icon: PenLine,
  },
  signed: {
    label: 'Signé',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    icon: CheckCircle,
  },
  pending_payment: {
    label: 'En attente de versement',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    icon: Banknote,
  },
  pending_validation: {
    label: 'En validation',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    icon: Clock,
  },
  active: {
    label: 'Actif',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    icon: CheckCircle,
  },
  closed: {
    label: 'Clôturé',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    icon: AlertCircle,
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'pending', label: 'En attente' },
  { key: 'closed', label: 'Clôturés' },
];

const ClientContracts = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const navigate = useNavigate();
  const leadId = clientAccount?.lead_id;

  useEffect(() => {
    logConnection(clientAccount?.id, 'page_view', 'Mes Contrats');
  }, []);

  const { data: allSubs, isLoading: loading } = useClientContracts(leadId);
  const { data: profileData } = useClientProfile(leadId);
  const { branding: companyBranding } = useCompanySignature();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewContract, setViewContract] = useState<any>(null);
  const [viewContractHtml, setViewContractHtml] = useState<string>('');
  const [loadingContractView, setLoadingContractView] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSubId, setUploadSubId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const leadData = profileData?.lead ?? null;

  const contracts = useMemo(() => {
    return (allSubs || []).filter(
      (sub: any) => sub.status !== 'cancelled',
    );
  }, [allSubs]);

  const filteredContracts = useMemo(() => {
    let list = contracts;
    if (activeFilter === 'active') list = list.filter((s: any) => s.status === 'active');
    else if (activeFilter === 'pending') list = list.filter((s: any) => ['pending_signature', 'pending_payment', 'pending_validation', 'signed'].includes(s.status));
    else if (activeFilter === 'closed') list = list.filter((s: any) => s.status === 'closed');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s: any) =>
        s.products?.nom?.toLowerCase().includes(q) ||
        s.custom_name?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [contracts, activeFilter, search]);

  // Summary stats
  const activeCount = contracts.filter((s: any) => s.status === 'active').length;
  // Capital réellement investi = uniquement les versements confirmés (pas de fallback sur sub.amount)
  const totalCapital = contracts.reduce((sum: number, s: any) => {
    const deposits = (s.client_transactions || []).filter((t: any) => t.type === 'deposit' && t.status === 'confirmed').reduce((a: number, t: any) => a + Number(t.amount || 0), 0);
    const withdrawals = (s.client_transactions || []).filter((t: any) => t.type === 'withdrawal' && t.status === 'confirmed').reduce((a: number, t: any) => a + Number(t.amount || 0), 0);
    return sum + Math.max(0, deposits - withdrawals);
  }, 0);
  // Montant en attente de paiement = contrats signés mais versement non encore confirmé
  const pendingPaymentAmount = contracts
    .filter((s: any) => ['pending_payment', 'signed'].includes(s.status))
    .reduce((sum: number, s: any) => {
      const hasConfirmed = (s.client_transactions || []).some((t: any) => t.type === 'deposit' && t.status === 'confirmed');
      return hasConfirmed ? sum : sum + (Number(s.amount) || 0);
    }, 0);
  const lastSignedAt = contracts.reduce((latest: string | null, s: any) => {
    const contract = getLatestClientContract(s.client_contracts) as any;
    const d = contract?.signed_at || s.signed_at;
    if (!d) return latest;
    return !latest || new Date(d) > new Date(latest) ? d : latest;
  }, null);
  const allOk = contracts.every((s: any) => ['active', 'pending_payment', 'pending_signature', 'pending_validation', 'signed'].includes(s.status));

  // ── Business logic ──────────────────────────────────────────────
  const getRenderableContractHtml = async (contract: any, sub: any, { liveRender = true }: { liveRender?: boolean } = {}) => {
    const productId = sub?.product_id || sub?.products?.id || contract?.product_id;
    const product = sub?.products || {};
    const snapshot = (contract?.contract_html_snapshot || contract?.contract_snapshot || contract?.html_snapshot || '').trim();

    // ── Step 1: Try to render from the live Supabase template ──────
    // Always done when liveRender=true (view mode) so that new legal mentions
    // added to the template in the CRM are always visible to the client.
    // When liveRender=false (PDF download), we use the frozen snapshot for
    // legal immutability.
    let liveHtml = '';
    if (liveRender && productId) {
      try {
        const { data: productRow } = await supabase
          .from('products' as any)
          .select('contract_template')
          .eq('id', productId)
          .maybeSingle();

        const templateRef = String((productRow as any)?.contract_template || '').trim();

        // Resolve template content: by UUID → by explicit HTML ref → fallback to latest active template
        let templateContent = '';
        if (UUID_RE.test(templateRef)) {
          const { data: tmpl } = await supabase
            .from('contract_templates' as any)
            .select('content')
            .eq('id', templateRef)
            .maybeSingle();
          if ((tmpl as any)?.content?.trim()) templateContent = (tmpl as any).content;
        } else if (templateRef) {
          // raw HTML stored directly in the field
          templateContent = templateRef;
        }

        // No template assigned to this product → use the most recently updated active template
        if (!templateContent) {
          const { data: latestTmpl } = await supabase
            .from('contract_templates' as any)
            .select('content')
            .eq('statut', 'actif')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if ((latestTmpl as any)?.content?.trim()) templateContent = (latestTmpl as any).content;
        }

        if (templateContent) {
          liveHtml = renderContractHtml(templateContent, {
            leadData,
            product,
            amount: contract?.amount ?? sub?.amount,
            signedAt: contract?.signed_at ?? contract?.created_at ?? new Date().toISOString(),
            reference: contract?.reference || '',
          }, undefined, companyBranding ?? undefined);
        }
      } catch { /* fall through to snapshot */ }
    }

    // ── Step 2: Fall back to snapshot / edge function ──────────────
    let html = liveHtml;
    if (!html) {
      html = snapshot;
      if (!html && productId) {
        try {
          const response = await callCrmApi<any>('client-contracts', 'preview', { productId, amount: contract?.amount ?? sub?.amount ?? '0' });
          html = (response?.contract_html ? response : response?.preview || response?.contract || response?.data)?.contract_html || '';
        } catch {
          html = snapshot;
        }
      }
    }
    const realAmount = Number(contract?.amount) || Number(sub?.amount) || 0;
    if (html && realAmount > 0) {
      const formatted = realAmount.toLocaleString('fr-FR');
      html = html.replace(/\b0(\s*(?:&nbsp;|\s)*)\s*€/g, `${formatted}$1€`);
    }
    if (html && !html.includes('data-contract-signature-block="true"')) {
      html = appendSignatureBlockToHtml(html, {
        signatureDataUrl: contract?.signature_data ?? null,
        companyStampUrl: companyBranding?.companyStampUrl ?? null,
        signedAt: contract?.signed_at ?? null,
      });
    }
    return html;
  };

  const handleDownloadPdf = async (sub: any) => {
    const contract = getLatestClientContract(sub.client_contracts) as any | null;
    if (!contract) { toast.error('Aucun contrat signé trouvé'); return; }
    setDownloadingId(contract.id);
    try {
      const contractHtmlForPdf = await getRenderableContractHtml(contract, sub, { liveRender: true });
      await downloadContractWithToast(contract.id, {
        productName: sub.products?.nom || 'Contrat',
        amount: Number(contract.amount ?? sub.amount ?? 0),
        durationMonths: parseDuration(sub.duration_months, contract.duration_months, sub.products?.duree),
        interestRate: Number(contract.interest_rate || 0) || parseRate(sub.products?.interets),
        signedAt: contract.signed_at || contract.created_at || new Date().toISOString(),
        signatureData: contract.signature_data || null,
        clientName: leadData ? `${leadData.prenom || ''} ${leadData.nom || ''}`.trim() : '',
        clientEmail: leadData?.email,
        contractHtml: contractHtmlForPdf,
        reference: contract.reference || '',
      });
    } catch { /* toast already handled */ }
    finally { setDownloadingId(null); }
  };

  const handleViewContract = async (sub: any) => {
    const contract = getLatestClientContract(sub.client_contracts) as any | null;
    if (!contract) return;
    setLoadingContractView(true);
    setViewContract({ ...contract, _sub: sub });
    setViewContractHtml('');
    try {
      setViewContractHtml(await getRenderableContractHtml(contract, sub));
    } catch {
      setViewContractHtml('<p>Contrat indisponible</p>');
    }
    setLoadingContractView(false);
  };

  const handleUploadProof = (subId: string) => {
    setUploadSubId(subId);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadSubId) return;
    setUploading(uploadSubId);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${clientAccount.lead_id}/preuve-virement-${uploadSubId.slice(0, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('lead-documents').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('lead-documents').getPublicUrl(path);
      await supabase.from('documents').insert({
        lead_id: clientAccount.lead_id,
        nom: `Preuve de virement — ${contracts.find((c: any) => c.id === uploadSubId)?.products?.nom || 'Contrat'}`,
        type: 'virement',
        url: urlData.publicUrl || path,
      });
      toast.success('Preuve de virement envoyée avec succès ! Un conseiller validera votre versement sous 48h.');
    } catch (err) {
      toast.error("Erreur lors de l'envoi du fichier");
    } finally {
      setUploading(null);
      setUploadSubId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <ClientRowsSkeleton rows={3} />;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl space-y-6">
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileSelected} />

      {/* ── EN-TÊTE ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2347] via-[#1a3a6b] to-[#0f2347] p-6 md:p-8 text-white shadow-xl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-[#c9a84c]/10 blur-2xl" />
          <div className="absolute top-1/2 right-1/4 w-1 h-16 bg-white/10 rotate-45" />
          <div className="absolute top-1/3 right-1/3 w-1 h-10 bg-white/10 rotate-12" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#c9a84c]" />
                <span className="text-[10px] text-white/60 uppercase tracking-[0.2em] font-semibold">Espace sécurisé</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Mes contrats</h1>
              <p className="text-sm text-white/60 mt-1 max-w-md">
                Retrouvez l'ensemble de vos contrats et documents contractuels en toute sécurité.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Contrats actifs</p>
              <p className="text-3xl font-bold text-white tabular-nums">{activeCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARTES RÉCAPITULATIVES ───────────────────────────────── */}
      {contracts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {[
            {
              icon: <FileText className="w-5 h-5 text-[#1a56db]" />,
              bg: 'bg-[#1a56db]/10',
              label: 'Contrats actifs',
              value: activeCount.toString(),
              sub: `sur ${contracts.length} au total`,
              valueColor: '',
            },
            {
              icon: <Wallet className="w-5 h-5 text-emerald-600" />,
              bg: 'bg-emerald-500/10',
              label: 'Capital investi',
              value: totalCapital > 0 ? `${totalCapital.toLocaleString('fr-FR')} €` : '—',
              sub: 'versements confirmés',
              valueColor: totalCapital > 0 ? 'text-emerald-600' : '',
            },
            {
              icon: <Clock className="w-5 h-5 text-amber-600" />,
              bg: 'bg-amber-500/10',
              label: 'En attente de paiement',
              value: pendingPaymentAmount > 0 ? `${pendingPaymentAmount.toLocaleString('fr-FR')} €` : '—',
              sub: 'versements à effectuer',
              valueColor: pendingPaymentAmount > 0 ? 'text-amber-600' : '',
            },
            {
              icon: <Calendar className="w-5 h-5 text-violet-600" />,
              bg: 'bg-violet-500/10',
              label: 'Dernier contrat',
              value: lastSignedAt ? new Date(lastSignedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
              sub: 'date de signature',
              valueColor: '',
            },
            {
              icon: <ShieldCheck className="w-5 h-5 text-[#1a56db]" />,
              bg: 'bg-[#1a56db]/10',
              label: 'Statut global',
              value: allOk ? 'À jour' : 'Action requise',
              sub: allOk ? 'Tous les contrats à jour' : 'Vérifiez vos contrats',
              valueColor: allOk ? 'text-emerald-600' : 'text-amber-600',
            },
          ].map((card, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>{card.icon}</div>
                <p className="text-xs text-muted-foreground font-medium leading-tight">{card.label}</p>
              </div>
              <p className={`text-xl font-bold ${card.valueColor || 'text-foreground'} tabular-nums leading-tight`}>{card.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── RECHERCHE + FILTRES ──────────────────────────────────── */}
      {contracts.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un contrat..."
              className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#1a56db]/25 focus:border-[#1a56db]/50 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeFilter === f.key
                    ? 'bg-[#0f2347] text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── ÉTAT VIDE ────────────────────────────────────────────── */}
      {contracts.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-12 md:p-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-[#0f2347]/8 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Aucun contrat disponible</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed mb-6">
            Vous ne disposez actuellement d'aucun contrat. Vos futurs contrats d'investissement apparaîtront ici dès leur validation.
          </p>
          <button
            onClick={() => navigate('/client/products')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0f2347] text-white text-sm font-semibold hover:bg-[#1a3a6b] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Découvrir nos placements <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun contrat ne correspond à votre recherche.</p>
          <button onClick={() => { setSearch(''); setActiveFilter('all'); }} className="mt-3 text-xs text-[#1a56db] hover:underline">Réinitialiser les filtres</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredContracts.map((sub: any) => {
            const product = sub.products;
            const contract = getLatestClientContract(sub.client_contracts) as any | null;
            const statusConf = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending_signature;
            const StatusIcon = statusConf.icon;
            const pendingDeposit = sub.client_transactions?.find((t: any) => t.type === 'deposit' && t.status === 'pending');
            const confirmedDeposit = sub.client_transactions?.find((t: any) => t.type === 'deposit' && t.status === 'confirmed');
            const isExpanded = expandedId === sub.id;

            const deposits = (sub.client_transactions || []).filter((t: any) => t.type === 'deposit' && t.status === 'confirmed').reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
            const withdrawals = (sub.client_transactions || []).filter((t: any) => t.type === 'withdrawal' && t.status === 'confirmed').reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
            const netCapital = deposits - withdrawals;
            const displayAmount = netCapital > 0 ? netCapital : Number(sub.amount) || 0;
            const contractRef = contract?.reference || `CONT-${sub.id.slice(0, 8).toUpperCase()}`;

            return (
              <div key={sub.id} className="rounded-2xl border border-border/60 bg-card shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">

                {/* ── Card header ── */}
                <div className="p-5 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                    {/* Icon + info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-[#0f2347]/8 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6 text-[#0f2347] dark:text-slate-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-foreground text-base truncate">
                            {product?.nom || sub?.custom_name || 'Contrat'}
                          </h3>
                          {contract?.is_joint_account && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">Compte commun</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{contractRef}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Souscrit le {new Date(sub.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusConf.bg} ${statusConf.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} shrink-0`} />
                        {statusConf.label}
                      </span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                    {[
                      { label: 'Capital investi', value: displayAmount > 0 ? `${displayAmount.toLocaleString('fr-FR')} €` : '—', accent: true },
                      { label: 'Durée', value: product?.duree || (contract?.duration_months ? `${contract.duration_months} mois` : '—') },
                      { label: 'Taux', value: product?.interets || (contract?.interest_rate ? `${contract.interest_rate}%` : '—') },
                      { label: 'Garantie', value: product?.risque || '—' },
                    ].map((stat, i) => (
                      <div key={i} className={`rounded-xl p-3 ${stat.accent ? 'bg-[#0f2347]/6 dark:bg-slate-800/60 border border-[#0f2347]/10 dark:border-slate-700' : 'bg-muted/50'}`}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
                        <p className={`text-sm font-bold ${stat.accent ? 'text-[#0f2347] dark:text-white' : 'text-foreground'}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Pending deposit banner */}
                  {sub.status === 'pending_payment' && pendingDeposit && (
                    <div className="mt-4 relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1a56db] to-[#0f2347] p-5 text-white shadow-lg">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                      <div className="relative space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                            <PartyPopper className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-bold text-base">Félicitations !</h4>
                            <p className="text-blue-100 text-xs">Votre contrat a été signé avec succès</p>
                          </div>
                        </div>
                        <p className="text-sm text-blue-50 leading-relaxed">
                          Pour finaliser votre investissement, effectuez un virement de{' '}
                          <strong className="text-white">{sub.amount?.toLocaleString('fr-FR')} €</strong>{' '}
                          sur le compte indiqué par votre conseiller.
                        </p>
                        <div className="bg-white/15 rounded-lg p-3 border border-white/20 text-xs text-blue-100">
                          Pour des raisons de <strong className="text-white">traçabilité</strong>, uploadez votre preuve de virement (capture d'écran, relevé bancaire).
                        </div>
                        <Button
                          size="sm"
                          className="bg-white text-[#1a56db] hover:bg-blue-50 font-semibold shadow-md border-0"
                          disabled={uploading === sub.id}
                          onClick={() => handleUploadProof(sub.id)}
                        >
                          {uploading === sub.id ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi en cours…</>
                          ) : (
                            <><Upload className="w-4 h-4 mr-2" />J'ai effectué le virement</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Confirmed deposit notice */}
                  {confirmedDeposit && (
                    <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 px-4 py-3">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-sm text-emerald-800 dark:text-emerald-400">
                        Versement confirmé le {new Date(confirmedDeposit.confirmed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  )}

                  {/* Contract schedule */}
                  {(sub.status === 'active' || sub.status === 'closed') && contract && (
                    <div className="mt-4">
                      <ContractSchedule
                        amount={displayAmount}
                        durationMonths={parseDuration(sub.duration_months, contract?.duration_months, product?.duree)}
                        interestRate={Number(contract.interest_rate || 0) || parseRate(product?.interets)}
                        signedAt={contract.signed_at}
                        productName={product?.nom || 'Produit'}
                        reference={(contract as any).reference || ''}
                        clientName={leadData ? `${leadData.prenom} ${leadData.nom}` : ''}
                        branding={companyBranding}
                      />
                    </div>
                  )}

                  {/* Actions bar */}
                  <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-border/50">
                    {sub.status === 'pending_signature' && (
                      <button
                        onClick={() => navigate(`/client/products/${product?.id}`)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0f2347] text-white text-xs font-semibold hover:bg-[#1a3a6b] transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                      >
                        <PenLine className="w-3.5 h-3.5" /> Signer le contrat
                      </button>
                    )}
                    {contract && (
                      <>
                        <button
                          onClick={() => handleViewContract(sub)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted/60 hover:border-[#1a56db]/30 transition-all duration-200"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#1a56db]" /> Consulter le contrat
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(sub)}
                          disabled={downloadingId === contract.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted/60 transition-all duration-200 disabled:opacity-60"
                        >
                          {downloadingId === contract.id ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Préparation…</>
                          ) : (
                            <><Download className="w-3.5 h-3.5 text-emerald-600" /> Télécharger PDF</>
                          )}
                        </button>
                      </>
                    )}
                    {sub.status !== 'pending_signature' && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 ml-auto"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Voir les détails
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* Expanded details panel */}
                  {isExpanded && contract && (
                    <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Informations du contrat</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: 'Référence', value: contract.reference || contractRef },
                          { label: 'Montant', value: contract.amount ? `${Number(contract.amount).toLocaleString('fr-FR')} €` : '—' },
                          { label: 'Durée', value: contract.duration_months ? `${contract.duration_months} mois` : '—' },
                          { label: 'Taux annuel', value: contract.interest_rate ? `${contract.interest_rate}%` : '—' },
                          { label: 'Signé le', value: contract.signed_at ? new Date(contract.signed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
                          { label: 'Rendement prévu', value: (contract.interest_rate && contract.amount && contract.duration_months) ? `${((Number(contract.amount) * Number(contract.interest_rate) / 100 * Number(contract.duration_months) / 12)).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €` : '—' },
                        ].map((item, i) => (
                          <div key={i} className="bg-card rounded-lg border border-border/50 p-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
                            <p className="text-sm font-semibold text-foreground">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DIALOG CONTRAT ──────────────────────────────────────── */}
      <Dialog open={!!viewContract} onOpenChange={() => { setViewContract(null); setViewContractHtml(''); }}>
        <DialogContent
          className="max-w-5xl max-h-[92vh] overflow-y-auto p-0"
          onPointerDownOutside={(e) => {
            if ((e.target as HTMLElement)?.tagName === 'IFRAME') e.preventDefault();
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0f2347]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#0f2347] dark:text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Détail du contrat</DialogTitle>
                {viewContract?.reference && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{viewContract.reference}</p>
                )}
              </div>
            </div>
          </DialogHeader>

          {viewContract && (() => {
            const sub = viewContract._sub;
            const product = sub?.products ?? null;
            const resolvedAmount = Number(viewContract.amount || sub?.amount || 0);
            const resolvedRate = Number(viewContract.interest_rate || 0) || parseRate(product?.interets || sub?.taux_fixe?.toString());
            const resolvedDuration = parseDuration(sub?.duration_months, viewContract.duration_months, product?.duree);
            const rendement = resolvedAmount > 0 && resolvedRate > 0 && resolvedDuration > 0
              ? (resolvedAmount * resolvedRate / 100 * resolvedDuration / 12).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
              : '—';
            return (
            <div className="p-6 space-y-5">
              {/* Key info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Montant investi', value: resolvedAmount > 0 ? `${resolvedAmount.toLocaleString('fr-FR')} €` : '—', icon: <Wallet className="w-4 h-4 text-[#1a56db]" /> },
                  { label: 'Durée', value: resolvedDuration > 0 ? `${resolvedDuration} mois` : '—', icon: <Calendar className="w-4 h-4 text-violet-600" /> },
                  { label: 'Taux annuel', value: resolvedRate > 0 ? `${resolvedRate}%` : '—', icon: <TrendingUp className="w-4 h-4 text-emerald-600" /> },
                  { label: 'Signé le', value: viewContract.signed_at ? new Date(viewContract.signed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—', icon: <CheckCircle className="w-4 h-4 text-emerald-600" /> },
                  { label: 'Rendement prévu', value: rendement, icon: <BarChart3 className="w-4 h-4 text-amber-600" /> },
                  { label: 'Référence', value: viewContract.reference || '—', icon: <FileText className="w-4 h-4 text-slate-500" /> },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0 border border-border/50">{item.icon}</div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                      <p className="text-sm font-bold text-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Contract document */}
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Document contractuel</span>
                  </div>
                  {viewContract._sub && (
                    <button
                      onClick={() => handleDownloadPdf(viewContract._sub)}
                      disabled={downloadingId === viewContract.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f2347] text-white text-xs font-semibold hover:bg-[#1a3a6b] transition-colors disabled:opacity-60"
                    >
                      {downloadingId === viewContract.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Génération…</>
                      ) : (
                        <><Download className="w-3.5 h-3.5" />Télécharger PDF</>
                      )}
                    </button>
                  )}
                </div>
                <div className="bg-white">
                  {loadingContractView ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Chargement du document…</span>
                    </div>
                  ) : viewContractHtml ? (
                    <ContractHtmlFrame
                      title="Contrat signé"
                      html={viewContractHtml}
                      signatureData={viewContract.signature_data || null}
                      signedAt={viewContract.signed_at || null}
                      className="w-full bg-white"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientContracts;
