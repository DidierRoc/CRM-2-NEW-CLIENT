interface ContractRenderData {
  leadData?: any;
  product?: any;
  amount?: number | string | null;
  signedAt?: string | Date | null;
  reference?: string | null;
  durationMonths?: number | null;
}

type CompanyBranding = {
  companyName?: string;
  companyAddress?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyPhone?: string;
  companyEmail?: string;
  companySiret?: string;
  companyCountry?: string;
  primaryColor?: string;
  accentColor?: string;
  contractLogoUrl?: string | null;
  logoUrl?: string | null;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatLongDate = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const normalizeContractText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const LEGACY_CONTRACT_FOOTER_MARKERS = [
  'document genere electroniquement',
  'valeur contractuelle apres signature des deux parties',
  'conformement au rgpd',
  'vos donnees personnelles sont traitees de maniere confidentielle',
];

const hasLegacyContractFooterText = (value: string) => {
  const normalized = normalizeContractText(value);
  if (!normalized || normalized.length > 260) return false;

  const markersFound = LEGACY_CONTRACT_FOOTER_MARKERS.filter((marker) => normalized.includes(marker)).length;
  return markersFound >= 2;
};

const removeLegacyContractFooter = (html: string) => {
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<(?:p|div|footer|span|section)[^>]*>(?:(?!<\/(?:p|div|footer|span|section)>).)*?(?:document\s+g[ée]n[ée]r[ée]\s+[ée]lectroniquement|conform[ée]ment\s+au\s+rgpd|valeur\s+contractuelle|donn[ée]es\s+personnelles\s+sont\s+trait[ée]es)(?:(?!<\/(?:p|div|footer|span|section)>).)*?<\/(?:p|div|footer|span|section)>/gi, '')
      .replace(/<(?:footer|div|section)[^>]*>\s*(?:<(?:p|span|div)[^>]*>(?:(?!<\/(?:p|span|div)>).)*?(?:document\s+g[ée]n[ée]r[ée]|conform[ée]ment|valeur\s+contractuelle|donn[ée]es\s+personnelles)(?:(?!<\/(?:p|span|div)>).)*?<\/(?:p|span|div)>\s*)+<\/(?:footer|div|section)>/gi, '');
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const candidates = Array.from(document.body.querySelectorAll('div, footer, section, p, span'));
  const matchingNodes = candidates.filter((element) => hasLegacyContractFooterText(element.textContent || ''));
  const rootFooterNodes = matchingNodes.filter(
    (element) => !matchingNodes.some((other) => other !== element && other.contains(element)),
  );

  rootFooterNodes.forEach((element) => element.remove());
  return document.body.innerHTML;
};

export function parseRate(interets = ''): number {
  const match = interets.match(/([\d.,]+)\s*%/);
  if (!match) return 0;
  return parseFloat(match[1].replace(',', '.'));
}

export function parseDurationMonths(duree = ''): number {
  const monthsMatch = duree.match(/(\d+)\s*mois/i);
  if (monthsMatch) return parseInt(monthsMatch[1], 10);

  const yearsMatch = duree.match(/(\d+)\s*an/i);
  if (yearsMatch) return parseInt(yearsMatch[1], 10) * 12;

  return 12;
}

export function replaceContractPlaceholders(html: string, values: Record<string, string>): string {
  let result = html;

  result = result.replace(/<span[^>]*data-field="[^"]*"[^>]*>(.*?)<\/span>/gi, '$1');
  result = result.replace(/<span[^>]*class="[^"]*(?:font-mono|bg-primary)[^"]*"[^>]*>(.*?)<\/span>/gi, '$1');

  for (const [key, val] of Object.entries(values)) {
    result = result.split(key).join(escapeHtml(val || ''));
  }

  return result.replace(/\{\{[^}]*\}\}/g, '');
}

export const CATEGORY_LABELS: Record<string, string> = {
  livret: "Livret d'épargne",
  livret_d_epargne: "Livret d'épargne",
  compte_a_terme: 'Compte à terme',
  compte_a_theme: 'Compte à terme',
  assurance_vie: 'Assurance vie',
  assurance_capitalisation: 'Contrat de capitalisation',
  crypto: 'Cryptomonnaies',
  immobilier: 'Immobilier',
  produit_structure: 'Produit structuré',
};

export const formatProductCategory = (slug: string): string =>
  CATEGORY_LABELS[slug?.toLowerCase()] || slug || '';

/**
 * Every string that can appear in a contract template as a category label —
 * including correct labels, wrong spellings, and raw DB slugs.
 * Used by fixContractCategoryLabel to replace ALL variants.
 */
const ALL_CATEGORY_LABEL_VARIANTS: string[] = [
  // Correct labels (from CATEGORY_LABELS values)
  ...Object.values(CATEGORY_LABELS),
  // Wrong / legacy spellings that advisors may have typed directly in templates
  "Compte à Thème",
  "Compte à Theme",
  "Compte a Theme",
  "Compte a Thème",
  "compte à thème",
  "compte à theme",
  // Raw DB slugs that may have leaked into template text
  "compte_a_theme",
  "compte_a_terme",
  "livret_d_epargne",
  "assurance_vie",
  "produit_structure",
];

/**
 * Post-process a stored contract HTML snapshot to replace any wrong/legacy
 * category label with the correct one derived from the product's actual
 * `categorie` slug. Handles templates with hardcoded category text.
 */
export function fixContractCategoryLabel(html: string, actualCategorie: string): string {
  if (!html || !actualCategorie) return html;
  const correctLabel = formatProductCategory(actualCategorie);
  if (!correctLabel) return html;

  // Deduplicate variants, skip the correct label itself
  const variants = [...new Set(ALL_CATEGORY_LABEL_VARIANTS)].filter(v => v !== correctLabel);
  let result = html;
  for (const variant of variants) {
    if (result.includes(variant)) {
      result = result.split(variant).join(correctLabel);
    }
  }
  return result;
}

/**
 * Generate a unique contract reference in the format LP-YYYYMMDD-XXXXX
 * (5 random uppercase alphanumeric characters).
 */
export function generateContractReference(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `LP-${y}${m}${d}-${suffix}`;
}

/**
 * Inject a reference into an already-rendered HTML contract.
 * The Edge Function replaces {{reference_contrat}} with '' before returning,
 * so we need to patch it back in afterwards.
 * Handles two cases:
 *  1. The placeholder is still present (e.g. locally-rendered template)
 *  2. The placeholder was replaced by empty string → find the <td> that follows
 *     the "Référence du contrat" label cell and fill it.
 */
export function injectReferenceIntoHtml(html: string, reference: string): string {
  if (!reference) return html;

  // Case 1: placeholder still present
  if (html.includes('{{reference_contrat}}')) {
    return html.replace(/\{\{reference_contrat\}\}/g, reference);
  }

  // Case 2: find the rendered empty cell after the label
  // Matches: <td ...>Référence du contrat</td>  <td ...></td>
  return html.replace(
    /(<td[^>]*>\s*R[eé]f[eé]rence\s+du\s+contrat\s*<\/td>\s*)(<td[^>]*>)\s*(<\/td>)/gi,
    `$1$2${reference}$3`,
  );
}

export function buildContractPlaceholderValues({
  leadData,
  product,
  amount,
  signedAt,
  reference,
  durationMonths,
  companyBranding,
}: ContractRenderData & { companyBranding?: CompanyBranding }): Record<string, string> {
  const safeAmount = toNumber(amount);
  const signatureDate = signedAt ? new Date(signedAt) : new Date();
  const safeDuration = durationMonths ?? parseDurationMonths(product?.duree || '12 mois');
  let contractEndDate = '';

  if (!Number.isNaN(signatureDate.getTime()) && safeDuration > 0) {
    const endDate = new Date(signatureDate);
    endDate.setMonth(endDate.getMonth() + safeDuration);
    contractEndDate = formatLongDate(endDate);
  }

  return {
    '{{civilite}}': leadData?.civilite || '',
    '{{prenom}}': leadData?.prenom || '',
    '{{prenom_client}}': leadData?.prenom || '',
    '{{nom}}': leadData?.nom || '',
    '{{nom_client}}': leadData?.nom || '',
    '{{email}}': leadData?.email || '',
    '{{email_client}}': leadData?.email || '',
    '{{telephone}}': leadData?.telephone || '',
    '{{telephone_client}}': leadData?.telephone || '',
    '{{adresse}}': leadData?.adresse || '',
    '{{adresse_client}}': leadData?.adresse || '',
    '{{code_postal}}': leadData?.code_postal || '',
    '{{ville}}': leadData?.ville || '',
    '{{nationalite}}': leadData?.nationalite || '',
    '{{produit_nom}}': product?.nom || '',
    '{{produit_categorie}}': formatProductCategory(product?.categorie || ''),
    '{{produit_risque}}': product?.risque || '',
    '{{produit_duree}}': product?.duree || '',
    '{{prix_minimum}}': product?.prix_minimum?.toString() || '',
    '{{prix_maximum}}': product?.prix_maximum?.toString() || '',
    '{{produit_interets}}': product?.interets || '',
    '{{produit_periode}}': product?.periode_disponibilite || '',
    '{{date_du_jour}}': formatLongDate(signatureDate),
    '{{date_signature}}': formatLongDate(signatureDate),
    '{{date_fin_contrat}}': contractEndDate,
    '{{reference_contrat}}': reference || '',
    '{{montant}}': safeAmount.toLocaleString('fr-FR'),
    '{{societe_nom}}': companyBranding?.companyName || '',
    '{{societe_adresse}}': companyBranding?.companyAddress || '',
    '{{societe_code_postal}}': companyBranding?.companyPostalCode || '',
    '{{societe_ville}}': companyBranding?.companyCity || '',
    '{{societe_telephone}}': companyBranding?.companyPhone || '',
    '{{societe_email}}': companyBranding?.companyEmail || '',
    '{{societe_siret}}': companyBranding?.companySiret || '',
    '{{societe_pays}}': companyBranding?.companyCountry || '',
    '{{societe_logo}}': '__COMPANY_LOGO__',
  };
}

export function buildCompanyLogoMarkup(branding?: CompanyBranding, variant: 'header' | 'inline' = 'inline'): string {
  if (!branding) return '';

  const logo = branding.contractLogoUrl || branding.logoUrl;
  if (!logo) return '';

  const maxHeight = variant === 'header' ? 88 : 64;
  const maxWidth = variant === 'header' ? 180 : 140;

  return `
    <img
      src="${logo}"
      alt="${escapeHtml(branding.companyName || 'Logo société')}"
      style="display:block;max-width:${maxWidth}px;max-height:${maxHeight}px;width:auto;height:auto;object-fit:contain;"
    />
  `.trim();
}

/**
 * Normalises legacy brand blocks: replaces any hardcoded company name text
 * inside a `[data-contract-brand-block]` element with the `{{societe_nom}}`
 * placeholder so the standard placeholder pipeline can fill it correctly.
 */
function normalizeLegacyBrandBlock(html: string): string {
  if (!html.includes('data-contract-brand-block')) return html;
  if (typeof document === 'undefined') return html;

  const doc = new DOMParser().parseFromString(`<div id="__norm__">${html}</div>`, 'text/html');
  const wrapper = doc.getElementById('__norm__');
  if (!wrapper) return html;

  const brandBlock = wrapper.querySelector<HTMLElement>('[data-contract-brand-block]');
  if (!brandBlock) return html;

  // Replace the h1 company title (old-style: <h1>Groupe FMC</h1>)
  brandBlock.querySelectorAll('h1').forEach((h1) => {
    if (!h1.querySelector('img') && !h1.textContent?.includes('{{')) {
      h1.textContent = '{{societe_nom}}';
    }
  });

  // Replace the right-column paragraph (old-style: <div style="text-align:right"><p>Groupe FMC</p></div>)
  const rightDiv =
    brandBlock.querySelector<HTMLElement>('[style*="text-align:right"]') ||
    brandBlock.querySelector<HTMLElement>('[style*="text-align: right"]');
  if (rightDiv) {
    rightDiv.querySelectorAll('p').forEach((p) => {
      if (!p.querySelector('img') && !p.textContent?.includes('{{')) {
        p.textContent = '{{societe_nom}}';
      }
    });
  }

  return wrapper.innerHTML;
}

export function renderContractHtml(
  templateContent: string | null | undefined,
  data: ContractRenderData,
  signatureBlock?: {
    acceptanceText: string;
    signatureDataUrl?: string | null;
    companySignatureUrl?: string | null;
    companyStampUrl?: string | null;
  },
  companyBranding?: CompanyBranding,
) {
  if (!templateContent?.trim()) {
    throw new Error('Template de contrat actif requis');
  }

  const brandingText = [
    companyBranding?.companyName,
    companyBranding?.companyAddress,
    companyBranding?.companyCity,
    companyBranding?.companyCountry,
  ].filter(Boolean).join(' ');

  if (/jupiter\s+asset\s+management|70\s+victoria\s+street|contrat\s+soci[ée]t[ée]/i.test(brandingText)) {
    throw new Error('Ancien branding contrat supprimé');
  }

  // Normalise any hardcoded company names in the legacy brand block before
  // running placeholder replacement so {{societe_nom}} resolves correctly.
  const normalizedTemplate = normalizeLegacyBrandBlock(templateContent);

  const rendered = replaceContractPlaceholders(normalizedTemplate, buildContractPlaceholderValues({ ...data, companyBranding }))
    .split('__COMPANY_LOGO__')
    .join(buildCompanyLogoMarkup(companyBranding, 'inline'));

  return rendered;
}

export function buildSignatureBlockHtml({
  signatureDataUrl,
  companyStampUrl,
  signedAt,
}: {
  signatureDataUrl?: string | null;
  companyStampUrl?: string | null;
  /** ISO date string or Date — defaults to now */
  signedAt?: string | Date | null;
}): string {
  const dateObj = signedAt ? new Date(signedAt) : new Date();
  const signatureDate = formatLongDate(Number.isFinite(dateObj.getTime()) ? dateObj : new Date());

  const clientSigContent = signatureDataUrl
    ? `<img src="${signatureDataUrl}" alt="Signature de l'investisseur" style="max-height:100px;max-width:80%;object-fit:contain;" />`
    : `<span style="color:#b0b0b0;font-size:12px;font-style:italic;">En attente de la signature</span>`;

  const mapleSignatureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 72" width="260" height="58" style="display:block;margin:4px auto 0;"><text x="10" y="52" font-family="'Brush Script MT','Segoe Script','URW Chancery L','Comic Sans MS',cursive" font-size="40" fill="#1a2540" letter-spacing="2">Maple Finance</text><path d="M8,62 Q160,57 312,62" stroke="#1a2540" stroke-width="0.8" fill="none" opacity="0.28"/></svg>`;
  const companySigContent = companyStampUrl
    ? `<img src="${companyStampUrl}" alt="Cachet de la société" style="max-height:120px;max-width:70%;object-fit:contain;" />`
    : mapleSignatureSvg;

  return `<div data-contract-signature-block="true" style="margin-top:28px;page-break-inside:avoid;">
  <table style="width:100%;border-collapse:separate;border-spacing:24px 0;table-layout:fixed;"><tr>
    <td style="width:50%;vertical-align:top;">
      <div style="background:#B8893E;color:#fff;text-align:center;font-weight:700;letter-spacing:2px;font-size:13px;padding:11px;border-radius:6px 6px 0 0;">INVESTOR</div>
      <div style="border:1px solid #d8d8d8;border-top:none;border-radius:0 0 6px 6px;min-height:170px;padding:16px 12px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#fff;">
        ${clientSigContent}
        <p style="font-size:10px;color:#9ca3af;margin:0;">Signed on ${signatureDate}</p>
      </div>
    </td>
    <td style="width:50%;vertical-align:top;">
      <div style="background:#2C3E50;color:#fff;text-align:center;font-weight:700;letter-spacing:2px;font-size:13px;padding:11px;border-radius:6px 6px 0 0;">INVESTMENT HOUSE</div>
      <div style="border:1px solid #d8d8d8;border-top:none;border-radius:0 0 6px 6px;min-height:170px;padding:16px 12px;display:flex;align-items:center;justify-content:center;background:#fff;">
        ${companySigContent}
      </div>
    </td>
  </tr></table>
</div>`;
}

/**
 * Injects the signature block at the end of a contract HTML string.
 * Inserts just before </main> if present, then </body>, otherwise appends.
 */
export function appendSignatureBlockToHtml(
  contractHtml: string,
  opts: {
    signatureDataUrl?: string | null;
    companyStampUrl?: string | null;
    signedAt?: string | Date | null;
  },
): string {
  const block = buildSignatureBlockHtml(opts);

  if (contractHtml.includes('</main>')) {
    return contractHtml.replace('</main>', `${block}\n</main>`);
  }
  if (contractHtml.includes('</body>')) {
    return contractHtml.replace('</body>', `${block}\n</body>`);
  }
  return contractHtml + '\n' + block;
}

export function buildContractPdfData({
  sub,
  contract,
  product,
  leadData,
  templateHtml,
  companySignatureUrl,
  companyStampUrl,
  companyBranding,
}: {
  sub?: any;
  contract?: any;
  product?: any;
  leadData?: any;
  templateHtml?: string;
  companySignatureUrl?: string | null;
  companyStampUrl?: string | null;
  companyBranding?: any;
}) {
  const amount = toNumber(contract?.amount ?? sub?.amount);
  const durationMonths = toNumber(contract?.duration_months, parseDurationMonths(product?.duree || '12 mois'));
  const signedAt = contract?.signed_at || sub?.signed_at || new Date().toISOString();
  const reference = (contract as any)?.reference || '';

  // Signed contracts must keep their frozen HTML snapshot when available.
  let contractHtml = contract?.contract_html_snapshot || '';
  if (!contractHtml && templateHtml?.trim()) {
    const safeAmountFormatted = toNumber(contract?.amount ?? sub?.amount).toLocaleString('fr-FR');
    contractHtml = renderContractHtml(templateHtml, {
      leadData,
      product,
      amount,
      signedAt,
      reference,
      durationMonths,
    }, {
      acceptanceText: `J'ai lu et j'accepte les conditions générales du contrat de souscription et je confirme vouloir investir la somme de <strong>${safeAmountFormatted} €</strong> dans <strong>${product?.nom || 'ce produit'}</strong>.`,
      signatureDataUrl: contract?.signature_data || null,
      companySignatureUrl: companySignatureUrl || null,
      companyStampUrl: companyStampUrl || null,
    }, companyBranding);
  }

  return {
    productName: product?.nom || 'Produit',
    amount,
    durationMonths,
    interestRate: toNumber(contract?.interest_rate, parseRate(product?.interets || '0%')),
    signedAt,
    signatureData: contract?.signature_data || null,
    signerIp: contract?.signer_ip || null,
    clientName: [leadData?.prenom, leadData?.nom].filter(Boolean).join(' '),
    clientEmail: leadData?.email || '',
    clientPhone: leadData?.telephone || '',
    clientAddress: leadData?.adresse || '',
    clientCity: leadData?.ville || '',
    clientPostalCode: leadData?.code_postal || '',
    clientNationality: leadData?.nationalite || '',
    isJointAccount: contract?.is_joint_account || false,
    coName: contract?.co_nom ? `${contract?.co_prenom || ''} ${contract?.co_nom}`.trim() : '',
    coEmail: contract?.co_email || '',
    coPhone: contract?.co_telephone || '',
    coAddress: contract?.co_adresse || '',
    coCity: contract?.co_ville || '',
    coPostalCode: contract?.co_code_postal || '',
    coNationality: contract?.co_nationalite || '',
    coCivilite: contract?.co_civilite || '',
    contractHtml,
    reference,
  };
}