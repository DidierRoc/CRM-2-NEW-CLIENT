import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface SignaturePageData {
  clientName: string;
  clientCivility?: string;
  signatureData: string;
  signedAt: string;
  reference?: string | null;
  productName?: string;
  amount?: number;
}

/** Format an ISO date string as dd/mm/yyyy (French short format). */
function formatDateFr(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

interface CanvasBox {
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Scans every page for text items that are entirely a date in dd/mm/yyyy format.
 * Erases each one with a white rectangle and redraws the new signing date in its place.
 */
async function replaceDatesOnCanvases(
  pages: pdfjsLib.PDFPageProxy[],
  viewports: pdfjsLib.PageViewport[],
  canvases: HTMLCanvasElement[],
  newDate: string,
  scale: number,
): Promise<void> {
  const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

  for (let i = 0; i < pages.length; i++) {
    const textContent = await pages[i].getTextContent();
    const viewport = viewports[i];
    const ctx = canvases[i].getContext('2d')!;

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      // Strip leading/trailing punctuation or spaces so "21/01/2026," also matches
      const cleaned = item.str.trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
      if (!DATE_RE.test(cleaned)) continue;

      const [, , , , pdfX, pdfY] = item.transform as number[];
      const [cvX, cvY] = viewport.convertToViewportPoint(pdfX, pdfY);
      const itemH = ((item as any).height ?? 10) * scale;
      const itemW = Math.max(((item as any).width ?? 0) * scale, newDate.length * itemH * 0.55);

      // Erase old date — white rectangle slightly larger than the text bounding box
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cvX - 1, cvY - itemH * 1.25, itemW + 4, itemH * 1.6);

      // Draw new date at the same baseline position
      const fontSize = Math.max(8, itemH * 0.82);
      ctx.fillStyle = '#111111';
      ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(newDate, cvX, cvY);
    }
  }
}

/**
 * Finds "À L'ATTENTION DE" headers on every page and replaces the text item
 * directly below each one with the real client name (civility + name).
 * Samples canvas pixel colors so the erase rectangle and new text match
 * the original background/foreground (works on both dark and light headers).
 */
async function replaceClientNameOnCanvases(
  pages: pdfjsLib.PDFPageProxy[],
  viewports: pdfjsLib.PageViewport[],
  canvases: HTMLCanvasElement[],
  clientName: string,
  clientCivility: string,
  scale: number,
): Promise<void> {
  if (!clientName.trim()) return;

  const ATTENTION_RE = /a\s+l['']?attention\s+de/i;

  for (let i = 0; i < pages.length; i++) {
    const textContent = await pages[i].getTextContent();
    const viewport = viewports[i];
    const ctx = canvases[i].getContext('2d')!;

    type ItemPos = { str: string; cvX: number; cvY: number; itemH: number; itemW: number };
    const allItems: ItemPos[] = [];
    const headers: ItemPos[] = [];

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const [, , , , pdfX, pdfY] = item.transform as number[];
      const [cvX, cvY] = viewport.convertToViewportPoint(pdfX, pdfY);
      const itemH = ((item as any).height ?? 10) * scale;
      const itemW = ((item as any).width ?? 0) * scale;
      const pos: ItemPos = { str: item.str, cvX, cvY, itemH, itemW };
      allItems.push(pos);

      const norm = item.str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (ATTENTION_RE.test(norm)) headers.push(pos);
    }

    if (headers.length === 0) continue;

    for (const header of headers) {
      // Find the closest text item BELOW this header (in same column ±header width)
      let best: ItemPos | null = null;
      let bestDist = Infinity;

      for (const it of allItems) {
        if (it === header) continue;
        const dy = it.cvY - header.cvY;
        if (dy <= 0 || dy > 160 * scale) continue;
        const dx = Math.abs(it.cvX - header.cvX);
        if (dx > (header.itemW || 120) * 1.8) continue;
        if (!it.str.trim()) continue;
        if (dy < bestDist) { bestDist = dy; best = it; }
      }

      if (!best) continue;

      const { cvX, cvY, itemH, itemW } = best;

      // Sample background color just above the text (avoids sampling the glyph itself)
      const bgPx = ctx.getImageData(
        Math.max(0, Math.round(cvX + 4)),
        Math.max(0, Math.round(cvY - itemH * 1.6)),
        1, 1,
      ).data;
      const bgAvg = (bgPx[0] + bgPx[1] + bgPx[2]) / 3;
      const bgColor = `rgb(${bgPx[0]},${bgPx[1]},${bgPx[2]})`;
      const textColor = bgAvg < 128 ? '#ffffff' : '#111111';

      // Build the display name
      const civ = clientCivility ? clientCivility.replace(/\.?\s*$/, '.') + ' ' : '';
      const displayName = civ + clientName;
      const fontSize = Math.max(8, itemH * 0.82);
      ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
      const newW = Math.max(itemW, ctx.measureText(displayName).width) + 6;

      // Erase old name using sampled background color
      ctx.fillStyle = bgColor;
      ctx.fillRect(cvX - 1, cvY - itemH * 1.3, newW, itemH * 1.6);

      // Draw new client name
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(displayName, cvX, cvY);
    }
  }
}

/**
 * Scans text items across the LAST TWO pages only.
 * Collects all items whose full text normalises to exactly "INVESTOR".
 * Among those, picks the one with the smallest PDF y-value (= most bottom of page).
 * Returns canvas-space coordinates for the empty signature rectangle that sits
 * just below the copper header label.
 */
async function findInvestorBox(
  pages: pdfjsLib.PDFPageProxy[],
  viewports: pdfjsLib.PageViewport[],
  canvases: HTMLCanvasElement[],
  scale: number,
): Promise<CanvasBox | null> {
  // Check only the last two pages (signature pages are always at the end)
  const startIdx = Math.max(0, pages.length - 2);

  type Candidate = {
    pageIndex: number;
    pdfY: number;
    cvX: number;
    cvY: number;
    itemH: number;
    itemW: number;
  };
  const candidates: Candidate[] = [];

  for (let i = startIdx; i < pages.length; i++) {
    const page = pages[i];
    const viewport = viewports[i];
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!('str' in item)) continue;

      // Must be EXACTLY "INVESTOR" after stripping diacritics and uppercasing.
      const raw = (item.str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      if (raw !== 'INVESTOR') continue;

      const [, , , , pdfX, pdfY] = item.transform as number[];
      const [cvX, cvY] = viewport.convertToViewportPoint(pdfX, pdfY);
      const itemH = ((item as any).height ?? 10) * scale;
      // item.width is in PDF user units — convert to canvas pixels
      const itemW = ((item as any).width ?? 0) * scale;

      candidates.push({ pageIndex: i, pdfY, cvX, cvY, itemH, itemW });
    }
  }

  if (candidates.length === 0) return null;

  // Pick the LOWEST match (smallest pdfY = most bottom of the page)
  candidates.sort((a, b) => a.pdfY - b.pdfY);
  const best = candidates[0];

  const canvas = canvases[best.pageIndex];
  const ctx = canvas.getContext('2d')!;

  // ── X axis ────────────────────────────────────────────────────────────────
  // The "INVESTOR" text is CENTERED inside the copper header.
  const textCenter = best.cvX + best.itemW / 2;
  const boxW = Math.max(best.itemW * 2.2, canvas.width * 0.36);
  const boxX = Math.max(0, textCenter - boxW / 2);
  const scanX = Math.round(textCenter); // column to scan vertically

  // ── Y axis — pixel-scan to find white box start ────────────────────────────
  // Scan downward from cvY until we hit a run of light (white) pixels.
  // This avoids guessing the copper header bar height.
  const WHITE_THRESHOLD = 210; // r,g,b all above this → "white"
  const RUN_NEEDED = 4;        // consecutive white rows = box start confirmed
  let whiteRun = 0;
  let boxY = Math.round(best.cvY);
  const scanStart = Math.max(0, Math.round(best.cvY - best.itemH));
  for (let y = scanStart; y < canvas.height - RUN_NEEDED; y++) {
    const px = ctx.getImageData(Math.max(0, Math.min(scanX, canvas.width - 1)), y, 1, 1).data;
    const isLight = px[0] > WHITE_THRESHOLD && px[1] > WHITE_THRESHOLD && px[2] > WHITE_THRESHOLD;
    if (isLight) {
      whiteRun++;
      if (whiteRun >= RUN_NEEDED) {
        boxY = y - RUN_NEEDED + 1; // first white row
        break;
      }
    } else {
      whiteRun = 0;
    }
  }

  const boxH = Math.min(canvas.height - boxY - 4, canvas.height * 0.25);

  return { pageIndex: best.pageIndex, x: boxX, y: boxY, w: boxW, h: boxH };
}

/**
 * Fetches the PDF, renders every page on an offscreen canvas via pdf.js,
 * places the signature image inside the "INVESTOR" box on the last page,
 * then re-encodes the whole thing as a PDF via pdf-lib.
 */
export async function appendSignatureToPdf(
  pdfUrl: string,
  sig: SignaturePageData,
): Promise<Uint8Array> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error('Impossible de récupérer le contrat PDF');
  const pdfBytes = await res.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const SCALE = 2;

  // Render all pages first
  const pages: pdfjsLib.PDFPageProxy[] = [];
  const viewports: pdfjsLib.PageViewport[] = [];
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    pages.push(page);
    viewports.push(viewport);
    canvases.push(canvas);
  }

  // Locate the INVESTOR box
  const box = await findInvestorBox(pages, viewports, canvases, SCALE);

  // Draw the signature onto the correct canvas
  if (box) {
    const sigImage = await loadImage(sig.signatureData);
    const ctx = canvases[box.pageIndex].getContext('2d')!;

    const pad = 12;
    const availW = box.w - pad * 2;
    const availH = box.h - pad * 2;

    const iw = sigImage.naturalWidth || sigImage.width;
    const ih = sigImage.naturalHeight || sigImage.height;

    if (iw > 0 && ih > 0 && availW > 0 && availH > 0) {
      // Scale to fill the full WIDTH of the box (maintains aspect ratio).
      // This makes the signature as large and legible as possible.
      // Clip so it never overflows the box boundaries.
      const ratio = availW / iw;
      const sw = availW;
      const sh = ih * ratio;
      // Centre vertically; if taller than the box, start from the top
      const ox = box.x + pad;
      const oy = box.y + pad + Math.max(0, (availH - sh) / 2);

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.drawImage(sigImage, ox, oy, sw, sh);
      ctx.restore();
    }
  }

  // Replace the client name after every "À L'ATTENTION DE" header
  await replaceClientNameOnCanvases(
    pages, viewports, canvases,
    sig.clientName,
    sig.clientCivility ?? '',
    SCALE,
  );

  // Replace all dd/mm/yyyy dates in the document with the actual signing date
  const signingDate = formatDateFr(sig.signedAt);
  if (signingDate) {
    await replaceDatesOnCanvases(pages, viewports, canvases, signingDate, SCALE);
  }

  // Re-encode all canvases as a PDF
  const outDoc = await PDFDocument.create();

  for (const canvas of canvases) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    const jpgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const img = await outDoc.embedJpg(jpgBytes);

    const aspect = canvas.width / canvas.height;
    const pageH = 842;
    const pageW = Math.round(pageH * aspect);
    const pg = outDoc.addPage([pageW, pageH]);
    pg.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
  }

  return outDoc.save();
}
