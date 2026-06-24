import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/crmSupabaseClient';
import { callCrmApi } from '@/lib/crmApi';
import {
  Package, ArrowLeft, FileText, TrendingUp,
  CheckCircle, Loader2, Users, Eye, Download,
  PiggyBank, Landmark, ShieldCheck, TrendingUpDown, Layers, Building2, Bitcoin,
  Percent, CalendarDays, Euro, Lock, Unlock, Info, ChevronRight, Banknote,
} from 'lucide-react';
import livretImg from '@/assets/category-livret.jpg';
import compteThemeImg from '@/assets/category-compte-theme.jpg';
import assuranceVieImg from '@/assets/category-assurance-vie.jpg';
import cryptoImg from '@/assets/category-crypto.jpg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProfitSimulator from '@/components/products/ProfitSimulator';
import SignatureCanvas from '@/components/client-portal/SignatureCanvas';
import ContractHtmlFrame from '@/components/client-portal/ContractHtmlFrame';
import { renderContractHtml, appendSignatureBlockToHtml, fixContractCategoryLabel, generateContractReference, injectReferenceIntoHtml } from '@/lib/contractRendering';
import { useCompanySignature } from '@/hooks/useCompanySignature';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchProductContractPreview, fetchValidClientProduct, fetchValidClientSubscription, getLatestClientContract, isLegacyContractHtml } from '@/hooks/useClientData';
import { decodeContractHtml, extractPdfUrl } from '@/lib/clientContractPreview';
// Heavy PDF libs — dynamically imported only when the user clicks Download
// so they don't bloat the initial page chunk (~600KB saved on first load)
import { toast } from 'sonner';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ClientProductDetail = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const { productId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [product, setProduct] = useState<any>(null);
  const [leadProduct, setLeadProduct] = useState<any>(null);
  const [leadData, setLeadData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Subscription flow
  const [step, setStep] = useState<'info' | 'amount' | 'contract' | 'sign' | 'done'>('info');
  const [amount, setAmount] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [existingSub, setExistingSub] = useState<any>(null);
  const [isJointAccount, setIsJointAccount] = useState(false);
  const [coSubscriber, setCoSubscriber] = useState({
    civilite: '', nom: '', prenom: '', email: '', telephone: '',
    adresse: '', code_postal: '', ville: '', nationalite: '',
  });
  const [viewContractHtml, setViewContractHtml] = useState('');
  const [loadingContractView, setLoadingContractView] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);

  // Contract template
  const [contractHtml, setContractHtml] = useState<string>('');
  const [contractPreviewMeta, setContractPreviewMeta] = useState<any>(null);
  // Stable reference for the current session — generated once and reused across preview/sign
  const [contractRef] = useState<string>(() => generateContractReference());
  const [loadingContract, setLoadingContract] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { branding: companyBranding } = useCompanySignature();
  const { lang } = useLanguage();

  const getAmountLimits = (targetProduct: any) => {
    const min = Number(targetProduct?.prix_minimum || 0);
    const max = Number(targetProduct?.prix_maximum || 0);
    const hasConfiguredRange = min > 0 || max > 0;
    return {
      min: hasConfiguredRange ? Math.max(min, 1) : 0,
      max: hasConfiguredRange ? Math.max(max, min, 1) : 0,
      hasConfiguredRange,
    };
  };

  const amountLimits = getAmountLimits(product);
  const normalizedAmount = Math.max(Number(amount || 0), amountLimits.min);
  const existingSubAmount = Number(existingSub?.amount ?? 0);
  const backendAmount = amountLimits.hasConfiguredRange
    ? normalizedAmount
    : existingSubAmount > 0
      ? existingSubAmount
      : '0';

  const leadId = clientAccount?.lead_id;

  useEffect(() => {
    if (!leadId || !productId) return;
    let cancelled = false;

    // Initial load — shows skeleton, resets step
    const initialLoad = async () => {
      setLoading(true);
      setStep('info');
      setAccepted(false);
      setSignatureData(null);
      setContractHtml('');
      setContractPreviewMeta(null);
      const [lpData, subData, { data: leadRes }] = await Promise.all([
        fetchValidClientProduct(leadId, productId),
        fetchValidClientSubscription(leadId, productId),
        supabase
          .from('leads')
          .select('prenom, nom, email, telephone, adresse, code_postal, ville, nationalite, civilite')
          .eq('id', leadId)
          .single(),
      ]);
      if (cancelled) return;
      if (lpData) {
        setLeadProduct(lpData);
        setProduct(lpData.products);
        setAmount(getAmountLimits(lpData.products).min);
      } else {
        setLeadProduct(null);
        setProduct(null);
      }
      setExistingSub(subData || null);
      if (leadRes) setLeadData(leadRes);
      setLoading(false);
    };

    initialLoad();

    return () => { cancelled = true; };
  }, [leadId, productId]);

  // Silent background refresh when tab becomes visible — separate effect so it
  // never re-triggers initialLoad (which resets step/form progress).
  useEffect(() => {
    if (!leadId || !productId) return;

    const silentRefresh = async () => {
      try {
        const subData = await fetchValidClientSubscription(leadId, productId);
        setExistingSub(subData || null);
      } catch { /* non-blocking */ }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') silentRefresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [leadId, productId]);

  const activeContract = getLatestClientContract(existingSub?.client_contracts) as any | null;
  const canResumeSignature = !!existingSub && !activeContract && existingSub.status === 'pending_payment';

  const renderProductAttachedTemplate = async (targetProduct: any, targetAmount: number | string) => {
    const attachedTemplate = String(targetProduct?.contract_template || '').trim();
    if (!attachedTemplate) return null;

    let templateContent = attachedTemplate;
    let templateId: string | null = null;

    if (UUID_RE.test(attachedTemplate)) {
      const { data: template } = await supabase
        .from('contract_templates')
        .select('id, content, updated_at')
        .eq('id', attachedTemplate)
        .eq('status', 'actif')
        .eq('is_published', true)
        .maybeSingle();
      if (!template?.content?.trim()) return null;
      templateId = template.id;
      templateContent = template.content;
    }

    const html = renderContractHtml(templateContent, {
      leadData,
      product: targetProduct,
      amount: targetAmount,
      signedAt: new Date().toISOString(),
      reference: contractRef,
    }, undefined, companyBranding);

    return { contract_html: html, product_id: targetProduct.id, template_id: templateId || targetProduct.id };
  };

  const fetchLatestSubscription = async () => {
    if (!clientAccount?.lead_id || !productId) return null;

    return fetchValidClientSubscription(clientAccount.lead_id, productId);
  };

  // Load template when going to contract step
  const loadContractTemplate = async () => {
    if (!product) return;
    setLoadingContract(true);
    setContractPreviewMeta(null);

    try {
      const preview = await renderProductAttachedTemplate(product, backendAmount)
        || await fetchProductContractPreview(product.id, backendAmount);
      const catSlug = product?._category?.slug || product?.categorie || '';
      const fixedHtml = injectReferenceIntoHtml(
        fixContractCategoryLabel(preview.contract_html, catSlug),
        contractRef,
      );
      setContractHtml(fixedHtml);
      setContractPreviewMeta({ ...preview, contract_html: fixedHtml });
    } catch (err) {
      console.error('Error loading contract template:', err);
      setContractHtml('<p>Contrat indisponible</p>');
    }
    setLoadingContract(false);
  };

  const handleGoToContract = async () => {
    await loadContractTemplate();
    setStep('contract');
  };

  const canSignCurrentPreview = contractHtml.trim().length > 0 && !isLegacyContractHtml(contractHtml) && !/Contrat indisponible/i.test(contractHtml);

  const getRenderableContractHtml = async (contract: any) => {
    // Use the snapshot directly — it is the canonical signed version.
    const snapshot = contract?.contract_html_snapshot || contract?.contract_snapshot || contract?.html_snapshot || '';
    let html = snapshot.trim();

    if (!html) {
      // No snapshot: fall back to fetching the fresh template
      const targetProductId = product?.id || contract?.product_id;
      if (!targetProductId) return '';
      const preview = await fetchProductContractPreview(targetProductId, contract?.amount ?? existingSub?.amount ?? backendAmount);
      html = preview.contract_html;
    }

    // Fix wrong category labels in legacy snapshots (e.g. "Compte à Thème" vs actual product categorie)
    const productCatSlug = product?._category?.slug || product?.categorie || '';
    if (html && productCatSlug) {
      html = fixContractCategoryLabel(html, productCatSlug);
    }
    // Inject reference into already-rendered HTML (Edge Function returns empty reference cell)
    if (html) {
      html = injectReferenceIntoHtml(html, contractRef);
    }

    // Fix snapshots that were saved with amount=0 due to a bug: substitute
    // "0 €" patterns with the correct value when we know the real amount.
    const realAmount = Number(contract?.amount) || Number(existingSub?.amount) || 0;
    if (html && realAmount > 0) {
      const formatted = realAmount.toLocaleString('fr-FR');
      html = html.replace(/\b0(\s*(?:&nbsp;|\s)*)\s*€/g, `${formatted}$1€`);
    }

    // Always ensure the INVESTISSEUR / LA BANQUE block is present at the end,
    // even for contracts signed before this feature was added.
    if (html && !html.includes('data-contract-signature-block="true"')) {
      html = appendSignatureBlockToHtml(html, {
        signatureDataUrl: contract?.signature_data ?? null,
        companyStampUrl: companyBranding?.companyStampUrl ?? null,
        signedAt: contract?.signed_at ?? null,
      });
    }

    return html;
  };

  const handleOpenSignedContract = async () => {
    if (!activeContract) {
      toast.error(lang === 'en' ? 'No signed contract found' : 'Aucun contrat signé trouvé');
      return;
    }

    setContractDialogOpen(true);
    setLoadingContractView(true);
    setViewContractHtml('');

    try {
      setViewContractHtml(await getRenderableContractHtml(activeContract));
    } catch (err) {
      console.error('Error loading signed contract preview:', err);
      setViewContractHtml('<p>Contrat indisponible</p>');
    } finally {
      setLoadingContractView(false);
    }
  };

  const handleDownloadSignedContract = async () => {
    if (!activeContract) {
      toast.error(lang === 'en' ? 'No signed contract found' : 'Aucun contrat signé trouvé');
      return;
    }

    setDownloadingPdf(true);
    const t = toast.loading(lang === 'en' ? 'Preparing signed contract…' : 'Préparation du contrat signé…');
    try {
      // Detect if this is a PDF-template contract
      const snapshotHtml = activeContract.contract_html_snapshot || '';
      const decoded = decodeContractHtml(snapshotHtml);
      const pdfUrl = extractPdfUrl(decoded);

      if (pdfUrl && activeContract.signature_data) {
        // PDF contract: fetch original PDF + append a signature page
        const { appendSignatureToPdf } = await import('@/lib/appendSignatureToPdf');
        const clientName = leadData ? `${leadData.prenom || ''} ${leadData.nom || ''}`.trim() : '';
        const signedPdfBytes = await appendSignatureToPdf(pdfUrl, {
          clientName,
          clientCivility: leadData?.civilite || '',
          signatureData: activeContract.signature_data,
          signedAt: activeContract.signed_at || activeContract.created_at || new Date().toISOString(),
          reference: activeContract.reference || null,
          productName: product?.nom || '',
          amount: Number(activeContract.amount ?? existingSub?.amount ?? normalizedAmount),
        });

        const blob = new Blob([signedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (product?.nom || 'contrat').replace(/[^a-z0-9]/gi, '-').toLowerCase();
        a.download = `contrat-signe-${safeName}-${clientName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success(lang === 'en' ? 'Signed contract downloaded' : 'Contrat signé téléchargé', { id: t });
        return;
      }

      // HTML contract: use existing jsPDF renderer
      const contractHtmlForPdf = await getRenderableContractHtml(activeContract);
      toast.dismiss(t);
      const { downloadContractWithToast } = await import('@/lib/downloadContract');
      await downloadContractWithToast(activeContract.id, {
        productName: product?.nom || 'Contrat',
        amount: Number(activeContract.amount ?? existingSub?.amount ?? normalizedAmount),
        durationMonths: Number(activeContract.duration_months || 0),
        interestRate: Number(activeContract.interest_rate || 0),
        signedAt: activeContract.signed_at || activeContract.created_at || new Date().toISOString(),
        signatureData: activeContract.signature_data || null,
        clientName: leadData ? `${leadData.prenom || ''} ${leadData.nom || ''}`.trim() : '',
        clientEmail: leadData?.email,
        contractHtml: contractHtmlForPdf,
        reference: activeContract.reference || '',
      });
    } catch (err: any) {
      toast.error(err?.message || (lang === 'en' ? 'Unable to generate the contract' : 'Impossible de générer le contrat'), { id: t });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSubscribe = async () => {
    if (!product || !clientAccount || !signatureData) return;
    if (normalizedAmount < amountLimits.min || normalizedAmount > amountLimits.max) {
      toast.error(lang === 'en' ? `Amount must be between €${amountLimits.min} and €${amountLimits.max}` : `Le montant doit être entre ${amountLimits.min}€ et ${amountLimits.max}€`);
      return;
    }

    setSigning(true);
    try {
      // Capture signer IP (best-effort, non-blocking)
      let signerIp: string | null = null;
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        if (ipRes.ok) {
          const ipJson = await ipRes.json();
          if (typeof ipJson?.ip === 'string') signerIp = ipJson.ip;
        }
      } catch { /* ignore */ }

      const subscribed = canResumeSignature
        ? existingSub
        : await callCrmApi('client-contracts', 'subscribe', { productId: product.id, amount: backendAmount });
      const sub = subscribed?.subscription || subscribed;

      const preview = contractPreviewMeta?.product_id === product.id && contractPreviewMeta?.contract_html === contractHtml
        ? contractPreviewMeta
        : await renderProductAttachedTemplate(product, backendAmount) || await fetchProductContractPreview(product.id, backendAmount);
      const contractHtmlSnapshot = injectReferenceIntoHtml(
        fixContractCategoryLabel(preview.contract_html, product?._category?.slug || product?.categorie || ''),
        contractRef,
      );
      setContractHtml(contractHtmlSnapshot);
      setContractPreviewMeta({ ...preview, contract_html: contractHtmlSnapshot });

      if (!contractHtmlSnapshot.trim() || isLegacyContractHtml(contractHtmlSnapshot)) {
        throw new Error('Contrat indisponible');
      }

      // Append the official signature block at the very end of the contract body
      // before persisting the snapshot — this becomes the canonical signed version.
      const signedAt = new Date();
      const contractHtmlSnapshotWithSig = appendSignatureBlockToHtml(contractHtmlSnapshot, {
        signatureDataUrl: signatureData,
        companyStampUrl: companyBranding?.companyStampUrl ?? null,
        signedAt,
      });

      await callCrmApi('client-contracts', 'sign', {
        subscriptionId: sub.id,
        signatureData,
        signerIp,
        contractHtmlSnapshot: contractHtmlSnapshotWithSig,
        isJointAccount,
        ...(isJointAccount ? { coSubscriber } : {}),
      });

      const hydratedSub = await fetchLatestSubscription();
      setExistingSub(hydratedSub || sub);
      queryClient.invalidateQueries({ queryKey: ['client-products'] });
      queryClient.invalidateQueries({ queryKey: ['client-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['client-dashboard-bundle'] });
      queryClient.invalidateQueries({ queryKey: ['client-product-detail', productId] });
      setStep('done');
      toast.success(lang === 'en' ? 'Congratulations, your contract has been signed successfully.' : 'Félicitations, votre contrat a été signé avec succès.');
    } catch (err: any) {
      console.error('Contract signature error:', err);

      // Recovery: check if contract was actually created despite the error
      try {
        const recoveredSub = await fetchLatestSubscription();
        if (getLatestClientContract(recoveredSub?.client_contracts)) {
          setExistingSub(recoveredSub);
          setStep('done');
          toast.success(lang === 'en' ? 'Congratulations, your contract has been signed successfully.' : 'Félicitations, votre contrat a été signé avec succès.');
          return;
        }
      } catch (recoveryErr) {
        console.error('Contract signature recovery error:', recoveryErr);
      }

      toast.error((lang === 'en' ? 'Contract signature error: ' : 'Erreur lors de la signature du contrat: ') + (err.message || (lang === 'en' ? 'Unknown error' : 'Erreur inconnue')));
    } finally {
      setSigning(false);
    }
  };

  // --- Category display helpers ---
  const SLUG_TO_ICON: Record<string, React.ElementType> = {
    livret_d_epargne: PiggyBank, livret: PiggyBank,
    compte_a_terme: Landmark, compte_a_theme: Landmark,
    contrat_capi: TrendingUpDown,
    assurance_vie: ShieldCheck,
    produit_structure: Layers,
    immobilier: Building2,
    crypto: Bitcoin,
  };
  const SLUG_TO_IMG: Record<string, string> = {
    livret_d_epargne: livretImg, livret: livretImg,
    compte_a_terme: compteThemeImg, compte_a_theme: compteThemeImg,
    assurance_vie: assuranceVieImg,
    crypto: cryptoImg,
  };
  const catSlug = product?._category?.slug || product?.categorie || '';
  const catColor = product?._category?.couleur || '#6366f1';
  const catLabel = product?._category?.libelle || product?.nom || 'Placement';
  const CatIcon = SLUG_TO_ICON[catSlug] || Package;
  const heroBg = product?.image_url || SLUG_TO_IMG[catSlug] || null;
  const isLocked = catSlug === 'compte_a_terme' || catSlug === 'compte_a_theme';

  // Quick estimate for the personalized teaser (uses minimum amount or 10 000 € fallback)
  const _parseRate = (s: string) => { const m = s?.match(/([\d.,]+)\s*%/); return m ? parseFloat(m[1].replace(',', '.')) : 0; };
  const _parseMonths = (s: string) => { const m = s?.match(/(\d+)\s*mois/i); if (m) return +m[1]; const a = s?.match(/(\d+)\s*an/i); return a ? +a[1] * 12 : 12; };
  const _simAmount = amountLimits.min > 0 ? amountLimits.min : 10000;
  const _rate = _parseRate(product?.interets || '');
  const _months = _parseMonths(product?.duree || '12 mois');
  const _interests = _rate > 0 ? _simAmount * (_rate / 100) * (_months / 12) : 0;
  const _final = _simAmount + _interests;

  if (loading) {
    return (
      <div className="max-w-3xl space-y-5 animate-in fade-in-0 duration-300">
        <div className="h-8 w-32 rounded-lg bg-muted animate-pulse" />
        <div className="rounded-3xl overflow-hidden shadow-xl">
          <div className="h-64 bg-gradient-to-br from-muted via-muted/70 to-muted/40 animate-pulse relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map(i => (
            <div key={i} className="rounded-2xl border bg-card p-4 space-y-2">
              <div className="h-3 w-10 rounded bg-muted animate-pulse mx-auto" />
              <div className="h-7 w-14 rounded bg-muted animate-pulse mx-auto" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          <div className="h-12 w-full rounded-xl bg-muted animate-pulse" />
          <div className="h-10 w-full rounded-xl bg-primary/20 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{lang === 'en' ? 'Product not found' : 'Produit introuvable'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/client/products')}>
          <ArrowLeft className="w-4 h-4 mr-2" />{lang === 'en' ? 'Back' : 'Retour'}
        </Button>
      </div>
    );
  }

  const alreadySubscribed = step !== 'done' && existingSub && !!activeContract && ['pending_payment', 'active', 'signed'].includes(existingSub.status);

  return (
    <div className="max-w-5xl space-y-5 animate-in fade-in-0 duration-200">
      <Button variant="ghost" size="sm" onClick={() => navigate('/client/products')} className="text-muted-foreground hover:text-foreground -ml-1">
        <ArrowLeft className="w-4 h-4 mr-1.5" />{lang === 'en' ? 'Back to products' : 'Retour aux produits'}
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
      {/* ── Left column ── */}
      <div className="space-y-5">

      {/* ── Hero card ── */}
      <div className="rounded-3xl overflow-hidden shadow-2xl relative h-80 sm:h-96">
        {/* Background photo */}
        {heroBg ? (
          <img src={heroBg} alt={product.nom} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}88 100%)` }} />
        )}

        {/* Rich dark overlay — stronger at bottom for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
        {/* Left-side vignette for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />

        {/* Subtle texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        <div className="relative h-full flex flex-col justify-between p-6 sm:p-8">
          {/* Top row: icon + badges */}
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center ring-1 ring-white/25 shadow-lg">
              <CatIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-full bg-[#c9a84c]/25 text-[#f5d98a] ring-1 ring-[#c9a84c]/30 backdrop-blur-sm">
                <ShieldCheck className="w-3 h-3" />{lang === 'en' ? 'Protected deposits' : 'Dépôts protégés'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/30 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                {lang === 'en' ? 'Active' : 'Actif'}
              </span>
            </div>
          </div>

          {/* Bottom: rate as dominant focal point */}
          <div className="space-y-1">
            <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">{catLabel}</p>
            <h1 className="text-base sm:text-lg font-bold text-white/90 leading-tight">{product.nom}</h1>
            {product.interets && (
              <div className="pt-1">
                <div className="flex items-end gap-3">
                  <span className="text-5xl sm:text-7xl font-black text-white leading-none drop-shadow-lg tracking-tight">
                    {product.interets}
                  </span>
                  <div className="flex flex-col pb-1">
                    <span className="text-white/55 text-xs font-bold uppercase tracking-[0.2em] leading-tight">NET</span>
                    <span className="text-white/55 text-xs font-bold uppercase tracking-[0.2em] leading-tight">{lang === 'en' ? '/ YR' : '/ AN'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 ring-1 ring-white/20 text-white/90 text-[11px] font-semibold backdrop-blur-sm">
                    <ShieldCheck className="w-3 h-3" /> {lang === 'en' ? 'Guaranteed fixed rate' : 'Taux fixe garanti'}
                  </span>
                  {product.duree && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 ring-1 ring-white/20 text-white/90 text-[11px] font-semibold backdrop-blur-sm">
                      <CalendarDays className="w-3 h-3" /> {product.duree}
                    </span>
                  )}
                  {isLocked && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/20 ring-1 ring-orange-400/30 text-orange-200 text-[11px] font-semibold backdrop-blur-sm">
                      <Lock className="w-3 h-3" /> {lang === 'en' ? 'Capital locked until maturity' : "Capital bloqué jusqu'à échéance"}
                    </span>
                  )}
                </div>
              </div>
            )}
            {leadProduct?.created_at && (
              <p className="text-white/40 text-[10px] pt-1">
                {lang === 'en' ? 'Subscribed on' : 'Souscrit le'} {new Date(leadProduct.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl p-4 flex flex-col items-center gap-1.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Percent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-[10px] text-emerald-700/60 dark:text-emerald-300/60 font-semibold uppercase tracking-wide">{lang === 'en' ? 'Annual rate' : 'Taux annuel'}</p>
          <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 text-center leading-tight">{product.interets || '—'}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-800/40 rounded-2xl p-4 flex flex-col items-center gap-1.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-[10px] text-blue-700/60 dark:text-blue-300/60 font-semibold uppercase tracking-wide">{lang === 'en' ? 'Duration' : 'Durée'}</p>
          <p className="text-sm font-black text-blue-700 dark:text-blue-300 text-center leading-tight">{product.duree || '—'}</p>
        </div>
        {isLocked ? (
          <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/40 dark:to-red-950/40 border border-orange-100 dark:border-orange-800/40 rounded-2xl p-4 flex flex-col items-center gap-1.5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Lock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-[10px] text-orange-700/60 dark:text-orange-300/60 font-semibold uppercase tracking-wide">{lang === 'en' ? 'Funds' : 'Fonds'}</p>
            <p className="text-sm font-black text-orange-700 dark:text-orange-300 text-center leading-tight">{lang === 'en' ? 'Locked' : 'Bloqués'}</p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 border border-violet-100 dark:border-violet-800/40 rounded-2xl p-4 flex flex-col items-center gap-1.5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Unlock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-[10px] text-violet-700/60 dark:text-violet-300/60 font-semibold uppercase tracking-wide">{lang === 'en' ? 'Funds' : 'Fonds'}</p>
            <p className="text-sm font-black text-violet-700 dark:text-violet-300 text-center leading-tight">{lang === 'en' ? 'Available' : 'Disponibles'}</p>
          </div>
        )}
      </div>

      {/* ── Benefits strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: ShieldCheck,
            label: lang === 'en' ? 'Guaranteed rate' : 'Taux garanti',
            value: product.interets || '—',
            bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/40',
            iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            valColor: 'text-emerald-700 dark:text-emerald-300',
          },
          {
            icon: isLocked ? Lock : Unlock,
            label: lang === 'en' ? (isLocked ? 'Locked capital' : 'Available capital') : (isLocked ? 'Capital bloqué' : 'Capital disponible'),
            value: product.duree || '—',
            bg: isLocked
              ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-800/40'
              : 'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-800/40',
            iconBg: isLocked ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-violet-100 dark:bg-violet-900/50',
            iconColor: isLocked ? 'text-orange-600 dark:text-orange-400' : 'text-violet-600 dark:text-violet-400',
            valColor: isLocked ? 'text-orange-700 dark:text-orange-300' : 'text-violet-700 dark:text-violet-300',
          },
          {
            icon: ShieldCheck,
            label: lang === 'en' ? 'Deposit guarantee' : 'Garantie dépôts',
            value: lang === 'en' ? "Up to €100,000" : "Jusqu'à 100 000 €",
            bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800/40',
            iconBg: 'bg-blue-100 dark:bg-blue-900/50',
            iconColor: 'text-blue-600 dark:text-blue-400',
            valColor: 'text-blue-700 dark:text-blue-300',
          },
          {
            icon: Euro,
            label: lang === 'en' ? 'Minimum capital' : 'Capital minimum',
            value: product.prix_minimum ? `${product.prix_minimum.toLocaleString('fr-FR')} €` : '—',
            bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-800/40',
            iconBg: 'bg-amber-100 dark:bg-amber-900/50',
            iconColor: 'text-amber-600 dark:text-amber-400',
            valColor: 'text-amber-700 dark:text-amber-300',
          },
        ].map(({ icon: Icon, label, value, bg, iconBg, iconColor, valColor }) => (
          <div key={label} className={`border rounded-2xl p-4 flex flex-col items-center text-center gap-2 shadow-sm ${bg}`}>
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
              <p className={`text-xs font-black ${valColor} leading-tight mt-0.5`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Investment range ── */}
      {(product.prix_minimum || product.prix_maximum) && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-100 dark:border-amber-800/40 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <Euro className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-amber-700/60 dark:text-amber-300/60 font-semibold uppercase tracking-wide mb-2">{lang === 'en' ? 'Investment' : 'Investissement'}</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col">
                <span className="text-2xl font-black text-amber-700 dark:text-amber-300 leading-none">{product.prix_minimum?.toLocaleString('fr-FR')} €</span>
                <span className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">{lang === 'en' ? 'minimum' : 'minimum'}</span>
              </div>
              {product.prix_maximum && (
                <>
                  <span className="text-amber-300/50 text-xl">—</span>
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-amber-700 dark:text-amber-300 leading-none">{product.prix_maximum?.toLocaleString('fr-FR')} €</span>
                    <span className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">{lang === 'en' ? 'maximum' : 'maximum'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Financial indicators table ── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 p-4 border-b border-border/60">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Info className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground text-sm">{lang === 'en' ? 'Financial indicators' : 'Indicateurs financiers'}</span>
        </div>
        <div className="divide-y divide-border/60">
          {[
            { label: lang === 'en' ? 'Net annual rate' : 'Taux annuel net', value: product.interets || '—' },
            { label: lang === 'en' ? 'Duration' : 'Durée', value: product.duree || '—' },
            ...(product.prix_minimum ? [{ label: lang === 'en' ? 'Minimum deposit' : 'Versement minimum', value: `${product.prix_minimum.toLocaleString('fr-FR')} €` }] : []),
            ...(product.prix_maximum ? [{ label: lang === 'en' ? 'Maximum deposit' : 'Versement maximum', value: `${product.prix_maximum.toLocaleString('fr-FR')} €` }] : []),
            { label: lang === 'en' ? 'Fund availability' : 'Disponibilité des fonds', value: isLocked ? (lang === 'en' ? 'Locked until maturity' : "Bloqués jusqu'à échéance") : (lang === 'en' ? 'Available at any time' : 'Disponibles à tout moment') },
            { label: lang === 'en' ? 'Interest payment' : 'Paiement des intérêts', value: isLocked ? (lang === 'en' ? 'At contractual maturity' : "À l'échéance contractuelle") : (lang === 'en' ? 'Periodic per contract' : 'Périodique selon contrat') },
            { label: lang === 'en' ? 'Deposit guarantee' : 'Garantie des dépôts', value: lang === 'en' ? 'Up to €100,000 (SGD Luxembourg)' : "Jusqu'à 100 000 € (SGD Luxembourg)" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/30 transition-colors">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold text-foreground text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 p-4 border-b border-border/60">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground text-sm">{lang === 'en' ? 'Investment timeline' : 'Chronologie du placement'}</span>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-0">
            {[
              { label: lang === 'en' ? 'Subscription' : 'Souscription', sub: lang === 'en' ? 'Contract signed' : 'Signature du contrat', color: 'bg-primary', textColor: 'text-primary' },
              { label: lang === 'en' ? 'Active placement' : 'Placement actif', sub: isLocked ? (lang === 'en' ? 'Funds locked' : 'Fonds bloqués') : (lang === 'en' ? 'Funds available' : 'Fonds disponibles'), color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
              { label: product.duree ? (isLocked ? (lang === 'en' ? `${product.duree} lock-up` : `${product.duree} de blocage`) : (lang === 'en' ? `Duration: ${product.duree}` : `Durée : ${product.duree}`)) : (lang === 'en' ? 'Contractual term' : 'Durée contractuelle'), sub: isLocked ? (lang === 'en' ? 'Capital held' : 'Capital immobilisé') : (lang === 'en' ? 'Capital growing' : 'Capital valorisé'), color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
              { label: lang === 'en' ? 'Final payment' : 'Versement final', sub: lang === 'en' ? 'Capital + interest' : 'Capital + intérêts', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-3 h-3 rounded-full ${step.color} ring-4 ring-offset-0 ring-${step.color}/20 flex-shrink-0 mt-0.5`} />
                  <div className="mt-2 text-center px-1">
                    <p className={`text-[11px] font-bold ${step.textColor} leading-tight`}>{step.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{step.sub}</p>
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="h-0.5 bg-border flex-shrink-0 w-3 mt-1.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Personalized estimate teaser ── */}
      {_rate > 0 && (
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/50 p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 font-semibold uppercase tracking-wide mb-1">{lang === 'en' ? 'Simulation example' : 'Exemple de simulation'}</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-snug">
              {lang === 'en'
                ? <><span>For a deposit of </span><strong>{_simAmount.toLocaleString('en-CA')} €</strong><span> over {_months} months, you will receive approximately </span><strong>{_interests.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong><span> in net interest.</span></>
                : <><span>Pour un dépôt de </span><strong>{_simAmount.toLocaleString('fr-FR')} €</strong><span> sur {_months} mois, vous percevrez environ </span><strong>{_interests.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong><span> d'intérêts nets.</span></>}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">
              {_final.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
            </p>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-semibold mt-0.5">{lang === 'en' ? 'total capital recovered' : 'capital final récupéré'}</p>
          </div>
        </div>
      )}

      {/* ── Simulator ── */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 p-4 border-b border-border/60">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground text-sm">{lang === 'en' ? 'Return simulator' : 'Simulateur de rendement'}</span>
        </div>
        <div className="p-4">
          <ProfitSimulator product={product} variant="client" />
        </div>
      </div>

      </div>{/* end left column */}

      {/* ── Right column : benefits + description ── */}
      <div className="lg:sticky lg:top-6 space-y-4">
        {/* Why choose this product */}
        <div className="rounded-2xl overflow-hidden shadow-md border border-border/50">
          <div className="px-5 py-4 flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg, #111111 0%, #cc0000 100%)' }}>
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-white/80" />
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">{lang === 'en' ? 'Why choose this product?' : 'Pourquoi choisir ce placement ?'}</span>
          </div>
          <div className="bg-card p-5 space-y-3">
            {(lang === 'en' ? [
              product.interets ? `Fixed return of ${product.interets} net/year` : null,
              'No interest rate fluctuation risk',
              isLocked ? 'Capital preserved and secured until maturity' : 'Capital available at any time',
              'Deposits covered up to €100,000 (SGD Luxembourg)',
              isLocked ? 'Interest paid at maturity' : 'Interest paid periodically',
            ] : [
              product.interets ? `Rendement fixe de ${product.interets} net/an` : null,
              'Aucun risque de variation du taux',
              isLocked ? "Capital conservé et sécurisé jusqu'à l'échéance" : 'Capital disponible à tout moment',
              "Dépôts couverts jusqu'à 100 000 € (SGD Luxembourg)",
              isLocked ? 'Versement des intérêts à maturité' : 'Intérêts versés périodiquement',
            ]).filter(Boolean).map((item) => (
              <div key={item as string} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm text-foreground leading-snug">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badge */}
        <div className="rounded-xl border border-[#c9a84c]/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#c9a84c] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">{lang === 'en' ? 'Protected deposits' : 'Dépôts protégés'}</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
              {lang === 'en'
                ? <span>In accordance with the Luxembourg deposit guarantee scheme (SGD), your assets are covered up to <strong>€100,000</strong> per institution.</span>
                : <span>Conformément au système luxembourgeois de garantie des dépôts (SGD), vos avoirs sont couverts jusqu'à <strong>100 000 €</strong> par établissement.</span>}
            </p>
          </div>
        </div>

        {/* Description collapsible */}
        {product.description && (
          <details className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm group">
            <summary className="px-5 py-3.5 flex items-center gap-2.5 cursor-pointer list-none select-none hover:bg-muted/30 transition-colors">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground flex-1">{lang === 'en' ? 'View full terms' : 'Voir les conditions complètes'}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="px-5 pb-5 pt-1 border-t border-border/60">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          </details>
        )}
      </div>

      </div>{/* end grid */}

      {/* ── Subscription flow ── */}
      {alreadySubscribed ? (
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5.5 h-5.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground">{lang === 'en' ? 'Active subscription' : 'Souscription active'}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {existingSub.amount ? `${existingSub.amount.toLocaleString('fr-FR')} € ${lang === 'en' ? 'invested' : 'placés'}` : ''}{existingSub.amount ? ' · ' : ''}
                {existingSub.status === 'pending_payment' ? (lang === 'en' ? 'Awaiting payment' : 'En attente de versement') :
                 existingSub.status === 'active' ? (lang === 'en' ? 'Active' : 'Actif') : (lang === 'en' ? 'Signed' : 'Signé')}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap gap-2">
            {activeContract && (
              <>
                <Button variant="outline" size="sm" onClick={handleOpenSignedContract} className="rounded-xl">
                  <Eye className="w-4 h-4 mr-1.5" />{lang === 'en' ? 'View contract' : 'Voir le contrat'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadSignedContract} disabled={downloadingPdf} className="rounded-xl">
                  {downloadingPdf ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{lang === 'en' ? 'Preparing…' : 'Préparation…'}</>
                  ) : (
                    <><Download className="w-4 h-4 mr-1.5" />{lang === 'en' ? 'Download PDF' : 'Télécharger PDF'}</>
                  )}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/client/contracts')} className="rounded-xl">
              <FileText className="w-4 h-4 mr-1.5" />{lang === 'en' ? 'My contracts' : 'Mes contrats'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          {/* Step: info */}
          {step === 'info' && (
            <div className="p-6 sm:p-8 space-y-6">
              {/* Headline */}
              <div className="text-center space-y-2">
                <h2 className="font-black text-foreground text-xl">{lang === 'en' ? 'Ready to invest?' : 'Prêt à investir ?'}</h2>
                {_rate > 0 && _simAmount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {lang === 'en'
                      ? <><span>For </span><strong className="text-foreground">{_simAmount.toLocaleString('en-CA')} €</strong><span> invested, you will recover </span><strong className="text-emerald-600 dark:text-emerald-400">{_final.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</strong><span> at the end of {_months} months.</span></>
                      : <><span>Pour </span><strong className="text-foreground">{_simAmount.toLocaleString('fr-FR')} €</strong><span> investis, vous récupérerez </span><strong className="text-emerald-600 dark:text-emerald-400">{_final.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</strong><span> au terme des {_months} mois.</span></>}
                  </p>
                )}
              </div>

              {/* Primary CTA */}
              <Button
                onClick={() => setStep('amount')}
                className="w-full h-12 rounded-xl font-bold text-base"
                style={{ background: '#111111' }}
              >
                {lang === 'en' ? 'Subscribe now →' : 'Souscrire maintenant →'}
              </Button>

              {/* Secondary actions */}
              <div className="flex items-center justify-center gap-4 text-sm">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                  onClick={() => document.getElementById('simulator-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <TrendingUp className="w-3.5 h-3.5" />{lang === 'en' ? 'Simulate my return' : 'Simuler mon rendement'}
                </button>
              </div>

              {/* Mini trust strip */}
              <div className="flex items-center justify-center gap-4 pt-2 border-t border-border/60">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" /> {lang === 'en' ? 'Secure e-signature' : 'Signature électronique sécurisée'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="w-3 h-3 text-primary" /> {lang === 'en' ? 'Timestamped contract' : 'Contrat horodaté'}
                </span>
              </div>
            </div>
          )}

          {/* Step: amount */}
          {step === 'amount' && (
            <div className="p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">{lang === 'en' ? 'Set the investment amount' : "Définir le montant d'investissement"}</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Min: {amountLimits.min.toLocaleString('fr-FR')}€</span>
                  <span className="text-muted-foreground">Max: {amountLimits.max.toLocaleString('fr-FR')}€</span>
                </div>
                <Slider
                  value={[amount]}
                  onValueChange={([v]) => setAmount(v)}
                  min={amountLimits.min}
                  max={amountLimits.max}
                  step={100}
                  disabled={!amountLimits.hasConfiguredRange}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    min={amountLimits.min}
                    max={amountLimits.max}
                    className="text-lg font-semibold"
                    disabled={!amountLimits.hasConfiguredRange}
                  />
                  <span className="text-lg font-semibold text-foreground">€</span>
                </div>
                {(normalizedAmount < amountLimits.min || normalizedAmount > amountLimits.max) && (
                  <p className="text-xs text-destructive">{lang === 'en' ? `Amount must be between €${amountLimits.min} and €${amountLimits.max}` : `Le montant doit être entre ${amountLimits.min}€ et ${amountLimits.max}€`}</p>
                )}
              </div>

              {/* Joint account toggle */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="joint"
                    checked={isJointAccount}
                    onCheckedChange={(v) => setIsJointAccount(v === true)}
                  />
                  <label htmlFor="joint" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {lang === 'en' ? 'Joint account (2 subscribers)' : 'Compte commun (2 souscripteurs)'}
                  </label>
                </div>

                {isJointAccount && (
                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{lang === 'en' ? 'Co-subscriber identity' : 'Identité du co-souscripteur'}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">{lang === 'en' ? 'Title' : 'Civilité'}</label>
                        <select
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                          value={coSubscriber.civilite}
                          onChange={e => setCoSubscriber(p => ({ ...p, civilite: e.target.value }))}
                        >
                          <option value="">—</option>
                          <option value="Monsieur">{lang === 'en' ? 'Mr.' : 'Monsieur'}</option>
                          <option value="Madame">{lang === 'en' ? 'Ms.' : 'Madame'}</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{lang === 'en' ? 'Nationality' : 'Nationalité'}</label>
                        <Input value={coSubscriber.nationalite} onChange={e => setCoSubscriber(p => ({ ...p, nationalite: e.target.value }))} placeholder={lang === 'en' ? 'Canadian' : 'Française'} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{lang === 'en' ? 'Last name' : 'Nom'}</label>
                        <Input value={coSubscriber.nom} onChange={e => setCoSubscriber(p => ({ ...p, nom: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{lang === 'en' ? 'First name' : 'Prénom'}</label>
                        <Input value={coSubscriber.prenom} onChange={e => setCoSubscriber(p => ({ ...p, prenom: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Email</label>
                        <Input type="email" value={coSubscriber.email} onChange={e => setCoSubscriber(p => ({ ...p, email: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{lang === 'en' ? 'Phone' : 'Téléphone'}</label>
                        <Input value={coSubscriber.telephone} onChange={e => setCoSubscriber(p => ({ ...p, telephone: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">{lang === 'en' ? 'Address' : 'Adresse'}</label>
                        <Input value={coSubscriber.adresse} onChange={e => setCoSubscriber(p => ({ ...p, adresse: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{lang === 'en' ? 'Postal code' : 'Code postal'}</label>
                        <Input value={coSubscriber.code_postal} onChange={e => setCoSubscriber(p => ({ ...p, code_postal: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{lang === 'en' ? 'City' : 'Ville'}</label>
                        <Input value={coSubscriber.ville} onChange={e => setCoSubscriber(p => ({ ...p, ville: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('info')}>{lang === 'en' ? 'Back' : 'Retour'}</Button>
                <Button
                  onClick={handleGoToContract}
                  disabled={normalizedAmount < amountLimits.min || normalizedAmount > amountLimits.max || loadingContract}
                >
                  {loadingContract ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{lang === 'en' ? 'Loading...' : 'Chargement...'}</> : (lang === 'en' ? 'View contract' : 'Voir le contrat')}
                </Button>
              </div>
            </div>
          )}

          {/* Step: contract preview */}
          {step === 'contract' && (
            <div className="p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">{lang === 'en' ? 'Contract preview' : 'Aperçu du contrat'}</h2>
              <div className="bg-muted/50 rounded-lg p-0 max-h-[600px] overflow-y-auto">
                <ContractHtmlFrame title={lang === 'en' ? 'Contract preview' : 'Aperçu du contrat'} html={contractHtml} className="w-full bg-white border-0" />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="accept"
                  checked={accepted}
                  onCheckedChange={(v) => setAccepted(v === true)}
                />
                <label htmlFor="accept" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                  {lang === 'en'
                    ? <span>I have read and accept the general terms of the subscription contract and confirm I wish to invest <strong>{normalizedAmount.toLocaleString('en-CA')}€</strong> in <strong>{product.nom}</strong>.</span>
                    : <span>J'ai lu et j'accepte les conditions générales du contrat de souscription et je confirme vouloir investir <strong>{normalizedAmount.toLocaleString('fr-FR')}€</strong> dans <strong>{product.nom}</strong>.</span>}
                </label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep('amount'); setAccepted(false); }}>{lang === 'en' ? 'Back' : 'Retour'}</Button>
                <Button onClick={() => setStep('sign')} disabled={!accepted || !canSignCurrentPreview}>{lang === 'en' ? 'Sign the contract' : 'Signer le contrat'}</Button>
              </div>
            </div>
          )}

          {/* Step: signature */}
          {step === 'sign' && (
            <div className="p-6 space-y-5">
              <p className="text-sm text-foreground leading-relaxed">
                {lang === 'en'
                  ? <span>I have read and accept the general terms of the subscription contract and confirm I wish to invest <strong>{normalizedAmount.toLocaleString('en-CA')} €</strong> in <strong>{product.nom}</strong>.</span>
                  : <span>J'ai lu et j'accepte les conditions générales du contrat de souscription et je confirme vouloir investir la somme de <strong>{normalizedAmount.toLocaleString('fr-FR')} €</strong> dans <strong>{product.nom}</strong>.</span>}
              </p>
              <SignatureCanvas onSignatureChange={setSignatureData} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('contract')}>{lang === 'en' ? 'Back' : 'Retour'}</Button>
                <Button onClick={handleSubscribe} disabled={!signatureData || signing}>
                  {signing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{lang === 'en' ? 'Validating...' : 'Validation...'}</> : (lang === 'en' ? 'Validate and sign the contract' : 'Valider et signer le contrat')}
                </Button>
              </div>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="p-6 sm:p-8 space-y-6">
              {/* Header */}
              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto animate-in zoom-in duration-300">
                  <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">{lang === 'en' ? 'Contract signed successfully' : 'Contrat signé avec succès'}</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  {leadData?.civilite} {leadData?.nom}, {lang === 'en' ? 'congratulations on signing your contract. Your signed copy is ready to download.' : 'félicitations pour la signature de votre contrat. Votre exemplaire signé est prêt à être téléchargé.'}
                </p>
              </div>

              {/* Contract download card */}
              {activeContract && (
                <div className="border border-border rounded-2xl overflow-hidden max-w-lg mx-auto shadow-sm">
                  {/* Card header */}
                  <div className="bg-primary/5 border-b border-border px-5 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{lang === 'en' ? 'Contract' : 'Contrat'} — {product?.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'en' ? 'Signed on' : 'Signé le'} {new Date(activeContract.signed_at || activeContract.created_at || Date.now()).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="ml-auto flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="w-3 h-3" />{lang === 'en' ? 'Signed' : 'Signé'}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="px-5 py-4 space-y-2 bg-card">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{lang === 'en' ? 'Investor' : 'Investisseur'}</span>
                      <span className="font-medium text-foreground">{leadData?.prenom} {leadData?.nom}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{lang === 'en' ? 'Subscribed amount' : 'Montant souscrit'}</span>
                      <span className="font-medium text-foreground">{normalizedAmount.toLocaleString('fr-FR')} €</span>
                    </div>
                    {activeContract.reference && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{lang === 'en' ? 'Reference' : 'Référence'}</span>
                        <span className="font-mono text-xs text-foreground">{activeContract.reference}</span>
                      </div>
                    )}
                  </div>

                  {/* Download CTA */}
                  <div className="px-5 py-4 border-t border-border bg-card space-y-2">
                    <Button
                      className="w-full"
                      onClick={handleDownloadSignedContract}
                      disabled={downloadingPdf}
                    >
                      {downloadingPdf ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{lang === 'en' ? 'Preparing document…' : 'Préparation du document…'}</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" />{lang === 'en' ? 'Download my signed contract (PDF)' : 'Télécharger mon contrat signé (PDF)'}</>
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleOpenSignedContract}>
                      <Eye className="w-3.5 h-3.5 mr-1.5" />{lang === 'en' ? 'Preview contract' : 'Aperçu du contrat'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button variant="outline" onClick={() => navigate('/client/products')}>{lang === 'en' ? 'Back to products' : 'Retour aux produits'}</Button>
                <Button onClick={() => navigate('/client/contracts')}>
                  <FileText className="w-4 h-4 mr-2" />{lang === 'en' ? 'View my contracts' : 'Voir mes contrats'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent
          className="max-w-2xl max-h-[85vh] overflow-y-auto"
          onPointerDownOutside={(e) => {
            if ((e.target as HTMLElement)?.tagName === 'IFRAME') e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{lang === 'en' ? 'Active contract' : 'Contrat actif'}</DialogTitle>
          </DialogHeader>

          {loadingContractView ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />{lang === 'en' ? 'Loading contract...' : 'Chargement du contrat...'}
            </div>
          ) : (
            <div className="space-y-4">
              {viewContractHtml ? (
                <div className="border rounded-lg bg-white overflow-hidden">
                  <ContractHtmlFrame
                    title={lang === 'en' ? 'Signed contract' : 'Contrat signé'}
                    html={viewContractHtml}
                    signatureData={activeContract.signature_data || null}
                    signedAt={activeContract.signed_at || null}
                    className="w-full bg-white"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{lang === 'en' ? 'The signed contract is temporarily unavailable.' : 'Le contrat signé est indisponible pour le moment.'}</p>
              )}

              {activeContract && (
                <div className="flex justify-end pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={handleDownloadSignedContract} disabled={downloadingPdf}>
                    {downloadingPdf ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{lang === 'en' ? 'Preparing…' : 'Préparation…'}</>
                    ) : activeContract.contract_pdf_url ? (
                      <><Download className="w-3.5 h-3.5 mr-1" />{lang === 'en' ? 'Download PDF' : 'Télécharger PDF'}</>
                    ) : (
                      <><Download className="w-3.5 h-3.5 mr-1" />{lang === 'en' ? 'Generate PDF' : 'Générer le PDF'}</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientProductDetail;
