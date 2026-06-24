import { useState } from 'react';
import { CalendarDays, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CompanyBranding } from '@/hooks/useCompanySignature';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Palette bancaire par défaut ───────────────────────────────────────
const NAVY  = [15,  35,  71]  as [number, number, number];
const GOLD  = [201, 168, 76]  as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const LIGHT = [247, 249, 252] as [number, number, number];
const DARK  = [30,  41,  59]  as [number, number, number];
const MUTED = [100, 116, 139] as [number, number, number];

// ── Convertit une couleur hex en triplet RGB ──────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ── Formateur 100 % ASCII pour jsPDF (évite U+00A0 / U+202F au "/") ──
// N'utilise PAS toLocaleString : les espaces insécables qu'il génère
// en séparateur de milliers sont rendus en "/" par jsPDF.
function fmt(n: number, decimals = 2): string {
  const fixed   = Math.abs(n).toFixed(decimals);          // ex: "50000.00"
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // espace ASCII
  const sign    = n < 0 ? '-' : '';
  return `${sign}${grouped},${dec ?? '00'}`;              // ex: "50 000,00"
}

// ── Format date lisible ───────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ── Charge une URL image en base64 pour jsPDF ─────────────────────────
async function urlToBase64(url: string): Promise<string> {
  const res  = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface ScheduleRow {
  month: number;
  date: string;
  capital: number;
  interest: number;
  cumInterest: number;
  balance: number;
}

export interface ContractScheduleProps {
  amount: number;
  durationMonths: number;
  interestRate: number;
  signedAt: string;
  productName: string;
  reference?: string;
  clientName: string;
  branding?: CompanyBranding | null;
}

// ── Génère les lignes du tableau ──────────────────────────────────────
function generateSchedule(
  amount: number,
  durationMonths: number,
  annualRate: number,
  startDate: string,
): ScheduleRow[] {
  const monthlyRate = annualRate / 100 / 12;
  const rows: ScheduleRow[] = [];
  let balance     = amount;   // solde courant (capital + intérêts capitalisés)
  let cumInterest = 0;
  const start = new Date(startDate);

  for (let i = 1; i <= durationMonths; i++) {
    const date = new Date(start);
    date.setMonth(date.getMonth() + i);

    // Intérêts composés : calculés sur le solde courant (capital + intérêts cumulés)
    const interest = balance * monthlyRate;
    cumInterest += interest;
    balance     += interest;

    rows.push({
      month: i,
      date: date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      capital: amount,                                   // capital initial (constant)
      interest:    Math.round(interest    * 100) / 100,
      cumInterest: Math.round(cumInterest * 100) / 100,
      balance:     Math.round(balance     * 100) / 100,
    });
  }
  return rows;
}

// ── Date fin de contrat ───────────────────────────────────────────────
function endDate(signedAt: string, months: number): string {
  const d = new Date(signedAt);
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Génère et télécharge le PDF ───────────────────────────────────────
async function downloadSchedulePdf(
  rows: ScheduleRow[],
  props: ContractScheduleProps,
) {
  const { branding } = props;

  // Couleurs dynamiques depuis le branding CRM (fallback palette navy/or)
  const navyColor: [number, number, number] =
    branding?.primaryColor ? hexToRgb(branding.primaryColor) : NAVY;
  const goldColor: [number, number, number] =
    branding?.accentColor ? hexToRgb(branding.accentColor) : GOLD;

  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();  // 297

  // ── 1. BANDEAU EN-TÊTE ──────────────────────────────────────────────
  const headerH = 34;
  doc.setFillColor(...navyColor);
  doc.rect(0, 0, W, headerH, 'F');

  // Ligne or sous le bandeau
  doc.setFillColor(...goldColor);
  doc.rect(0, headerH, W, 0.8, 'F');

  // Logo : URL branding CRM en priorité, sinon fallback logo statique
  const logoUrl =
    branding?.contractLogoUrl ||
    branding?.logoUrl ||
    '/ubs-logo.png';                // fallback statique toujours présent

  let logoLoaded = false;
  if (logoUrl) {
    try {
      const b64 = await urlToBase64(logoUrl);
      const imgFmt = b64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      // Logo centré dans le bandeau, hauteur 18mm
      const logoH = 18;
      doc.addImage(b64, imgFmt, W / 2 - 35, (headerH - logoH) / 2, 70, logoH);
      logoLoaded = true;
    } catch {
      logoLoaded = false;
    }
  }

  // Nom affiché dans le pied de page et dans le bandeau sans logo
  // Priorité : branding CRM → fallback statique "Luxempart"
  const rawName = branding?.companyName?.trim() || '';
  const PLACEHOLDER_RE = /ma\s+soci[eé]t[eé]|portail\s+investisseur|my\s+company/i;
  const companyName = (rawName && !PLACEHOLDER_RE.test(rawName)) ? rawName : 'UBS';
  if (!logoLoaded) {
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(companyName, W / 2, headerH / 2 - 2, { align: 'center' });
    if (branding?.companyCity || branding?.companyCountry) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
      const location = [branding?.companyCity, branding?.companyCountry].filter(Boolean).join(' - ');
      doc.text(location, W / 2, headerH / 2 + 5, { align: 'center' });
    }
  }

  // ── 2. TITRE DOCUMENT ──────────────────────────────────────────────
  let y = headerH + 10;
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('ÉCHÉANCIER DE PLACEMENT', W / 2, y, { align: 'center' });
  y += 5;

  // Filet or sous le titre
  doc.setFillColor(...goldColor);
  doc.rect(W / 2 - 40, y, 80, 0.5, 'F');
  y += 7;

  // ── 3. FICHE CONTRAT ──────────────────────────────────────────────
  // Deux colonnes
  const colLeft  = 14;
  const colRight = W / 2 + 4;

  const infoLeft: [string, string][] = [
    ['Produit',         props.productName],
    ['Client',          props.clientName || '—'],
    ['Référence',       props.reference  || '—'],
  ];
  const infoRight: [string, string][] = [
    ['Montant investi', `${fmt(props.amount, 2)} EUR`],
    ['Durée',          `${props.durationMonths} mois`],
    ['Taux annuel',    `${fmt(props.interestRate, 2)} %`],
  ];
  if (props.signedAt) {
    infoRight.push(['Période', `${fmtDate(props.signedAt)} au ${endDate(props.signedAt, props.durationMonths)}`]);
  }

  const lineH = 6;
  infoLeft.forEach(([label, val], idx) => {
    const ly = y + idx * lineH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(label, colLeft, ly);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.text(val, colLeft + 30, ly);
  });
  infoRight.forEach(([label, val], idx) => {
    const ry = y + idx * lineH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(label, colRight, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    const maxW = W - colRight - 30;
    doc.text(val, colRight + 28, ry, { maxWidth: maxW });
  });

  y += Math.max(infoLeft.length, infoRight.length) * lineH + 5;

  // Séparateur or
  doc.setFillColor(...goldColor);
  doc.rect(colLeft, y, W - colLeft * 2, 0.4, 'F');
  y += 7;

  // ── 4. ENCART RÉSUMÉ ─────────────────────────────────────────────
  const totalInterest = rows.length ? rows[rows.length - 1].cumInterest : 0;
  const finalBalance  = rows.length ? rows[rows.length - 1].balance     : props.amount;

  const boxW = (W - 28 - 8) / 3;
  const boxes: { label: string; value: string; sub?: string }[] = [
    { label: 'Capital investi',    value: `${fmt(props.amount, 2)} EUR` },
    { label: 'Intérêts totaux',    value: `${fmt(totalInterest, 2)} EUR`, sub: `Taux ${fmt(props.interestRate, 2)} %` },
    { label: 'Solde à l\'échéance', value: `${fmt(finalBalance, 2)} EUR` },
  ];

  boxes.forEach((box, i) => {
    const bx = colLeft + i * (boxW + 4);
    // Fond
    doc.setFillColor(...LIGHT);
    doc.roundedRect(bx, y, boxW, 18, 2, 2, 'F');
    // Bordure haut en couleur
    doc.setFillColor(...(i === 1 ? goldColor : navyColor));
    doc.roundedRect(bx, y, boxW, 1.5, 1, 1, 'F');
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(box.label, bx + boxW / 2, y + 6, { align: 'center' });
    // Valeur
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...(i === 1 ? goldColor : navyColor));
    doc.text(box.value, bx + boxW / 2, y + 12.5, { align: 'center' });
    // Sous-texte
    if (box.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(box.sub, bx + boxW / 2, y + 17, { align: 'center' });
    }
  });

  y += 24;

  // ── 5. TABLEAU ───────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [['Mois', 'Date', 'Capital (EUR)', 'Intérêts (EUR)', 'Cumul intérêts (EUR)', 'Solde total (EUR)']],
    body: rows.map(r => [
      r.month.toString(),
      r.date,
      fmt(r.capital),
      fmt(r.interest),
      fmt(r.cumInterest),
      fmt(r.balance),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      textColor: DARK,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: navyColor,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
    },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left',   cellWidth: 24 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    theme: 'grid',
    margin: { left: colLeft, right: colLeft },
    // Ligne total en bas
    foot: [[
      '',
      'TOTAL',
      fmt(props.amount),
      fmt(totalInterest),
      fmt(totalInterest),
      fmt(finalBalance),
    ]],
    footStyles: {
      fillColor: navyColor,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
    },
  });

  // ── 6. PIED DE PAGE ──────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const footY = H - 14;

    // Ligne or
    doc.setFillColor(...goldColor);
    doc.rect(colLeft, footY - 3, W - colLeft * 2, 0.4, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);

    // Gauche : société
    const leftFoot = [companyName, branding?.companyAddress, [branding?.companyPostalCode, branding?.companyCity].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    doc.text(leftFoot, colLeft, footY + 1);

    // Centre : numéro de page
    doc.text(`Page ${p} / ${pageCount}`, W / 2, footY + 1, { align: 'center' });

    // Droite : date génération
    doc.text(
      `Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      W - colLeft, footY + 1, { align: 'right' },
    );

    // Disclaimer
    doc.setFontSize(5.5);
    doc.text(
      'Ce document est fourni à titre indicatif et ne constitue pas un engagement contractuel. Les intérêts sont calculés sur la base du taux annuel indiqué.',
      W / 2, footY + 6, { align: 'center', maxWidth: W - 28 },
    );
  }

  // ── 7. SAUVEGARDE ────────────────────────────────────────────────
  const safeName = props.productName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  doc.save(`echeancier-${safeName}-${props.reference || 'contrat'}.pdf`);
}

// ── Composant React ───────────────────────────────────────────────────
const ContractSchedule = (props: ContractScheduleProps) => {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);

  const rows = generateSchedule(
    props.amount, props.durationMonths, props.interestRate, props.signedAt,
  );
  const totalInterest = rows.length ? rows[rows.length - 1].cumInterest : 0;
  const finalBalance  = rows.length ? rows[rows.length - 1].balance     : props.amount;

  const displayRows = expanded ? rows : rows.slice(0, 6);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await downloadSchedulePdf(rows, props);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">Échéancier du contrat</h4>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={generating}>
          <Download className="w-3.5 h-3.5 mr-1" />
          {generating ? 'Génération…' : "Télécharger l'échéancier PDF"}
        </Button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-3 p-4 border-b">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Capital investi</p>
          <p className="text-sm font-bold text-foreground">
            {props.amount.toLocaleString('fr-FR')} €
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Intérêts totaux</p>
          <p className="text-sm font-bold text-green-600">
            {totalInterest.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Solde final</p>
          <p className="text-sm font-bold text-primary">
            {finalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
          </p>
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Mois</th>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-right font-medium">Capital</th>
              <th className="px-3 py-2 text-right font-medium">Intérêts</th>
              <th className="px-3 py-2 text-right font-medium">Cum. intérêts</th>
              <th className="px-3 py-2 text-right font-medium">Solde</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(r => (
              <tr key={r.month} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 font-medium">{r.month}</td>
                <td className="px-3 py-2">{r.date}</td>
                <td className="px-3 py-2 text-right">
                  {r.capital.toLocaleString('fr-FR')} €
                </td>
                <td className="px-3 py-2 text-right text-green-600">
                  +{r.interest.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </td>
                <td className="px-3 py-2 text-right">
                  {r.cumInterest.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {r.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 6 && (
        <div className="p-2 border-t text-center">
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5 mr-1" />Voir moins</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5 mr-1" />Voir les {rows.length - 6} mois restants</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ContractSchedule;
