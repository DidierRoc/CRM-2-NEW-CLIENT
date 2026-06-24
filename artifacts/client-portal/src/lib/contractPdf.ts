import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { applyClientSignatureToContractHtml, buildContractRenderHtml, decodeContractHtml } from '@/lib/clientContractPreview';

export interface ContractPdfData {
  productName: string;
  amount: number;
  durationMonths: number;
  interestRate: number;
  signedAt: string;
  signatureData?: string | null;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientCity?: string;
  clientPostalCode?: string;
  clientNationality?: string;
  signerIp?: string | null;
  isJointAccount?: boolean;
  coName?: string;
  coEmail?: string;
  coPhone?: string;
  coAddress?: string;
  coCity?: string;
  coPostalCode?: string;
  coNationality?: string;
  coCivilite?: string;
  contractHtml?: string;
  reference?: string;
}

function buildPdfHtml(data: ContractPdfData): string {
  if (data.contractHtml?.trim()) {
    return buildContractRenderHtml(applyClientSignatureToContractHtml(
      decodeContractHtml(data.contractHtml),
      data.signatureData,
      data.signedAt,
    ));
  }
  throw new Error('Contrat indisponible : aucun template actif lié au produit');
}

/** A4 constants */
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const RENDER_WIDTH_PX = 794; // A4 at 96dpi
const SCALE = 2;

/**
 * Selectors for elements whose top edge is a safe page-break point.
 * We never cut THROUGH these elements — only just before them.
 */
const SAFE_BREAK_SELECTORS =
  'tr, p, h1, h2, h3, h4, h5, h6, li, blockquote, hr, [data-pdf-section]';

/**
 * Collect the Y positions (in CSS pixels relative to the document root)
 * of every element that represents a safe place to break the page.
 */
function collectSafeBreakPoints(iframeDoc: Document): number[] {
  const container = iframeDoc.documentElement;
  const containerTop = container.getBoundingClientRect().top;
  const points = new Set<number>([0]);

  container.querySelectorAll(SAFE_BREAK_SELECTORS).forEach((el) => {
    const top = Math.round(el.getBoundingClientRect().top - containerTop);
    if (top > 0) points.add(top);
  });

  return Array.from(points).sort((a, b) => a - b);
}

/**
 * Draw a rectangular slice of `source` canvas (from y=startY to y=endY)
 * onto a new canvas and return it.
 */
function sliceCanvas(
  source: HTMLCanvasElement,
  startY: number,
  endY: number,
): HTMLCanvasElement {
  const h = endY - startY;
  const dst = document.createElement('canvas');
  dst.width = source.width;
  dst.height = h;
  const ctx = dst.getContext('2d')!;
  ctx.drawImage(source, 0, -startY);
  return dst;
}

/**
 * Add a canvas slice to the PDF document.
 * The slice fills the full page width and its proportional height.
 * If `addPage` is true a new page is created first.
 */
function addCanvasSliceToPdf(
  doc: jsPDF,
  source: HTMLCanvasElement,
  startY: number,
  endY: number,
  addPage: boolean,
): void {
  const h = endY - startY;
  if (h <= 0) return;

  if (addPage) doc.addPage();

  const slice = sliceCanvas(source, startY, endY);
  const imgData = slice.toDataURL('image/png');
  // Maintain correct aspect ratio: full A4 width, proportional height
  const imgHeightMm = (h / source.width) * PAGE_W_MM;
  doc.addImage(imgData, 'PNG', 0, 0, PAGE_W_MM, imgHeightMm);
}

export const generateContractPdf = async (data: ContractPdfData): Promise<jsPDF> => {
  const htmlContent = buildPdfHtml(data);

  // ── 1. Render HTML in a hidden iframe ──────────────────────────────────────
  const iframe = document.createElement('iframe');
  iframe.style.cssText = [
    'position:absolute',
    'left:-10000px',
    'top:0',
    `width:${RENDER_WIDTH_PX}px`,
    'height:auto',
    'border:0',
    'background:#ffffff',
  ].join(';');
  iframe.srcdoc = htmlContent;
  document.body.appendChild(iframe);

  try {
    // Wait for the iframe document to load
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      setTimeout(resolve, 1500); // safety timeout
    });

    const iframeWin = iframe.contentWindow;
    const iframeDoc = iframe.contentDocument || iframeWin?.document;
    if (!iframeDoc) throw new Error('Contrat indisponible : rendu impossible');

    const container = iframeDoc.documentElement;
    const body = iframeDoc.body;

    // Wait for all images to load
    await Promise.all(
      Array.from(container.querySelectorAll('img')).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }),
    );

    // Expand iframe to full content height so every element has a stable
    // getBoundingClientRect() before we collect safe break points
    const fullHeight = Math.max(container.scrollHeight, body.scrollHeight);
    iframe.style.height = `${fullHeight}px`;
    // Allow one rAF for the browser to reflow
    await new Promise<void>((resolve) => setTimeout(resolve, 80));

    // ── 2. Collect safe page-break positions (CSS px) ─────────────────────
    const safeBreaksCssPx = collectSafeBreakPoints(iframeDoc);

    // ── 3. Render the full document to a single canvas ────────────────────
    const captureW = Math.max(container.scrollWidth, body.scrollWidth, RENDER_WIDTH_PX);
    const captureH = Math.max(container.scrollHeight, body.scrollHeight);

    const canvas = await html2canvas(container, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: captureW,
      height: captureH,
      windowWidth: captureW,
      windowHeight: captureH,
      scrollX: 0,
      scrollY: 0,
    });

    const canvasW = canvas.width;   // captureW * SCALE
    const canvasH = canvas.height;  // captureH * SCALE

    // Convert safe break points from CSS px → canvas px
    const safeBreaks = safeBreaksCssPx
      .map((y) => Math.round(y * SCALE))
      .filter((y, i, arr) => i === 0 || y !== arr[i - 1]); // deduplicate

    // ── 4. Paginate ────────────────────────────────────────────────────────
    // A4 page height in canvas pixels (same scale as canvas width → A4 width)
    const pageH = Math.round((canvasW * PAGE_H_MM) / PAGE_W_MM);

    const doc = new jsPDF('p', 'mm', [PAGE_W_MM, PAGE_H_MM]);

    let currentY = 0;  // top of the next slice to place (canvas px)
    let pageIndex = 0; // 0 = first page (already created by jsPDF)

    while (currentY < canvasH) {
      const idealCut = currentY + pageH;

      if (idealCut >= canvasH) {
        // Last slice — no need to search for a break point
        addCanvasSliceToPdf(doc, canvas, currentY, canvasH, pageIndex > 0);
        break;
      }

      // Find the largest safe break point ≤ idealCut and > currentY
      let cutY = idealCut; // fallback: forced cut at ideal position
      for (let i = safeBreaks.length - 1; i >= 0; i--) {
        if (safeBreaks[i] > currentY && safeBreaks[i] <= idealCut) {
          cutY = safeBreaks[i];
          break;
        }
      }

      // Guard against a zero-height slice (no safe break found above currentY)
      if (cutY <= currentY) cutY = idealCut;

      addCanvasSliceToPdf(doc, canvas, currentY, cutY, pageIndex > 0);
      pageIndex++;
      currentY = cutY;
    }

    return doc;
  } finally {
    document.body.removeChild(iframe);
  }
};

export const downloadContractPdf = async (data: ContractPdfData) => {
  const doc = await generateContractPdf(data);
  const date = new Date(data.signedAt).toISOString().slice(0, 10);
  const slug = data.productName.replace(/\s+/g, '-').toLowerCase();
  doc.save(`contrat-${slug}-${date}.pdf`);
};
