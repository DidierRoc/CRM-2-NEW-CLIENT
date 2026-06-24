const normalizeContractText = (value: unknown) =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const isLegacyContractHtml = (value: unknown) => {
  const normalized = normalizeContractText(value);
  if (!normalized) return false;

  return (
    (normalized.includes('document genere electroniquement') && normalized.includes('valeur contractuelle apres signature')) ||
    (normalized.includes('conformement au rgpd') && normalized.includes('donnees personnelles sont traitees'))
  );
};

export const isVisuallyPoorContractHtml = (value: unknown) => {
  const source = decodeContractHtml(value);
  if (!source.trim()) return true;

  const visualMarkers = [
    /style\s*=/i,
    /<style[\s>]/i,
    /class\s*=/i,
    /data-contract-brand-block/i,
    /background\s*:/i,
    /linear-gradient/i,
    /border(?:-|\s*:)/i,
    /font-size\s*:/i,
    /color\s*:/i,
    /<table[\s>]/i,
    /<img[\s>]/i,
  ];

  return visualMarkers.filter((marker) => marker.test(source)).length < 2;
};

export const CONTRACT_UNAVAILABLE_HTML = '<p>Contrat indisponible</p>';

const isFullHtmlDocument = (value: string) => /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(value);

const getContractStyleKind = (value: string) => {
  const match = value.match(/<!--\s*contract-style\s*:\s*([a-z0-9_-]+)\s*-->/i);
  return (match?.[1] || '').toLowerCase();
};

const stripCrmPreviewWrapper = (value: string) => value
  .replace(/^\s*<div\s+style=["']font-family\s*:\s*Inter\s*,\s*system-ui\s*,\s*sans-serif\s*;\s*color\s*:\s*#1e293b\s*;\s*line-height\s*:\s*1\.6\s*;?["']\s*>/i, '')
  .replace(/<\/div>\s*$/i, '')
  .trim();

const buildContractShellCss = (kind: string) => {
  if (kind === 'fund') {
    return `
      html,body{margin:0;background:#f1f5f2;color:#183126;font-family:Arial,Helvetica,sans-serif;}
      .contract-page{width:794px;min-height:1123px;margin:0 auto;background:#fbfff9;padding:52px 58px;box-sizing:border-box;border-top:12px solid #2f6b4f;box-shadow:0 18px 45px rgba(24,49,38,.14);}
      .contract-brand{background:linear-gradient(135deg,#183126 0%,#2f6b4f 100%);color:#fff;border-radius:2px;padding:22px 24px;margin-bottom:32px;display:flex;justify-content:space-between;gap:24px;}
      .contract-brand h1{margin:0;color:#fff;font-size:23px;letter-spacing:.8px;text-transform:uppercase;}
      .contract-brand p{margin:4px 0;color:rgba(255,255,255,.78);font-size:12px;}
      h1,h2,h3{color:#183126;} h2{border-bottom:2px solid #c7a760;padding-bottom:8px;color:#2f6b4f;}
      strong{color:#183126;} table{border-color:#d8e4dc;} .contract-footer{border-top:2px solid #c7a760;margin-top:34px;padding-top:14px;}
      .contract-footer p{margin:4px 0;color:#5d6f64;font-size:12px;}
    `;
  }

  if (kind === 'bank') {
    return `
      html,body{margin:0;background:#eef3f8;color:#14263d;font-family:Arial,Helvetica,sans-serif;}
      .contract-page{width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:54px 58px;box-sizing:border-box;}
      .contract-brand{border-bottom:4px solid #1B3A5C;padding-bottom:18px;margin-bottom:30px;display:flex;justify-content:space-between;gap:24px;}
      .contract-brand h1{margin:0;color:#1B3A5C;font-size:24px;letter-spacing:.5px;}
      .contract-brand p,.contract-footer p{margin:3px 0;color:#52657a;font-size:12px;}
      h1,h2,h3{color:#1B3A5C;} h2{border-left:4px solid #D4562A;padding-left:12px;}
      strong{color:#10243b;} .contract-footer{border-top:1px solid #d8e1ea;margin-top:34px;padding-top:14px;}
    `;
  }

  if (kind === 'classic') {
    return `
      html,body{margin:0;background:#f5f5f5;color:#202124;font-family:Georgia,'Times New Roman',serif;}
      .contract-page{width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:56px;box-sizing:border-box;}
      .contract-brand{border-bottom:1px solid #202124;padding-bottom:16px;margin-bottom:28px;}
      .contract-brand h1{margin:0;font-size:25px;font-weight:400;}
      .contract-brand p,.contract-footer p{margin:4px 0;color:#555;font-size:12px;}
      h2{font-size:15px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #ddd;padding-bottom:7px;}
      .contract-footer{border-top:1px solid #ddd;margin-top:34px;padding-top:14px;}
    `;
  }

  return `
    html,body{margin:0;background:#efe8db;color:#2d2418;font-family:Georgia,'Times New Roman',serif;}
    .contract-page{width:794px;min-height:1123px;margin:0 auto;background:linear-gradient(180deg,#fffdf8 0%,#f8f2e7 100%);padding:58px 62px;box-sizing:border-box;border-left:10px solid #b08a3c;}
    .contract-brand{border-bottom:1px solid rgba(176,138,60,.45);padding-bottom:18px;margin-bottom:30px;display:flex;justify-content:space-between;gap:24px;}
    .contract-brand h1{margin:0;color:#6f4f16;font-size:27px;font-weight:400;letter-spacing:1px;text-transform:uppercase;}
    .contract-brand p,.contract-footer p{margin:4px 0;color:#6a5b45;font-size:12px;}
    h1,h2,h3{color:#7a581b;} h2{color:#8a641f;border-bottom:1px solid rgba(176,138,60,.35);padding-bottom:8px;}
    strong{color:#4b3511;} .contract-footer{border-top:1px solid rgba(176,138,60,.35);margin-top:34px;padding-top:14px;}
  `;
};

const buildContractBrandHeader = () => `
  <header class="contract-brand" data-contract-brand-block="true">
    <div>
      <h1>Groupe FMC</h1>
      <p>Contrat de souscription</p>
    </div>
    <div style="text-align:right;">
      <p>Groupe FMC</p>
    </div>
  </header>
`.trim();

const buildContractLegalFooter = () => `
  <footer class="contract-footer" data-contract-legal-footer="true">
    <p>Document contractuel généré électroniquement. La signature électronique vaut acceptation des conditions du contrat.</p>
    <p>Les informations du souscripteur sont utilisées exclusivement dans le cadre de la relation contractuelle.</p>
  </footer>
`.trim();

export const extractPdfUrl = (html: string): string | null => {
  // Priority 1 — explicit data-pdf-url attribute set by the edge function / template editor
  const attrMatch = html.match(/data-pdf-url=["']([^"']+)["']/i);
  if (attrMatch?.[1]) return attrMatch[1];

  // Priority 2 — any href pointing to a .pdf file (Supabase storage URLs etc.)
  const hrefMatch = html.match(/href=["']([^"']+\.pdf[^"']*)["']/i);
  if (hrefMatch?.[1]) return hrefMatch[1];

  return null;
};

export const decodeContractHtml = (value: unknown) => {
  const source = String(value || '').trim();
  if (!source) return '';
  if (!/&(?:lt|gt|amp|quot|#39);/i.test(source)) return source;

  const textarea = document.createElement('textarea');
  textarea.innerHTML = source;
  return textarea.value.trim();
};

export const buildContractRenderHtml = (html: unknown) => {
  const decoded = decodeContractHtml(html);
  const source = stripCrmPreviewWrapper(decoded);
  if (!source) return '';
  if (isFullHtmlDocument(source)) return source;

  const baseHref = typeof document !== 'undefined' ? document.baseURI : '/';
  const kind = getContractStyleKind(source);

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="${baseHref}" target="_blank" />
    <style>${buildContractShellCss(kind)}</style>
  </head>
  <body><main class="contract-page">${source}</main></body>
</html>`;
};

const normalizeMarkerText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const serializeParsedContract = (parsed: Document, fullDocument: boolean) => {
  const html = parsed.documentElement.outerHTML;
  return fullDocument ? `<!doctype html>\n${html}` : parsed.body.innerHTML;
};

const buildClientSignatureHtml = (signatureData: string) => `
  <img
    data-rendered-client-signature="true"
    src="${signatureData}"
    alt="Signature client"
    style="display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;"
  />
`.trim();

export const applyClientSignatureToContractHtml = (
  html: unknown,
  signatureData?: string | null,
  _signedAt?: string | null,
) => {
  const source = decodeContractHtml(html);
  if (!source || !signatureData) return source;
  if (source.includes('data-rendered-client-signature="true"') || source.includes(signatureData)) return source;

  const signatureHtml = buildClientSignatureHtml(signatureData);
  const placeholderRegex = /(\{\{\s*(?:signature_client|client_signature|signature_souscripteur|signature_du_souscripteur)\s*\}\}|__(?:CLIENT_SIGNATURE|SIGNATURE_CLIENT|SIGNATURE_SOUSCRIPTEUR)__|\[(?:signature_client|client_signature|signature_souscripteur)\])/gi;
  if (placeholderRegex.test(source)) return source.replace(placeholderRegex, signatureHtml);

  const fullDocument = isFullHtmlDocument(source);
  const parser = new DOMParser();
  const parsed = parser.parseFromString(fullDocument ? source : `<!doctype html><html><body>${source}</body></html>`, 'text/html');

  const setTargetHtml = (target: HTMLElement) => {
    target.innerHTML = signatureHtml;
    target.setAttribute('data-client-signature-filled', 'true');
  };

  const elements = Array.from(parsed.body.querySelectorAll<HTMLElement>('*'));
  const explicitTarget = elements.find((el) => {
    const attrs = `${el.id || ''} ${el.className || ''} ${el.getAttribute('data-field') || ''} ${el.getAttribute('data-signature') || ''}`;
    const normalized = normalizeMarkerText(attrs);
    return normalized.includes('signature') && /(client|souscripteur|investisseur|titulaire)/.test(normalized) && !/(societe|conseiller|representant)/.test(normalized);
  });

  if (explicitTarget) {
    setTargetHtml(explicitTarget);
    return serializeParsedContract(parsed, fullDocument);
  }

  const label = elements.find((el) => {
    const normalized = normalizeMarkerText(el.textContent || '');
    return normalized.includes('signature') && /(client|souscripteur|investisseur|titulaire)/.test(normalized) && !/(societe|conseiller|representant)/.test(normalized);
  });

  if (label) {
    const container = label.closest('td, th, div, section, article') || label;
    const emptyBox = Array.from(container.querySelectorAll<HTMLElement>('td, div, span, p')).find((el) => {
      if (el === label || el.contains(label)) return false;
      const style = `${el.getAttribute('style') || ''} ${el.className || ''}`.toLowerCase();
      return el.textContent?.trim().length === 0 && /(signature|height|min-height|border-bottom|ligne|line)/.test(style);
    });

    if (emptyBox) setTargetHtml(emptyBox);
    else label.insertAdjacentHTML('beforeend', signatureHtml);

    return serializeParsedContract(parsed, fullDocument);
  }

  parsed.body.insertAdjacentHTML('beforeend', `<div data-client-signature-filled="true">${signatureHtml}</div>`);
  return serializeParsedContract(parsed, fullDocument);
};