import { useMemo, useEffect, useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet, BarChart3, AlertCircle, Activity, History, Target, Coins, User, MessageCircle, Phone, Mail, Briefcase, FileText, Download, Eye, ArrowRight, CheckCircle2, Gift, ArrowDownLeft, ArrowUpRight, CalendarDays, Shield, Clock, Percent, Zap, CreditCard, ChevronRight, Star, Banknote, Loader2, CheckCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ContractHtmlFrame from '@/components/client-portal/ContractHtmlFrame';
import { getLatestClientContract } from '@/hooks/useClientData';
import { appendSignatureBlockToHtml } from '@/lib/contractRendering';
import { downloadContractWithToast } from '@/lib/downloadContract';
import { useCompanySignature } from '@/hooks/useCompanySignature';

import PortfolioHeroCard from '@/components/client-portal/premium/PortfolioHeroCard';
import PremiumStatCard from '@/components/client-portal/premium/PremiumStatCard';
import TrustBadges from '@/components/client-portal/premium/TrustBadges';
import InvestCTA from '@/components/client-portal/premium/InvestCTA';


import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useClientDashboardBundle, useClientDocuments, useClientContracts } from '@/hooks/useClientData';
import { track } from '@/lib/clientTracking';
import { logConnection } from '@/lib/connectionLog';
import { callCrmApi } from '@/lib/crmApi';
import { supabase as crmSupabase, syncCrmRealtimeAuth } from '@/lib/crmSupabaseClient';

const txLabel = (type?: string) => {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'deposit') return 'Dépôt';
  if (t === 'withdrawal') return 'Retrait';
  if (t === 'bonus') return 'Bonus';
  if (t === 'interest') return 'Intérêts';
  return 'Transaction';
};
import { ClientDashboardSkeleton } from '@/components/client-portal/ClientPageFallback';
import MyClientData from '@/components/client-portal/MyClientData';
import MyInvestments from '@/components/client-portal/MyInvestments';
import { getNetCapital } from '@/lib/clientBalances';

interface AdvisorProfile {
  id: string;
  login: string;
  nom?: string | null;
  prenom?: string | null;
  email: string;
  telephone: string | null;
  fonction: string | null;
  avatar_url: string | null;
  description?: string | null;
  biographie?: string | null;
}

function parseRate(interets: string): number {
  const match = interets.match(/([\d.,]+)\s*%/);
  if (!match) return 0;
  return parseFloat(match[1].replace(',', '.'));
}

function parseDurationMonths(duree: string): number {
  const m = duree.match(/(\d+)\s*mois/i);
  if (m) return parseInt(m[1]);
  const a = duree.match(/(\d+)\s*an/i);
  if (a) return parseInt(a[1]) * 12;
  return 12;
}

function monthsBetween(start: string | Date, end: string | Date): number {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 12;
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

function resolveSubProduct(sub: any): { nom: string; categorie?: string; interets: string; duree: string } | null {
  if (sub?.products) return sub.products;
  if (sub?.custom_name) {
    const rate = Number(sub.taux_fixe ?? sub.taux_variable ?? 0);
    const duree = sub.date_debut && sub.date_fin
      ? `${monthsBetween(sub.date_debut, sub.date_fin)} mois`
      : '12 mois';
    return {
      nom: sub.custom_name,
      categorie: 'Sur mesure',
      interets: `${rate}%`,
      duree,
    };
  }
  return null;
}

function resolveContractDuration(
  subDuration: string | number | null | undefined,
  contractDuration: string | number | null | undefined,
  productDuration: string | null | undefined
): number {
  for (const v of [subDuration, contractDuration]) {
    const n = Number(v);
    if (!isNaN(n) && n > 0) return n;
  }
  if (productDuration) {
    const m = productDuration.match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  return 0;
}

const ClientDashboard = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const leadId = clientAccount?.lead_id;

  const { data: bundleData, isLoading: loadingPortfolio } = useClientDashboardBundle(leadId);
  const { data: documents = [] } = useClientDocuments(leadId);
  const { data: contractsList = [] } = useClientContracts(leadId);
  const { branding: companyBranding } = useCompanySignature();

  // ── Contract preview dialog state ────────────────────────────────
  const [viewContract, setViewContract] = useState<any>(null);
  const [viewContractHtml, setViewContractHtml] = useState<string>('');
  const [loadingContractView, setLoadingContractView] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [advisorName, setAdvisorName] = useState<string>('Votre conseiller');
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const dashboardMsgChannelRef = useRef<any>(null);

  useEffect(() => {
    track('dashboard_view');
    logConnection(clientAccount?.id, 'page_view', 'Tableau de bord');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const conv: any = await callCrmApi('client-messaging', 'get-conversation');
        if (!conv || cancelled) return;
        const convId = conv?.conversationId;
        const meProfileId = conv?.myProfileId ?? conv?.clientProfileId ?? null;
        const advisor = conv?.advisor || {};
        const name = [advisor?.prenom, advisor?.nom].filter(Boolean).join(' ').trim()
          || conv?.advisorName
          || (advisor?.login ? String(advisor.login).split('@')[0] : 'Votre conseiller');
        setMyProfileId(meProfileId);
        setAdvisorName(name);
        if (!convId) return;
        await syncCrmRealtimeAuth();
        const { data } = await crmSupabase
          .from('messages')
          .select('id, sender_id, content, created_at, is_read')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(20);
        if (!cancelled && data) {
          const unread = data.filter(
            (m: any) => m.sender_id !== meProfileId && m.is_read !== true
          );
          setRecentMessages(unread);
        }

        // Écoute les suppressions Realtime pour retirer les messages effacés du widget
        const channel = crmSupabase
          .channel(`dashboard-msgs-${convId}`)
          .on('postgres_changes', {
            event: 'DELETE', schema: 'public', table: 'messages',
            filter: `conversation_id=eq.${convId}`,
          }, (payload) => {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              setRecentMessages(prev => prev.filter((m: any) => m.id !== deletedId));
            }
          })
          .subscribe();

        // Stocker la ref du channel pour cleanup
        (dashboardMsgChannelRef as any).current = channel;
      } catch (_) {
        /* silencieux : carte vide si pas de conseiller */
      }
    })();
    return () => {
      cancelled = true;
      const ch = (dashboardMsgChannelRef as any).current;
      if (ch) crmSupabase.removeChannel(ch);
    };
  }, [leadId]);

  const [tradingActive, setTradingActive] = useState<boolean>(true);
  const THEME_CACHE_KEY = leadId ? `portal_theme_${leadId}` : null;
  const [portalThemeDb, setPortalThemeDb] = useState<string>(() => {
    if (!leadId) return 'premium';
    return localStorage.getItem(`portal_theme_${leadId}`) || 'premium';
  });
  const applyTheme = (theme: string) => {
    const t = theme || 'premium';
    setPortalThemeDb(t);
    if (THEME_CACHE_KEY) localStorage.setItem(THEME_CACHE_KEY, t);
  };
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    const refresh = async () => {
      const { data, error } = await crmSupabase.from('leads').select('trading_active, portal_theme').eq('id', leadId).maybeSingle();
      if (!cancelled && !error) {
        setTradingActive(!!(data as any)?.trading_active);
        applyTheme((data as any)?.portal_theme || 'premium');
      }
    };
    let poll: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof crmSupabase.channel> | null = null;
    syncCrmRealtimeAuth().then(() => {
      if (cancelled) return;
      refresh();
      channel = crmSupabase
        .channel(`dash-trading-${leadId}`)
        .on('broadcast', { event: 'trading_mode_changed' }, ({ payload }) => setTradingActive(!!payload?.trading_active))
        .on('postgres_changes' as any, { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
          (payload: any) => {
            setTradingActive(!!payload.new?.trading_active);
            if (payload.new?.portal_theme) applyTheme(payload.new.portal_theme);
          })
        .subscribe();
      poll = setInterval(refresh, 20_000);
    });
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (channel) crmSupabase.removeChannel(channel);
    };
  }, [leadId]);

  // ── Contract preview handlers ────────────────────────────────────
  const getRenderableContractHtml = async (contract: any, sub: any) => {
    const snapshot = contract?.contract_html_snapshot || contract?.contract_snapshot || contract?.html_snapshot || '';
    let html = snapshot.trim();
    if (!html) {
      const productId = sub?.product_id || sub?.products?.id || contract?.product_id;
      if (!productId) return '';
      const response = await callCrmApi<any>('client-contracts', 'preview', { productId, amount: contract?.amount ?? sub?.amount ?? '0' });
      html = (response?.contract_html ? response : response?.preview || response?.contract || response?.data)?.contract_html || '';
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

  const handleDownloadContractPdf = async (sub: any) => {
    const contract = getLatestClientContract(sub.client_contracts) as any | null;
    if (!contract) return;
    setDownloadingId(contract.id);
    try {
      const contractHtmlForPdf = await getRenderableContractHtml(contract, sub);
      await downloadContractWithToast(contract.id, {
        productName: sub.products?.nom || sub.custom_name || 'Contrat',
        amount: Number(contract.amount ?? sub.amount ?? 0),
        durationMonths: resolveContractDuration(sub.duration_months, contract.duration_months, sub.products?.duree),
        interestRate: Number(contract.interest_rate || 0) || parseRate(sub.products?.interets || ''),
        signedAt: contract.signed_at || contract.created_at || new Date().toISOString(),
        signatureData: contract.signature_data || null,
        clientName: lead ? `${lead.prenom || ''} ${lead.nom || ''}`.trim() : '',
        clientEmail: lead?.email,
        contractHtml: contractHtmlForPdf,
        reference: contract.reference || '',
      });
    } catch { /* toast handled inside */ }
    finally { setDownloadingId(null); }
  };

  const lead = bundleData?.lead || null;
  const subscriptions = bundleData?.subscriptions || [];
  const transactions = bundleData?.transactions || [];
  const tradingPortfolio = bundleData?.tradingPortfolio || null;
  const allPositions = bundleData?.positions || [];
  
  const openPositions = allPositions.filter((p: any) => p.status === 'open');
  const closedPositions = allPositions.filter((p: any) => p.status === 'closed');

  const displayLead = lead || {
    prenom: '', nom: '', email: '', telephone: '',
    adresse: '', code_postal: '', ville: '', nationalite: '',
  };

  const clientDisplayName = displayLead.prenom?.trim() || 'Client';

  const portfolio = useMemo(() => {
    const activeSubs = subscriptions.filter((s: any) => s.status === 'active');
    let totalInvested = 0;
    let totalInterests = 0;
    const chartData: any[] = [];
    const productBreakdown: any[] = [];

    // REAL net capital = confirmed deposits - confirmed withdrawals.
    // NEVER falls back to sub.amount (rule: contract face value is not capital).
    // If no confirmed deposit yet → 0 (sur-mesure / pending placements).
    const getInvestedAmount = (subId: string) => getNetCapital(transactions, subId);

    const decoratedActiveSubs = activeSubs.map((sub: any) => ({
      ...sub,
      investedNet: getInvestedAmount(sub.id),
    }));

    for (const sub of decoratedActiveSubs) {
      const product = resolveSubProduct(sub);
      if (!product) continue;
      const rate = parseRate(product.interets || '0%');
      const duration = parseDurationMonths(product.duree || '12 mois');
      const monthlyRate = rate / 100 / 12;
      const startDate = new Date(sub.activated_at || sub.date_debut || sub.created_at);
      const now = new Date();
      const monthsElapsed = Math.min(
        Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + now.getMonth() - startDate.getMonth()),
        duration
      );

      const invested = sub.investedNet;
      totalInvested += invested;
      let cumInterest = 0;

      for (let m = 1; m <= monthsElapsed; m++) {
        const interest = invested * monthlyRate;
        cumInterest += interest;
      }

      totalInterests += cumInterest;

      productBreakdown.push({
        name: product.nom, invested, interests: cumInterest, total: invested + cumInterest,
        rate, duration, monthsElapsed, monthsRemaining: Math.max(0, duration - monthsElapsed),
      });
    }

    const months = decoratedActiveSubs.length > 0
      ? Math.max(...decoratedActiveSubs.map((s: any) => parseDurationMonths(resolveSubProduct(s)?.duree || '12 mois')))
      : 12;
    for (let m = 0; m <= months; m++) {
      let capital = 0;
      let interests = 0;
      for (const sub of decoratedActiveSubs) {
        const product = resolveSubProduct(sub);
        if (!product) continue;
        const rate = parseRate(product.interets || '0%');
        const monthlyRate = rate / 100 / 12;
        const invested = sub.investedNet;
        capital += invested;
        interests += invested * monthlyRate * m;
      }
      const d = new Date();
      d.setMonth(d.getMonth() + m - (decoratedActiveSubs.length > 0 ? Math.max(...decoratedActiveSubs.map((s: any) => {
        const start = new Date(s.activated_at || s.date_debut || s.created_at);
        const now = new Date();
        return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
      })) : 0));
      chartData.push({ month: `M${m}`, capital: Math.round(capital), total: Math.round(capital + interests), interests: Math.round(interests) });
    }

    const projectedInterests = decoratedActiveSubs.reduce((sum: number, sub: any) => {
      const product = resolveSubProduct(sub);
      if (!product) return sum;
      const rate = parseRate(product.interets || '0%');
      const duration = parseDurationMonths(product.duree || '12 mois');
      const invested = sub.investedNet;
      return sum + invested * (rate / 100 / 12) * duration;
    }, 0);

    return { totalInvested, totalInterests, totalValue: totalInvested + totalInterests, projectedInterests, productBreakdown, chartData, activeSubs: decoratedActiveSubs };
  }, [subscriptions, transactions]);

  const availableFunds = useMemo(() => {
    const totalDeposited = transactions
      .filter((t: any) => t.type === 'deposit' && t.status === 'confirmed')
      .reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0);
    const totalWithdrawn = transactions
      .filter((t: any) => t.type === 'withdrawal' && t.status === 'confirmed')
      .reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0);

    // Determine if a subscription's product is a locked term deposit.
    // PRIORITY: _category.slug (enriched, authoritative) → use it exclusively when present.
    // FALLBACK:  categorie legacy enum → only when slug is absent.
    // NEVER combine both with ||: the legacy enum can be "compte_a_theme" for a livret
    // (confirmed in production), which would incorrectly lock liquid funds.
    const LOCKED_SLUGS = new Set(['compte_a_terme', 'compte_a_theme']);
    const isLockedProduct = (s: any): boolean => {
      const slug = s.products?._category?.slug || '';
      if (slug) return LOCKED_SLUGS.has(slug);          // slug is authoritative
      const cat = s.products?.categorie || '';
      return LOCKED_SLUGS.has(cat);                     // fallback only when slug absent
    };

    // Capital invested in liquid products (= not locked) — these funds remain accessible
    const liquidInvested = (subscriptions as any[])
      .filter((s: any) => s.status === 'active' && !isLockedProduct(s))
      .reduce((acc: number, s: any) => acc + getNetCapital(transactions, s.id), 0);

    // availableFunds = all deposits − withdrawals − capital locked in term products
    // = totalDeposited − totalWithdrawn − totalInvested + liquidInvested
    return Math.max(0, totalDeposited - totalWithdrawn - portfolio.totalInvested + liquidInvested);
  }, [transactions, portfolio.totalInvested, subscriptions]);


  const pendingPayments = subscriptions.filter((s: any) => s.status === 'pending_payment');

  const handleDownloadStatement = async () => {
    const ORANGE: [number, number, number] = [239, 65, 35];
    const DARK:   [number, number, number] = [30, 30, 40];
    const LIGHT:  [number, number, number] = [250, 250, 252];
    const BORDER: [number, number, number] = [220, 220, 225];

    // Plain ASCII space — \u202f and \u00a0 both render as / in jsPDF Helvetica
    const fmt = (n: number, dec = 0) =>
      n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Load logo — circular icon, load directly as-is
    const logoBase64 = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = '/portal-logo.png';
    });

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const MARGIN = 14;

    // ── Header band ──────────────────────────────────────────────
    doc.setFillColor(...ORANGE);
    doc.rect(0, 0, pw, 30, 'F');

    // Logo directly on orange header — square circle logo, centred vertically
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', MARGIN, 5, 20, 20);
    }

    // Title right-aligned in orange header
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Relev\u00e9 de compte', pw - MARGIN, 16, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`G\u00e9n\u00e9r\u00e9 le ${new Date().toLocaleDateString('fr-FR')}`, pw - MARGIN, 23, { align: 'right' });

    // ── Client info block ─────────────────────────────────────────
    let y = 38;
    doc.setTextColor(...DARK);
    if (lead) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${lead.prenom} ${lead.nom}`, MARGIN, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 110);
      doc.text('Client', MARGIN, y);
      y += 3;
    }

    // Thin orange separator line
    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y + 2, pw - MARGIN, y + 2);
    y += 8;

    // ── Section helper ─────────────────────────────────────────────
    const section = (title: string) => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ORANGE);
      doc.text(title, MARGIN, y);
      y += 5;
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'normal');
    };

    const tableOpts = {
      margin: { left: MARGIN, right: MARGIN },
      theme: 'plain' as const,
      headStyles: {
        fillColor: ORANGE,
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: 'bold' as const,
        fontSize: 9,
        cellPadding: 3,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3, textColor: DARK },
      alternateRowStyles: { fillColor: LIGHT },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
      didParseCell: (data: any) => {
        if (data.section === 'head') data.cell.styles.lineColor = ORANGE;
      },
    };

    // ── Résumé du portefeuille ─────────────────────────────────────
    section('R\u00e9sum\u00e9 du portefeuille');
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Indicateur', 'Montant']],
      columnStyles: { 1: { halign: 'right' } },
      body: [
        ['Capital investi',                       `${fmt(portfolio.totalInvested)} EUR`],
        ['Int\u00e9r\u00eats cumul\u00e9s',       `${fmt(portfolio.totalInterests, 2)} EUR`],
        ['Valeur totale',                          `${fmt(portfolio.totalValue, 2)} EUR`],
        ['Int\u00e9r\u00eats projet\u00e9s',      `${fmt(portfolio.projectedInterests, 2)} EUR`],
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ── Détail par produit ─────────────────────────────────────────
    if (portfolio.productBreakdown.length > 0) {
      section('D\u00e9tail par produit');
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [['Produit', 'Investi', 'Int\u00e9r\u00eats', 'Total', 'Taux', 'Restant']],
        columnStyles: {
          0: { cellWidth: 42 },
          1: { cellWidth: 28, halign: 'right' },
          2: { cellWidth: 28, halign: 'right' },
          3: { cellWidth: 32, halign: 'right' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
        },
        body: portfolio.productBreakdown.map((p: any) => [
          p.name,
          `${fmt(p.invested)} EUR`,
          `${fmt(p.interests, 2)} EUR`,
          `${fmt(p.total, 2)} EUR`,
          `${p.rate}%`,
          `${p.monthsRemaining} mois`,
        ]),
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ── Historique des transactions ────────────────────────────────
    if (transactions.length > 0) {
      section('Historique des transactions');
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [['Date', 'Type', 'Montant', 'Statut']],
        columnStyles: { 2: { halign: 'right' } },
        body: transactions.slice(0, 50).map((t: any) => [
          new Date(t.created_at).toLocaleDateString('fr-FR'),
          txLabel(t.type),
          `${fmt(t.amount ?? 0)} EUR`,
          t.status === 'confirmed' ? 'Confirm\u00e9' : t.status === 'pending' ? 'En attente' : 'Rejet\u00e9',
        ]),
      });
    }

    // ── Footer ─────────────────────────────────────────────────────
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(...ORANGE);
    doc.rect(0, ph - 10, pw, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text('Document g\u00e9n\u00e9r\u00e9 automatiquement \u2014 Les r\u00e9sultats sont indicatifs et ne constituent pas un conseil en investissement.', pw / 2, ph - 4, { align: 'center' });

    doc.save(`releve-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loadingPortfolio) {
    return <ClientDashboardSkeleton />;
  }

  const performancePct = portfolio.totalInvested > 0
    ? (portfolio.totalInterests / portfolio.totalInvested) * 100
    : 0;

  // ── MULTI-DESIGN : thème lu directement en DB (mis à jour Realtime) ──
  const portalTheme: string = portalThemeDb;

  // ── THÈME "classique" — ancien layout avec PortfolioHeroCard ────────
  if (portalTheme === 'classique') {
    return (
      <div className="space-y-6 w-full pb-8">
        <PortfolioHeroCard
          clientName={clientDisplayName}
          totalValue={portfolio.totalValue}
          totalInvested={portfolio.totalInvested}
          totalInterests={portfolio.totalInterests}
          performancePct={performancePct}
          projectedInterests={portfolio.projectedInterests}
          activeContracts={portfolio.activeSubs.length}
          averageRate={
            portfolio.productBreakdown.length > 0
              ? portfolio.productBreakdown.reduce((sum: number, p: any) => sum + p.rate, 0) /
                portfolio.productBreakdown.length
              : 0
          }
          nextMaturityMonths={
            portfolio.productBreakdown.length > 0
              ? Math.min(...portfolio.productBreakdown.map((p: any) => p.monthsRemaining))
              : null
          }
          onDownloadStatement={handleDownloadStatement}
          rightSlot={
            <div className="grid grid-cols-2 gap-3">
              <PremiumStatCard icon={Wallet} label="Capital investi" value={portfolio.totalInvested} variant="default" delay={0} />
              <PremiumStatCard icon={Coins} label="Intérêts cumulés" value={portfolio.totalInterests} decimals={2} variant="success" delta={{ value: performancePct, positive: performancePct >= 0 }} delay={80} />
              <PremiumStatCard icon={BarChart3} label="Valeur du portefeuille" value={portfolio.totalValue} decimals={2} variant="accent" delay={160} />
              <PremiumStatCard icon={Target} label="Projection fin contrats" value={portfolio.projectedInterests} decimals={2} variant="gold" hint="intérêts totaux estimés" delay={240} />
            </div>
          }
        />

        <MyInvestments subscriptions={subscriptions} transactions={transactions} />

        {pendingPayments.length > 0 && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                {pendingPayments.length} versement{pendingPayments.length > 1 ? 's' : ''} en attente
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">Effectuez vos virements pour activer vos investissements.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/client/contracts')}>
                Voir mes contrats
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Messagerie */}
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="relative px-6 py-5 flex items-center justify-between overflow-hidden">
              <div className="relative flex items-center gap-4">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 shrink-0 flex items-center justify-center text-white shadow-lg">
                  <MessageCircle className="w-7 h-7" strokeWidth={2.2} />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-1">Support & contact</p>
                  <h2 className="text-xl font-bold text-foreground">Messagerie</h2>
                </div>
              </div>
              <button onClick={() => navigate('/client/help')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                Ouvrir <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 pt-0">
              {recentMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun nouveau message</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {recentMessages.map((msg: any) => {
                    const isMe = msg.sender_id === myProfileId;
                    return (
                      <button key={msg.id} type="button" onClick={() => navigate('/client/help')}
                        className="w-full text-left flex items-start gap-3 py-3 first:pt-1 last:pb-1 hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isMe ? 'bg-muted text-muted-foreground' : 'bg-blue-600/10 text-blue-600'}`}>
                          {isMe ? <User className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{isMe ? 'Moi' : advisorName}</p>
                            <p className="text-[11px] text-muted-foreground shrink-0">{new Date(msg.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{msg.content}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Mes contrats */}
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="relative px-6 py-5 flex items-center justify-between overflow-hidden">
              <div className="relative flex items-center gap-4">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shrink-0 flex items-center justify-center text-white shadow-lg">
                  <FileText className="w-7 h-7" strokeWidth={2.2} />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-1">Gérer mes contrats</p>
                  <h2 className="text-xl font-bold text-foreground">Mes contrats</h2>
                </div>
              </div>
              <button onClick={() => navigate('/client/contracts')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                Tout voir <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 pt-0">
              {(() => {
                const visibleContracts = (contractsList || []).filter((sub: any) => sub?.status !== 'closed' && sub?.status !== 'cancelled');
                if (visibleContracts.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">Aucun contrat pour le moment</p>;
                return (
                  <div className="divide-y divide-border/60">
                    {visibleContracts.slice(0, 10).map((sub: any) => {
                      const product = sub?.products;
                      const isPending = sub?.status === 'pending_signature';
                      const signedAt = sub?.client_contracts?.[0]?.signed_at;
                      return (
                        <div key={sub.id} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary ring-1 ring-primary/20 shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{product?.nom || sub?.custom_name || 'Contrat'}</p>
                              <p className={`text-xs ${isPending ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                                {isPending ? 'En attente de signature' : signedAt ? `Signé le ${new Date(signedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}` : '—'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => isPending ? navigate('/client/contracts') : handleViewContract(sub)}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            {isPending ? 'Signer →' : 'Voir →'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── DOCUMENTS + HISTORIQUE ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Mes documents */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Mes documents</h2>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Espace documentaire</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{documents.length} doc{documents.length !== 1 ? 's' : ''}</Badge>
            </div>
            <div className="p-5">
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/8 flex items-center justify-center">
                    <Briefcase className="w-7 h-7 text-violet-300" />
                  </div>
                  <p className="text-sm text-muted-foreground">Aucun document</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {documents.slice(0, 8).map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{doc.title || doc.name || doc.file_name || 'Document'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                          </p>
                        </div>
                      </div>
                      {doc.url && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button"
                            onClick={async () => {
                              try {
                                const data: any = await callCrmApi('client-documents', 'get-signed-url', { path: doc.url });
                                if (data?.signedUrl) { window.open(data.signedUrl, '_blank', 'noopener,noreferrer'); return; }
                                const { data: blob, error } = await crmSupabase.storage.from('lead-documents').download(doc.url);
                                if (!error && blob) window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
                              } catch {}
                            }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Voir">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button type="button"
                            onClick={async () => {
                              const filename = doc.nom || doc.title || doc.name || 'document';
                              try {
                                const data: any = await callCrmApi('client-documents', 'get-signed-url', { path: doc.url });
                                if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = filename; a.click(); return; }
                              } catch {}
                              const { data: blob, error } = await crmSupabase.storage.from('lead-documents').download(doc.url);
                              if (!error && blob) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u); }
                            }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-[#E60000]" title="Télécharger">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Historique des transactions */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <History className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Historique des transactions</h2>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Relevé de compte</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{transactions.length} op.</Badge>
            </div>
            <div className="p-5">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/8 flex items-center justify-center">
                    <History className="w-7 h-7 text-amber-300" />
                  </div>
                  <p className="text-sm text-muted-foreground">Aucune transaction</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {(() => {
                    const subAmountMap = new Map<string, number>(
                      (subscriptions as any[]).filter((s: any) => s?.id && Number(s?.amount) > 0).map((s: any) => [s.id, Number(s.amount)])
                    );
                    return transactions.slice(0, 10).map((tx: any) => {
                      const isDeposit = tx.type === 'deposit';
                      const isWithdrawal = tx.type === 'withdrawal';
                      const isInterest = tx.type === 'interest';
                      const displayAmt = Number(tx.amount) || subAmountMap.get(tx.subscription_id) || 0;
                      const txIcon = isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : isWithdrawal ? <ArrowUpRight className="w-4 h-4" /> : isInterest ? <Percent className="w-4 h-4" /> : <Gift className="w-4 h-4" />;
                      const txBg = isDeposit ? 'bg-emerald-500/10 text-emerald-600' : isWithdrawal ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600';
                      const amtColor = isWithdrawal ? 'text-red-600' : 'text-emerald-600';
                      const txRef = `REF-${String(tx.id || '').slice(-8).toUpperCase()}`;
                      return (
                        <div key={tx.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${txBg}`}>{txIcon}</div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">{txLabel(tx.type)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {' · '}
                                {new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className="text-[10px] text-muted-foreground/50 font-mono">{txRef}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold tabular-nums ${amtColor}`}>
                              {isWithdrawal ? '-' : '+'}{displayAmt.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €
                            </p>
                            <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              tx.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                              : tx.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                            }`}>
                              {tx.status === 'confirmed' ? 'Confirmé' : tx.status === 'pending' ? 'En attente' : 'Rejeté'}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── THÈME "premium" (défaut) — layout actuel ─────────────────────────
  return (
    <div className="space-y-5 w-full pb-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">

      {/* ── WELCOME BANNER ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080808] via-[#111111] to-[#0A0A0A] px-6 py-6 md:px-8 md:py-7 text-white shadow-xl">
        <div aria-hidden className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#E60000]/20 blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div aria-hidden className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#E60000]/08 blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-white/55 text-sm font-medium mb-1 capitalize">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Bonjour, {clientDisplayName}
            </h1>
            <p className="mt-2 text-white/65 text-sm max-w-xl leading-relaxed">
              Bienvenue dans votre espace client sécurisé. Visualisez votre solde et l'ensemble de vos placements en temps réel.
            </p>
          </div>
          <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/25 rounded-full px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E60000] animate-pulse" />
              <span className="text-xs font-semibold text-white/90">Espace sécurisé</span>
            </div>
            {portfolio.activeSubs.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
                <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                <span className="text-xs font-semibold text-white/80">{portfolio.activeSubs.length} placement{portfolio.activeSubs.length > 1 ? 's' : ''} actif{portfolio.activeSubs.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STATS CARDS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Capital investi */}
        <div className="group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E60000]/4 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.18em] font-semibold">Capital investi</p>
              <div className="w-11 h-11 rounded-xl bg-[#E60000]/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#E60000]" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
              {portfolio.totalInvested.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
            </p>
          </div>
        </div>

        {/* Valorisation actuelle */}
        <div className="group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/4 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.18em] font-semibold">Valorisation actuelle</p>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
              {portfolio.totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
        </div>

        {/* Intérêts cumulés */}
        <div className="group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/4 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.18em] font-semibold">Intérêts cumulés</p>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
              {portfolio.totalInterests.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
        </div>

        {/* Fonds disponibles */}
        <div className="group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/4 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.18em] font-semibold">Fonds disponibles</p>
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-violet-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
              {availableFunds.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS BAR ───────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 dark:from-slate-900/60 dark:via-slate-900/40 dark:to-slate-900/60 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-3.5 h-3.5 text-[#E60000]" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.18em] font-semibold">Actions rapides</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/client/versement')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E60000] text-white text-sm font-semibold hover:bg-[#cc0000] transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <CreditCard className="w-4 h-4" /> Effectuer un versement
          </button>
          <button
            onClick={() => navigate('/client/contracts')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-border text-foreground text-sm font-semibold hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <FileText className="w-4 h-4 text-[#E60000]" /> Consulter mes contrats
          </button>
          <button
            onClick={() => navigate('/client/help')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-border text-foreground text-sm font-semibold hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <MessageCircle className="w-4 h-4 text-[#E60000]" /> Contacter mon conseiller
          </button>
          <button
            onClick={() => navigate('/client/help')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-border text-foreground text-sm font-semibold hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <CalendarDays className="w-4 h-4 text-[#E60000]" /> Prendre rendez-vous
          </button>
        </div>
      </div>

      {/* ── MES INVESTISSEMENTS ─────────────────────────────────────── */}
      <MyInvestments subscriptions={subscriptions} transactions={transactions} />

      {pendingPayments.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800/40 p-5 shadow-sm">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-amber-400/10 blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-300/40 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200 text-base">
                  {pendingPayments.length} versement{pendingPayments.length > 1 ? 's' : ''} en attente
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                  Effectuez vos virements bancaires pour activer vos investissements et commencer à générer des intérêts.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/client/contracts')}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
            >
              <ArrowRight className="w-4 h-4" /> Voir mes contrats
            </button>
          </div>
        </div>
      )}

      {/* ── MESSAGERIE + CONTRATS ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Messagerie */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-300">
          <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E60000]/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-[#E60000]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Messagerie</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Support &amp; contact</p>
              </div>
            </div>
            <button onClick={() => navigate('/client/help')} className="flex items-center gap-1 text-xs font-semibold text-[#E60000] hover:underline">
              Ouvrir <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 p-5">
            {recentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#E60000]/8 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-[#E60000]/30" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Aucun nouveau message</p>
                  <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                    Les échanges avec votre conseiller apparaîtront ici.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/client/help')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E60000]/25 text-[#E60000] text-xs font-semibold hover:bg-[#E60000]/5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Écrire à mon conseiller
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentMessages.map((msg: any) => {
                  const isMe = msg.sender_id === myProfileId;
                  return (
                    <button
                      key={msg.id}
                      type="button"
                      onClick={() => navigate('/client/help')}
                      className="w-full text-left flex items-start gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isMe ? 'bg-muted text-muted-foreground' : 'bg-[#E60000]/10 text-[#E60000]'}`}>
                        {isMe ? <User className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{isMe ? 'Moi' : advisorName}</p>
                          <p className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(msg.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{msg.content}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mes contrats */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-300">
          <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#111111]/10 dark:bg-slate-700 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#111111] dark:text-slate-300" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Mes contrats</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gérer mes contrats</p>
              </div>
            </div>
            <button onClick={() => navigate('/client/contracts')} className="flex items-center gap-1 text-xs font-semibold text-[#E60000] hover:underline">
              Tout voir <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 p-5">
            {(() => {
              const visibleContracts = (contractsList || []).filter(
                (sub: any) => sub?.status !== 'closed' && sub?.status !== 'cancelled',
              );
              if (visibleContracts.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm text-muted-foreground">Aucun contrat pour le moment</p>
                  </div>
                );
              }
              const statusBadge = (status: string) => {
                if (status === 'active') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Actif</span>;
                if (status === 'pending_payment') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">En attente</span>;
                if (status === 'pending_signature') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">À signer</span>;
                if (status === 'pending_validation') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">En validation</span>;
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Clôturé</span>;
              };
              return (
                <div className="divide-y divide-border/50">
                  {visibleContracts.slice(0, 6).map((sub: any) => {
                    const contract = [...(sub.client_contracts || [])].sort(
                      (a: any, b: any) => new Date(b?.signed_at || b?.created_at || 0).getTime() - new Date(a?.signed_at || a?.created_at || 0).getTime()
                    )[0];
                    const product = sub?.products;
                    const signedAt = contract?.signed_at || sub?.signed_at;
                    const dateLabel = signedAt
                      ? new Date(signedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                      : sub?.created_at ? new Date(sub.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                    return (
                      <div key={sub.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="w-9 h-9 rounded-xl bg-[#111111]/8 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-[#111111] dark:text-slate-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{product?.nom || sub?.custom_name || 'Contrat'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-muted-foreground">{dateLabel}</p>
                            {statusBadge(sub?.status)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleViewContract(sub)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Consulter
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadContractPdf(sub)}
                            disabled={downloadingId === (getLatestClientContract(sub.client_contracts) as any)?.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#111111] text-white text-xs font-semibold hover:bg-[#cc0000] transition-colors disabled:opacity-60"
                          >
                            {downloadingId === (getLatestClientContract(sub.client_contracts) as any)?.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Download className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>


      {/* ── DOCUMENTS + TRANSACTIONS ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Mes documents */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
          <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Mes documents</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Espace documentaire</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">{documents.length} doc{documents.length !== 1 ? "s" : ""}</Badge>
          </div>
          <div className="p-5">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/8 flex items-center justify-center">
                  <Briefcase className="w-7 h-7 text-violet-300" />
                </div>
                <p className="text-sm text-muted-foreground">Aucun document</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {documents.slice(0, 8).map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{doc.title || doc.name || doc.file_name || "Document"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                        </p>
                      </div>
                    </div>
                    {doc.url && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const data: any = await callCrmApi("client-documents", "get-signed-url", { path: doc.url });
                              if (data?.signedUrl) { window.open(data.signedUrl, "_blank", "noopener,noreferrer"); return; }
                              const { data: blob, error } = await crmSupabase.storage.from("lead-documents").download(doc.url);
                              if (!error && blob) window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
                            } catch {}
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Voir"
                        ><Eye className="w-3.5 h-3.5" /></button>
                        <button
                          type="button"
                          onClick={async () => {
                            const filename = doc.nom || doc.title || doc.name || "document";
                            try {
                              const data: any = await callCrmApi("client-documents", "get-signed-url", { path: doc.url });
                              if (data?.signedUrl) { const a = document.createElement("a"); a.href = data.signedUrl; a.download = filename; a.click(); return; }
                            } catch {}
                            const { data: blob, error } = await crmSupabase.storage.from("lead-documents").download(doc.url);
                            if (!error && blob) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u); }
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-[#E60000]"
                          title="Télécharger"
                        ><Download className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Historique des transactions */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
          <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <History className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Historique des transactions</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Relevé de compte</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">{transactions.length} op.</Badge>
          </div>
          <div className="p-5">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/8 flex items-center justify-center">
                  <History className="w-7 h-7 text-amber-300" />
                </div>
                <p className="text-sm text-muted-foreground">Aucune transaction</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {(() => {
                  const subAmountMap = new Map<string, number>(
                    (subscriptions as any[]).filter((s: any) => s?.id && Number(s?.amount) > 0).map((s: any) => [s.id, Number(s.amount)])
                  );
                  return transactions.slice(0, 10).map((tx: any) => {
                    const isDeposit = tx.type === "deposit";
                    const isWithdrawal = tx.type === "withdrawal";
                    const isInterest = tx.type === "interest";
                    const displayAmount = Number(tx.amount) || subAmountMap.get(tx.subscription_id) || 0;
                    const txIcon = isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : isWithdrawal ? <ArrowUpRight className="w-4 h-4" /> : isInterest ? <Percent className="w-4 h-4" /> : <Gift className="w-4 h-4" />;
                    const txBg = isDeposit ? "bg-emerald-500/10 text-emerald-600" : isWithdrawal ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600";
                    const amountColor = isWithdrawal ? "text-red-600" : "text-emerald-600";
                    const txRef = `REF-${String(tx.id || "").slice(-8).toUpperCase()}`;
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${txBg}`}>{txIcon}</div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{txLabel(tx.type)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                              {" · "}
                              {new Date(tx.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <p className="text-[10px] text-muted-foreground/50 font-mono">{txRef}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold tabular-nums ${amountColor}`}>
                            {isWithdrawal ? "−" : "+"}{displayAmount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
                          </p>
                          <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            tx.status === "confirmed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : tx.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          }`}>
                            {tx.status === "confirmed" ? "Confirmé" : tx.status === "pending" ? "En attente" : "Rejeté"}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

            {tradingActive && tradingPortfolio && openPositions.length > 0 && (
        <div className="border rounded-lg bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Positions de trading en cours</h2>
            <Badge variant="secondary" className="ml-auto">{openPositions.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Symbole</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Direction</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Quantité</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Prix d'entrée</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Levier</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">SL / TP</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((pos: any) => (
                  <tr key={pos.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2.5 px-2 font-semibold text-foreground">{pos.symbol}</td>
                    <td className="py-2.5 px-2">
                      <Badge variant={pos.direction === 'long' ? 'default' : 'destructive'} className="text-xs">
                        {pos.direction === 'long' ? '↑ Long' : '↓ Short'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 text-right text-foreground">{pos.quantity}</td>
                    <td className="py-2.5 px-2 text-right text-foreground">{pos.entry_price}</td>
                    <td className="py-2.5 px-2 text-right text-foreground">x{pos.leverage}</td>
                    <td className="py-2.5 px-2 text-right text-xs text-muted-foreground">
                      {pos.stop_loss ? `SL: ${pos.stop_loss}` : '—'} / {pos.take_profit ? `TP: ${pos.take_profit}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right text-xs text-muted-foreground">
                      {new Date(pos.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tradingActive && tradingPortfolio && closedPositions.length > 0 && (
        <div className="border rounded-lg bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Historique trading</h2>
            <Badge variant="outline" className="ml-auto">{closedPositions.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Symbole</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Direction</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Entrée</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Sortie</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">P&L</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.slice(0, 10).map((pos: any) => (
                  <tr key={pos.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2.5 px-2 font-semibold text-foreground">{pos.symbol}</td>
                    <td className="py-2.5 px-2">
                      <Badge variant={pos.direction === 'long' ? 'default' : 'destructive'} className="text-xs">
                        {pos.direction === 'long' ? '↑ Long' : '↓ Short'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 text-right text-foreground">{pos.entry_price}</td>
                    <td className="py-2.5 px-2 text-right text-foreground">{pos.exit_price ?? '—'}</td>
                    <td className={`py-2.5 px-2 text-right font-semibold ${(pos.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(pos.pnl ?? 0) >= 0 ? '+' : ''}{(pos.pnl ?? 0).toFixed(2)}$
                    </td>
                    <td className="py-2.5 px-2 text-right text-xs text-muted-foreground">
                      {pos.closed_at ? new Date(pos.closed_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tradingActive && tradingPortfolio && (
        <div className="border rounded-lg bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Compte de Trading</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Solde</p>
              <p className="text-lg font-bold text-foreground">{Number(tradingPortfolio.balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {tradingPortfolio.currency}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Capital initial</p>
              <p className="text-lg font-bold text-foreground">{Number(tradingPortfolio.initial_balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {tradingPortfolio.currency}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">P&L total</p>
              <p className={`text-lg font-bold ${(tradingPortfolio.balance - tradingPortfolio.initial_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(tradingPortfolio.balance - tradingPortfolio.initial_balance) >= 0 ? '+' : ''}{(tradingPortfolio.balance - tradingPortfolio.initial_balance).toFixed(2)} {tradingPortfolio.currency}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Positions ouvertes</p>
              <p className="text-lg font-bold text-foreground">{openPositions.length}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/client/trading')}>
            <TrendingUp className="w-3.5 h-3.5 mr-1" />Accéder au trading
          </Button>
        </div>
      )}

      {/* ── Contract preview dialog ───────────────────────────────── */}
      <Dialog open={!!viewContract} onOpenChange={() => { setViewContract(null); setViewContractHtml(''); }}>
        <DialogContent
          className="max-w-5xl max-h-[92vh] overflow-y-auto p-0"
          onPointerDownOutside={(e) => {
            if ((e.target as HTMLElement)?.tagName === 'IFRAME') e.preventDefault();
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#111111]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#111111] dark:text-white" />
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
            const product = resolveSubProduct(sub);
            const resolvedAmount = Number(viewContract.amount || sub?.amount || 0);
            const resolvedRate = Number(viewContract.interest_rate || 0) || parseRate(product?.interets || sub?.taux_fixe?.toString() || '');
            const resolvedDuration = Number(viewContract.duration_months || sub?.duration_months || 0) || parseDurationMonths(product?.duree || '');
            const rendement = resolvedAmount > 0 && resolvedRate > 0 && resolvedDuration > 0
              ? (resolvedAmount * resolvedRate / 100 * resolvedDuration / 12).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
              : '—';
            return (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Montant investi', value: resolvedAmount > 0 ? `${resolvedAmount.toLocaleString('fr-FR')} €` : '—', icon: <Wallet className="w-4 h-4 text-[#E60000]" /> },
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

              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Document contractuel</span>
                  </div>
                  {viewContract._sub && (
                    <button
                      onClick={() => handleDownloadContractPdf(viewContract._sub)}
                      disabled={downloadingId === viewContract.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111111] text-white text-xs font-semibold hover:bg-[#cc0000] transition-colors disabled:opacity-60"
                    >
                      {downloadingId === viewContract.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Génération…</>
                      ) : (
                        <><Download className="w-3.5 h-3.5" />Télécharger PDF</>
                      )}
                    </button>
                  )}
                </div>
                <div className="bg-white" style={{ minHeight: '640px' }}>
                  {loadingContractView ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Chargement du document…</span>
                    </div>
                  ) : viewContractHtml ? (
                    <ContractHtmlFrame
                      title="Contrat"
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

const formatAdvisorName = (login: string | null | undefined): string => {
  if (!login) return 'Votre conseiller';
  const name = login.includes('@') ? login.split('@')[0] : login;
  return name.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const getAdvisorInitials = (advisor: AdvisorProfile | null): string => {
  const first = advisor?.prenom?.trim()?.[0] || advisor?.login?.trim()?.[0] || 'C';
  const last = advisor?.nom?.trim()?.[0] || advisor?.login?.trim()?.split(/\s+/)?.[1]?.[0] || '';
  return `${first}${last}`.toUpperCase();
};

const AdvisorPresenceCard = () => {
  const navigate = useNavigate();
  const [advisor, setAdvisor] = useState<AdvisorProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    callCrmApi('client-self-service', 'get-advisor')
      .then((data: any) => setAdvisor(data?.advisor || data || null))
      .catch(() => setAdvisor(null));
  }, []);

  const displayName = advisor ? formatAdvisorName(advisor.login) : 'Votre conseiller';
  const role = advisor?.fonction && !['sans_acces', 'sans acces'].includes(advisor.fonction.toLowerCase())
    ? advisor.fonction
    : 'Conseiller financier';
  const initials = getAdvisorInitials(advisor);

  const openAssistant = () => {
    track('advisor_card_contact_click');
    navigate('/client/help');
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-background px-6 py-10 shadow-sm flex flex-col justify-between min-h-[430px]">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative">
            {advisor?.avatar_url ? (
              <img src={advisor.avatar_url} alt={displayName} className="w-[210px] h-[210px] rounded-2xl object-cover object-center shadow-2xl ring-4 ring-primary/20 ring-offset-4 ring-offset-background" />
            ) : (
              <div className="w-[210px] h-[210px] rounded-2xl bg-primary/10 flex items-center justify-center text-5xl font-semibold text-primary shadow-2xl ring-4 ring-primary/20 ring-offset-4 ring-offset-background">
                {initials}
              </div>
            )}
            <Button
              variant="outline"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/95 px-5 py-2.5 text-foreground shadow-xl border-border/70 backdrop-blur hover:bg-primary hover:text-primary-foreground hover:border-primary whitespace-nowrap"
              onClick={() => setProfileOpen(true)}
              disabled={!advisor}
            >
              Voir le profil
            </Button>
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-xs text-muted-foreground">Votre interlocuteur dédié</p>
            <h2 className="text-2xl font-bold text-foreground">{displayName}</h2>
            <p className="text-sm font-semibold text-primary">{role}</p>
            {advisor?.description && <p className="mx-auto mt-2 max-w-[18rem] text-sm text-muted-foreground italic line-clamp-3">{advisor.description}</p>}
          </div>
        </div>

        <div className="mt-6 space-y-2 text-xs text-muted-foreground">
          {advisor?.email && <p className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5" />{advisor.email}</p>}
          {advisor?.telephone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{advisor.telephone}</p>}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2">
          <Button className="gap-2" onClick={openAssistant}>
            <MessageCircle className="w-4 h-4" /> Contacter
          </Button>
        </div>
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profil conseiller</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-5">
              {advisor?.avatar_url ? (
                <img src={advisor.avatar_url} alt={displayName} className="w-full sm:w-60 aspect-square rounded-2xl object-cover border border-border" />
              ) : (
                <div className="w-full sm:w-60 aspect-square rounded-2xl bg-primary/10 flex items-center justify-center text-4xl font-semibold text-primary border border-border">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h3 className="text-2xl font-semibold text-foreground">{displayName}</h3>
                  <p className="text-muted-foreground">{role}</p>
                </div>
                {advisor?.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="w-4 h-4" />{advisor.email}</p>}
                {advisor?.telephone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-4 h-4" />{advisor.telephone}</p>}
                <Button className="gap-2" onClick={openAssistant}><MessageCircle className="w-4 h-4" /> Ouvrir la messagerie</Button>
              </div>
            </div>
            {advisor?.description && <section><h4 className="font-semibold text-foreground mb-2">À propos</h4><p className="text-sm text-muted-foreground italic">{advisor.description}</p></section>}
            {advisor?.biographie && <section><h4 className="font-semibold text-foreground mb-2">Parcours & expérience</h4><p className="text-sm text-muted-foreground whitespace-pre-wrap">{advisor.biographie}</p></section>}
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default ClientDashboard;
