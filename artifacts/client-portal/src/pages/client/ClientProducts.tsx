import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Package, TrendingUp, PiggyBank, Landmark, ShieldCheck,
  Bitcoin, LayoutGrid, TrendingUpDown, Building2, Layers,
  ChevronRight, ArrowLeft, ArrowRight, Search, SlidersHorizontal, Sparkles,
  Lock, Unlock,
} from 'lucide-react';
import { useClientProducts } from '@/hooks/useClientData';
import { logConnection } from '@/lib/connectionLog';
import { ClientListPageSkeleton } from '@/components/client-portal/ClientPageFallback';
import livretImg from '@/assets/category-livret.jpg';
import compteThemeImg from '@/assets/category-compte-theme.jpg';
import assuranceVieImg from '@/assets/category-assurance-vie.jpg';
import cryptoImg from '@/assets/category-crypto.jpg';

const CATEGORY_IMAGES: Record<string, string> = {
  livret_d_epargne:  livretImg,
  livret:            livretImg,
  compte_a_terme:    compteThemeImg,
  compte_a_theme:    compteThemeImg,
  assurance_vie:     assuranceVieImg,
  crypto:            cryptoImg,
};

type CategoryMeta = {
  label: { fr: string; en: string };
  icon: React.ElementType;
  color: string;
  gradient: string;
  accent: string;
  filterKey: string;
  description: { fr: string; en: string };
};

const CATEGORY_META: Record<string, CategoryMeta> = {
  livret_d_epargne: {
    label: { fr: "Livret d'épargne", en: 'Savings Account' },
    icon: PiggyBank,
    color: 'text-emerald-400',
    gradient: 'from-emerald-900/90 via-emerald-800/60 to-transparent',
    accent: 'bg-emerald-500/20 border-emerald-400/30',
    filterKey: 'savings',
    description: {
      fr: 'Faites fructifier votre épargne avec des rendements garantis et une disponibilité totale.',
      en: 'Grow your savings with guaranteed returns and full liquidity.',
    },
  },
  livret: {
    label: { fr: "Livret d'épargne", en: 'Savings Account' },
    icon: PiggyBank,
    color: 'text-emerald-400',
    gradient: 'from-emerald-900/90 via-emerald-800/60 to-transparent',
    accent: 'bg-emerald-500/20 border-emerald-400/30',
    filterKey: 'savings',
    description: {
      fr: 'Faites fructifier votre épargne avec des rendements garantis et une disponibilité totale.',
      en: 'Grow your savings with guaranteed returns and full liquidity.',
    },
  },
  compte_a_terme: {
    label: { fr: 'Compte à terme', en: 'Term Deposit' },
    icon: Landmark,
    color: 'text-blue-400',
    gradient: 'from-blue-900/90 via-blue-800/60 to-transparent',
    accent: 'bg-blue-500/20 border-blue-400/30',
    filterKey: 'savings',
    description: {
      fr: "Bloquez votre capital sur une durée définie et profitez d'un taux d'intérêt attractif.",
      en: 'Lock your capital for a set period and benefit from an attractive interest rate.',
    },
  },
  compte_a_theme: {
    label: { fr: 'Compte à terme', en: 'Term Deposit' },
    icon: Landmark,
    color: 'text-blue-400',
    gradient: 'from-blue-900/90 via-blue-800/60 to-transparent',
    accent: 'bg-blue-500/20 border-blue-400/30',
    filterKey: 'savings',
    description: {
      fr: "Bloquez votre capital sur une durée définie et profitez d'un taux d'intérêt attractif.",
      en: 'Lock your capital for a set period and benefit from an attractive interest rate.',
    },
  },
  contrat_capi: {
    label: { fr: 'Contrat de capitalisation', en: 'Capitalisation Contract' },
    icon: TrendingUpDown,
    color: 'text-indigo-400',
    gradient: 'from-indigo-900/90 via-indigo-800/60 to-transparent',
    accent: 'bg-indigo-500/20 border-indigo-400/30',
    filterKey: 'investment',
    description: {
      fr: 'Constituez un capital à long terme avec une fiscalité avantageuse et une gestion souple.',
      en: 'Build long-term capital with favourable tax treatment and flexible management.',
    },
  },
  assurance_vie: {
    label: { fr: 'Assurance vie', en: 'Life Insurance' },
    icon: ShieldCheck,
    color: 'text-purple-400',
    gradient: 'from-purple-900/90 via-purple-800/60 to-transparent',
    accent: 'bg-purple-500/20 border-purple-400/30',
    filterKey: 'insurance',
    description: {
      fr: "Préparez l'avenir avec la souplesse et les avantages fiscaux de l'assurance vie.",
      en: 'Prepare for the future with the flexibility and tax benefits of life insurance.',
    },
  },
  produit_structure: {
    label: { fr: 'Produit structuré', en: 'Structured Product' },
    icon: Layers,
    color: 'text-orange-400',
    gradient: 'from-orange-900/90 via-orange-800/60 to-transparent',
    accent: 'bg-orange-500/20 border-orange-400/30',
    filterKey: 'investment',
    description: {
      fr: "Des solutions d'investissement sur mesure combinant performance et protection du capital.",
      en: 'Tailored investment solutions combining performance and capital protection.',
    },
  },
  immobilier: {
    label: { fr: 'Immobilier', en: 'Real Estate' },
    icon: Building2,
    color: 'text-teal-400',
    gradient: 'from-teal-900/90 via-teal-800/60 to-transparent',
    accent: 'bg-teal-500/20 border-teal-400/30',
    filterKey: 'investment',
    description: {
      fr: 'Investissez dans la pierre avec nos solutions immobilières diversifiées et accessibles.',
      en: 'Invest in property with our diversified and accessible real estate solutions.',
    },
  },
  crypto: {
    label: { fr: 'Cryptomonnaies', en: 'Cryptocurrencies' },
    icon: Bitcoin,
    color: 'text-amber-400',
    gradient: 'from-amber-900/90 via-amber-800/60 to-transparent',
    accent: 'bg-amber-500/20 border-amber-400/30',
    filterKey: 'crypto',
    description: {
      fr: 'Accédez aux marchés des actifs numériques avec une gestion sécurisée et encadrée.',
      en: 'Access digital asset markets with secure and regulated management.',
    },
  },
  autre: {
    label: { fr: 'Autres placements', en: 'Other Investments' },
    icon: Package,
    color: 'text-slate-400',
    gradient: 'from-slate-900/90 via-slate-800/60 to-transparent',
    accent: 'bg-slate-500/20 border-slate-400/30',
    filterKey: 'other',
    description: {
      fr: "Découvrez nos solutions d'investissement alternatives et diversifiez votre portefeuille.",
      en: 'Discover our alternative investment solutions and diversify your portfolio.',
    },
  },
};

const CATEGORY_ORDER = [
  'livret_d_epargne', 'livret',
  'compte_a_terme', 'compte_a_theme',
  'contrat_capi', 'assurance_vie',
  'produit_structure', 'immobilier',
  'crypto', 'autre',
];

function resolveCategory(product: { _category?: { slug?: string } | null; categorie?: string | null } | null | undefined): string {
  const slug = product?._category?.slug;
  if (slug) {
    const s = slug.trim().toLowerCase();
    if (CATEGORY_META[s]) return s;
    return s;
  }
  const raw = product?.categorie;
  if (!raw) return 'autre';
  const s = raw.trim().toLowerCase();
  if (CATEGORY_META[s]) return s;
  if (s.includes('livret'))                               return 'livret_d_epargne';
  if (s.includes('compte') || s.includes('terme') || s === 'cat') return 'compte_a_terme';
  if (s.includes('capitalisation') || s.includes('capi')) return 'contrat_capi';
  if (s.includes('assurance'))                            return 'assurance_vie';
  if (s.includes('structur'))                             return 'produit_structure';
  if (s.includes('immobilier'))                           return 'immobilier';
  if (s.includes('crypto'))                               return 'crypto';
  return raw.trim();
}

const ClientProducts = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { data: assignedData, isLoading: loading } = useClientProducts(clientAccount?.lead_id);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const FILTERS_DEF = [
    { key: 'all',        fr: 'Tous',           en: 'All' },
    { key: 'savings',    fr: 'Épargne',        en: 'Savings' },
    { key: 'insurance',  fr: 'Assurance Vie',  en: 'Life Insurance' },
    { key: 'investment', fr: 'Investissement', en: 'Investment' },
    { key: 'crypto',     fr: 'Crypto',         en: 'Crypto' },
  ];

  const [activeFilterKey, setActiveFilterKey] = useState('all');

  useEffect(() => {
    logConnection(clientAccount?.id, 'page_view', 'Mes Placements');
  }, []);

  const products: any[] = useMemo(() => {
    const seen = new Set<string>();
    return (assignedData || [])
      .map((item: any) => item?.products || null)
      .filter((p: any) => {
        if (!p?.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
  }, [assignedData]);

  const grouped: Record<string, any[]> = {};
  for (const product of products) {
    const cat = resolveCategory(product);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(product);
  }

  const sortedCats = [
    ...CATEGORY_ORDER.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)).sort(),
  ];

  const filteredCats = useMemo(() => {
    return sortedCats.filter(cat => {
      const meta = CATEGORY_META[cat];
      const matchesFilter =
        activeFilterKey === 'all' ||
        meta?.filterKey === activeFilterKey;
      const catLabel = meta?.label[lang] ?? cat;
      const matchesSearch =
        !search.trim() ||
        catLabel.toLowerCase().includes(search.toLowerCase()) ||
        (grouped[cat] || []).some((p: any) =>
          p?.nom?.toLowerCase().includes(search.toLowerCase())
        );
      return matchesFilter && matchesSearch;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedCats, activeFilterKey, search, lang]);

  if (loading) return <ClientListPageSkeleton />;

  // ── Category detail view ─────────────────────────────────────────────────
  if (selectedCat) {
    const meta = CATEGORY_META[selectedCat] || {
      label: { fr: selectedCat, en: selectedCat },
      icon: Package,
      color: 'text-slate-400',
      gradient: 'from-slate-900/90 via-slate-800/60 to-transparent',
      accent: 'bg-slate-500/20 border-slate-400/30',
      description: { fr: '', en: '' },
    };
    const Icon = meta.icon;
    const entries = grouped[selectedCat] || [];

    return (
      <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        {/* Back nav */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedCat(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            {lang === 'en' ? 'Back to investments' : 'Retour aux placements'}
          </button>
          <span className="text-border">›</span>
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${meta.color}`} />
            <span className="text-sm font-semibold text-foreground">{meta.label[lang]}</span>
          </div>
          <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {entries.length} {lang === 'en' ? (entries.length > 1 ? 'products' : 'product') : `produit${entries.length > 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {entries.map((product: any) => {
            const catKey = resolveCategory(product);
            const heroImg = product.image_url || CATEGORY_IMAGES[product?._category?.slug] || CATEGORY_IMAGES[catKey];
            const pm = CATEGORY_META[catKey] || meta;
            const catSlug = product?._category?.slug || product?.categorie || '';
            const isLocked = catSlug === 'compte_a_terme' || catSlug === 'compte_a_theme';
            return (
              <button
                key={product.id}
                onClick={() => navigate(`/client/products/${product.id}`)}
                className="group relative rounded-3xl overflow-hidden border border-white/10 bg-card hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 text-left"
                style={{ boxShadow: '0 4px 24px -8px rgba(0,0,0,0.18)' }}
              >
                <div className="relative h-44 overflow-hidden bg-muted">
                  {heroImg ? (
                    <img
                      src={heroImg}
                      alt={product.nom}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <Icon className={`w-14 h-14 opacity-15 ${pm.color}`} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                  {product.interets && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-black/40 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-full">
                        <Sparkles className="w-3 h-3 text-[#c9a84c]" />
                        {product.interets}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-foreground text-base leading-tight">{product.nom}</h3>
                    {product.duree && (
                      <p className="text-xs text-muted-foreground mt-0.5">{product.duree}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {product.interets && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/25 px-2 py-0.5 rounded-full">
                        <TrendingUp className="w-2.5 h-2.5" />
                        {product.interets}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      isLocked
                        ? 'text-orange-500 bg-orange-500/10 border-orange-400/25'
                        : 'text-emerald-500 bg-emerald-500/10 border-emerald-400/25'
                    }`}>
                      {isLocked
                        ? <Lock className="w-2.5 h-2.5" />
                        : <Unlock className="w-2.5 h-2.5" />}
                      {isLocked
                        ? (lang === 'en' ? 'Locked funds' : 'Fonds bloqués')
                        : (lang === 'en' ? 'Available funds' : 'Fonds disponibles')}
                    </span>
                    {product.prix_minimum && (
                      <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {lang === 'en' ? 'From' : 'Dès'} {Number(product.prix_minimum).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')} €
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <span className="text-xs font-semibold text-primary">{t.products.discover}</span>
                    <div className="w-7 h-7 rounded-full bg-primary/10 group-hover:bg-primary flex items-center justify-center transition-all duration-200">
                      <ArrowRight className="w-3.5 h-3.5 text-primary group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>

                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ring-2 ring-primary/30" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Category overview ────────────────────────────────────────────────────
  return (
    <div className="space-y-0 animate-in fade-in-0 duration-300">

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl mb-6 bg-gradient-to-br from-[#111111] via-[#1a1a1a] to-[#080808] shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)]">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />

        <div className="relative px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center shadow-lg shrink-0">
                <LayoutGrid className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/60 font-semibold mb-1">
                  {lang === 'en' ? 'Investment space' : 'Espace investissement'}
                </p>
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                  {lang === 'en' ? 'Products & Investments' : 'Produits & Placements'}
                </h1>
                <p className="text-sm text-white/65 mt-1 max-w-md">
                  {lang === 'en'
                    ? 'Discover our savings and investment solutions tailored to your goals.'
                    : "Découvrez nos solutions d'épargne et d'investissement adaptées à vos objectifs."}
                </p>
              </div>
            </div>
            {/* Summary pill */}
            <div className="shrink-0 inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-4 py-2.5 self-start sm:self-auto">
              <TrendingUp className="w-4 h-4 text-white/70" />
              <span className="text-sm font-semibold text-white whitespace-nowrap">
                {sortedCats.length} {lang === 'en' ? (sortedCats.length > 1 ? 'categories' : 'category') : `catégorie${sortedCats.length > 1 ? 's' : ''}`}&nbsp;
                <span className="text-white/50">•</span>&nbsp;
                {products.length} {lang === 'en' ? (products.length > 1 ? 'products' : 'product') : `produit${products.length > 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* Search + filters row */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder={lang === 'en' ? 'Search a product or category…' : 'Rechercher un produit ou une catégorie…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 backdrop-blur border border-white/20 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <SlidersHorizontal className="w-3.5 h-3.5 text-white/40 shrink-0" />
              {FILTERS_DEF.map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilterKey(f.key)}
                  className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all duration-150 ${
                    activeFilterKey === f.key
                      ? 'bg-white text-[hsl(var(--primary))] border-white shadow-sm'
                      : 'bg-white/10 text-white/75 border-white/20 hover:bg-white/20'
                  }`}
                >
                  {f[lang]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Category cards grid ──────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="bg-card rounded-3xl p-14 border shadow-sm text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {lang === 'en' ? 'No products available at this time' : 'Aucun produit disponible pour le moment'}
          </p>
        </div>
      ) : filteredCats.length === 0 ? (
        <div className="bg-card rounded-3xl p-14 border shadow-sm text-center">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {lang === 'en' ? 'No category matches your search' : 'Aucune catégorie ne correspond à votre recherche'}
          </p>
          <button
            onClick={() => { setSearch(''); setActiveFilterKey('all'); }}
            className="mt-3 text-sm text-primary hover:underline"
          >
            {lang === 'en' ? 'Reset filters' : 'Réinitialiser les filtres'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {filteredCats.map(cat => {
            const meta = CATEGORY_META[cat] || {
              label: { fr: cat, en: cat },
              icon: Package,
              color: 'text-slate-400',
              gradient: 'from-slate-900/90 via-slate-800/60 to-transparent',
              accent: 'bg-slate-500/20 border-slate-400/30',
              description: {
                fr: "Explorez cette catégorie de placement.",
                en: 'Explore this investment category.',
              },
            };
            const Icon = meta.icon;
            const entries = grouped[cat];
            const heroImg = CATEGORY_IMAGES[cat] || entries[0]?.image_url;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className="group relative rounded-3xl overflow-hidden border border-white/8 text-left transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.015]"
                style={{ minHeight: '240px', boxShadow: '0 4px 20px -6px rgba(0,0,0,0.22)' }}
              >
                {heroImg ? (
                  <img
                    src={heroImg}
                    alt={meta.label[lang]}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
                )}

                <div className={`absolute inset-0 bg-gradient-to-t ${meta.gradient}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ring-2 ring-white/20" />

                <div className="absolute inset-0 flex flex-col justify-between p-5">
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg">
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                    </div>
                    <span className="inline-flex items-center text-[11px] font-semibold text-white/80 bg-white/10 backdrop-blur border border-white/20 px-2.5 py-1 rounded-full">
                      {entries.length} {lang === 'en' ? (entries.length > 1 ? 'products' : 'product') : `produit${entries.length > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-white font-bold text-lg leading-snug">{meta.label[lang]}</p>
                      <p className="text-white/60 text-xs mt-1 leading-relaxed line-clamp-2">
                        {meta.description[lang]}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/15">
                      <span className="text-xs font-bold text-white/80 tracking-wide group-hover:text-white transition-colors">
                        {t.products.discover}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center group-hover:bg-white group-hover:border-white transition-all duration-200 shadow-sm">
                        <ArrowRight className="w-3.5 h-3.5 text-white group-hover:text-[hsl(var(--primary))] transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientProducts;
