import { callCrmApi } from '@/lib/crmApi';

export interface PortalBranding {
  logo_url: string | null;
  header_banner_url: string | null;
  header_logo_url: string | null;
  header_tagline: string;
  header_style: 'gradient' | 'image' | 'solid' | 'minimal';
  header_overlay_color: string;
  header_text_color: string;
  portal_title: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  sidebar_color: string;
  text_color: string;
  company_name: string;
  company_phone: string;
  company_email: string;
  company_address: string;
  company_city: string;
  company_postal_code: string;
  company_country: string;
  company_siret?: string;
  menu_config?: { key: string; label: string; visible: boolean }[];
}

export const PORTAL_BRANDING_CACHE_KEY = 'portal-branding-cache';
const PORTAL_BRANDING_CACHE_AT_KEY = 'portal-branding-cache-at';
const BRANDING_STALE_TIME = 5 * 60 * 1000;

export class PortalBrandingMissingError extends Error {
  constructor(message = 'Aucune configuration de portail active trouvée en base de données.') {
    super(message);
    this.name = 'PortalBrandingMissingError';
  }
}

const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
const pick = (...values: unknown[]) => values.find((value) => typeof value === 'string' && value.trim()) as string | undefined;
const str = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Normalise la réponse `public-config` en s'appuyant UNIQUEMENT sur la base.
 * Retourne `null` si la config active ne contient pas les champs essentiels
 * (couleurs + nom). Aucun fallback hardcodé n'est injecté ici.
 */
export function normalizePortalBranding(payload: any): PortalBranding | null {
  if (!payload) return null;
  const portal = payload?.portal || payload || {};
  const branding = payload?.branding || payload || {};

  const company_name = pick(portal.company_name, branding.company_name);
  const portal_title = pick(portal.portal_title, portal.title, branding.portal_title) || company_name;
  const primary_color = pick(portal.primary_color, branding.primary_color);
  const sidebar_color = pick(portal.sidebar_color, branding.sidebar_color);
  const background_color = pick(portal.background_color, branding.background_color);

  // Source de vérité unique : la DB. Sans ces champs essentiels => config invalide.
  if (!company_name || !portal_title || !primary_color || !sidebar_color || !background_color) {
    return null;
  }

  const headerStyle = pick(branding.header_style, portal.header_style);
  const logoUrl = pick(branding.contract_logo_url, portal.logo_url, branding.logo_url);

  return {
    logo_url: logoUrl || null,
    header_banner_url: pick(branding.header_banner_url, portal.header_banner_url) || null,
    header_logo_url: pick(branding.header_logo_url, portal.header_logo_url) || null,
    header_tagline: str(pick(branding.header_tagline, portal.header_tagline)),
    header_style: ['image', 'gradient', 'solid', 'minimal'].includes(headerStyle || '')
      ? (headerStyle as PortalBranding['header_style'])
      : 'gradient',
    header_overlay_color: pick(branding.header_overlay_color, portal.header_overlay_color) || 'rgba(0,0,0,0.4)',
    header_text_color: str(pick(branding.header_text_color, portal.header_text_color)),
    portal_title,
    primary_color,
    secondary_color: pick(portal.secondary_color, branding.secondary_color) || primary_color,
    accent_color: pick(portal.accent_color, branding.accent_color) || primary_color,
    background_color,
    sidebar_color,
    text_color: pick(portal.text_color, branding.text_color) || '#FFFFFF',
    company_name,
    company_phone: str(pick(portal.company_phone, branding.company_phone)),
    company_email: str(pick(portal.company_email, branding.company_email)),
    company_address: str(pick(portal.company_address, branding.company_address)),
    company_city: str(pick(portal.company_city, branding.company_city)),
    company_postal_code: str(pick(portal.company_postal_code, branding.company_postal_code)),
    company_country: str(pick(portal.company_country, branding.company_country)),
    company_siret: str(pick(portal.company_siret, branding.company_siret)),
    menu_config: Array.isArray(portal.menu_config) ? portal.menu_config : [],
  };
}

export function getCachedPortalBranding(): PortalBranding | null {
  try {
    const cached = localStorage.getItem(PORTAL_BRANDING_CACHE_KEY);
    return cached ? normalizePortalBranding(JSON.parse(cached)) : null;
  } catch {
    return null;
  }
}

export function cachePortalBranding(branding: PortalBranding) {
  try {
    localStorage.setItem(PORTAL_BRANDING_CACHE_KEY, JSON.stringify(branding));
    localStorage.setItem(PORTAL_BRANDING_CACHE_AT_KEY, String(Date.now()));
    applyPortalBrandingToHead(branding);
  } catch {}
}

export function isPortalBrandingFresh() {
  const cachedAt = Number(localStorage.getItem(PORTAL_BRANDING_CACHE_AT_KEY) || 0);
  return cachedAt > 0 && Date.now() - cachedAt < BRANDING_STALE_TIME;
}

/**
 * Récupère la configuration depuis la base via `public-config`
 * (qui retourne la ligne `client_portal_settings` où `is_active = true`).
 * Lève PortalBrandingMissingError si la DB ne contient aucune config valide.
 */
export async function fetchPortalBranding(): Promise<PortalBranding> {
  const data = await callCrmApi('public-config');
  const branding = normalizePortalBranding(data);
  if (!branding) {
    throw new PortalBrandingMissingError();
  }
  cachePortalBranding(branding);
  return branding;
}

export function applyPortalBrandingToHead(branding: PortalBranding | null) {
  if (typeof document === 'undefined' || !branding) return;
  const title = branding.portal_title || branding.company_name;
  const logo = emptyToNull(branding.logo_url);
  if (title) {
    document.title = title;
    const setMeta = (selector: string, attr: 'content', value: string) => {
      const el = document.head.querySelector<HTMLMetaElement>(selector);
      if (el) el.setAttribute(attr, value);
    };
    const description = `${title} - Espace Client privé`;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[name="apple-mobile-web-app-title"]', 'content', title);
    // Remove any non-tenant metadata leftovers (author, og, twitter)
    document.head
      .querySelectorAll('meta[name="author"], meta[property^="og:"], meta[name^="twitter:"]')
      .forEach((el) => el.remove());
  }

  let style = document.getElementById('portal-branding-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'portal-branding-style';
    document.head.appendChild(style);
  }
  style.textContent = `:root{--portal-primary:${branding.primary_color};--portal-accent:${branding.accent_color};--portal-sidebar:${branding.sidebar_color};--portal-bg:${branding.background_color};--portal-text:${branding.text_color};}`;

  if (logo) {
    const upsertLink = (rel: string, href: string, attrs: Record<string, string> = {}) => {
      let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]${attrs.sizes ? `[sizes="${attrs.sizes}"]` : ''}`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      Object.entries(attrs).forEach(([key, value]) => link!.setAttribute(key, value));
      link.href = href;
    };

    upsertLink('icon', logo, { type: 'image/png' });
    upsertLink('apple-touch-icon', logo);
    upsertLink('apple-touch-icon', logo, { sizes: '192x192' });
    upsertLink('apple-touch-icon', logo, { sizes: '512x512' });

    const manifest = {
      name: `${title} - Espace Client`,
      short_name: title,
      description: 'Votre espace client privé : portefeuille, contrats, retraits et trading.',
      start_url: '/client/dashboard',
      scope: '/client/',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'portrait',
      background_color: branding.sidebar_color,
      theme_color: branding.sidebar_color,
      categories: ['finance', 'business'],
      lang: 'fr',
      dir: 'ltr',
      icons: [
        { src: logo, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: logo, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };
    const manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
    upsertLink('manifest', manifestUrl);
  }
}
