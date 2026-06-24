import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, ToggleLeft, ToggleRight, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Product {
  nom: string;
  interets: string;
  duree: string;
  prix_minimum: number;
  prix_maximum: number;
  periode_disponibilite?: string;
  categorie?: string;
  _category?: { slug?: string } | null;
}

interface Props {
  product: Product;
  variant?: 'crm' | 'client';
  clientName?: string;
  lockDuration?: boolean;
}

interface MonthlyRow {
  month: number;
  date: string;
  capitalStart: number;
  interest: number;
  cumulativeInterest: number;
  capitalEnd: number;
}

function parseRate(interets: string): number {
  const match = interets.match(/([\d.,]+)\s*%/);
  if (!match) return 0;
  return parseFloat(match[1].replace(',', '.'));
}

function parseDurationMonths(duree: string): number {
  const moisMatch = duree.match(/(\d+)\s*mois/i);
  if (moisMatch) return parseInt(moisMatch[1]);
  const anMatch = duree.match(/(\d+)\s*an/i);
  if (anMatch) return parseInt(anMatch[1]) * 12;
  const num = parseInt(duree);
  return isNaN(num) ? 12 : num;
}

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMonthDate(monthOffset: number, startDate: Date): string {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + monthOffset);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function formatMonthDateShort(monthOffset: number, startDate: Date): string {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + monthOffset);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Compte à terme has locked capital → compound interest is the correct model */
function isCompteATerme(product: Product): boolean {
  const slug = product._category?.slug || product.categorie || '';
  return slug === 'compte_a_terme' || slug === 'compte_a_theme';
}

const ProfitSimulator = ({ product, variant = 'crm', clientName, lockDuration = true }: Props) => {
  const annualRate = parseRate(product.interets || '0%');
  const defaultDuration = parseDurationMonths(product.duree || '12 mois');
  const minAmount = product.prix_minimum || 100;
  const maxAmount = product.prix_maximum || 100000;
  const forceCompound = isCompteATerme(product);

  const [amount, setAmount] = useState(minAmount);
  const [durationMonths, setDurationMonths] = useState(defaultDuration);
  const [compound, setCompound] = useState(() => forceCompound);
  const [startDate] = useState(() => new Date());
  const [showTable, setShowTable] = useState(false);

  const { results, monthlyRows } = useMemo(() => {
    const clampedAmount = Math.max(minAmount, Math.min(amount, maxAmount));
    const monthlyRate = annualRate / 100 / 12;
    const months = durationMonths;
    const rows: MonthlyRow[] = [];
    let capital = clampedAmount;
    let cumulativeInterest = 0;

    for (let m = 1; m <= months; m++) {
      const interest = compound ? capital * monthlyRate : clampedAmount * monthlyRate;
      cumulativeInterest += interest;
      const capitalEnd = compound ? capital + interest : clampedAmount;
      rows.push({
        month: m,
        date: formatMonthDate(m, startDate),
        capitalStart: compound ? capital : clampedAmount,
        interest,
        cumulativeInterest,
        capitalEnd: compound ? capitalEnd : clampedAmount,
      });
      if (compound) capital = capitalEnd;
    }

    const totalProfit = cumulativeInterest;
    const totalCapital = compound ? capital : clampedAmount + totalProfit;

    return {
      results: { total: totalCapital, profit: totalProfit, monthly: totalProfit / months },
      monthlyRows: rows,
    };
  }, [amount, durationMonths, compound, annualRate, minAmount, maxAmount, startDate]);

  const isClient = variant === 'client';
  const amountError = amount < minAmount || amount > maxAmount;

  const handleDownloadPDF = () => {
    const clampedAmount = Math.max(minAmount, Math.min(amount, maxAmount));
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RAPPORT DE SIMULATION DE RENDEMENT', pageWidth / 2, y, { align: 'center' });
    y += 12;

    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.5);
    doc.line(14, y, pageWidth - 14, y);
    y += 10;

    // Contract info
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS DU CONTRAT', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const infoLines: [string, string][] = [
      ['Produit', product.nom],
      ...(clientName ? [['Client', clientName] as [string, string]] : []),
      ['Date de simulation', new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })],
      ['Montant investi', `${formatCurrency(clampedAmount)} EUR`],
      ['Taux annuel', `${annualRate} %`],
      ['Taux mensuel', `${formatCurrency(annualRate / 12)} %`],
      ['Duree', `${durationMonths} mois (${(durationMonths / 12).toFixed(1)} ans)`],
      ['Mode de calcul', compound ? 'Interets composes (reinvestissement)' : 'Interets simples (retrait)'],
      ["Date d'entree", formatMonthDateShort(0, startDate)],
      ['Date de sortie', formatMonthDateShort(durationMonths, startDate)],
    ];

    for (const [label, value] of infoLines) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label} :`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 70, y);
      y += 6;
    }
    y += 6;

    // Monthly detail table
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('DETAIL MENSUEL DES RENDEMENTS', 14, y);
    y += 4;

    const tableBody = monthlyRows.map(row => [
      String(row.month),
      row.date,
      `${formatCurrency(row.capitalStart)} EUR`,
      `+${formatCurrency(row.interest)} EUR`,
      `+${formatCurrency(row.cumulativeInterest)} EUR`,
      `${formatCurrency(compound ? row.capitalEnd : row.capitalStart)} EUR`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Mois', 'Date', 'Capital debut', 'Interets', 'Cumule', 'Capital fin']],
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 243, 250] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
      ? ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 12
      : y + 12;

    // Check if we need a new page for the summary
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }

    // Summary
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.5);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('BILAN NET DE PERFORMANCE', 14, y);
    y += 8;

    doc.setFontSize(10);
    const summaryLines: [string, string][] = [
      ['Capital initial investi', `${formatCurrency(clampedAmount)} EUR`],
      ['Total des interets generes', `+${formatCurrency(results.profit)} EUR`],
      ['Rendement mensuel moyen', `+${formatCurrency(results.monthly)} EUR`],
      ['Capital final net', `${formatCurrency(results.total)} EUR`],
      ['Performance nette', `+${formatCurrency((results.profit / clampedAmount) * 100)} %`],
      ['Rendement annualise', `${formatCurrency(annualRate)} %`],
    ];

    for (const [label, value] of summaryLines) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label} :`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 80, y);
      y += 6;
    }

    // Footer
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Ce document est une simulation indicative et ne constitue pas un engagement contractuel.', pageWidth / 2, y, { align: 'center' });

    doc.save(`simulation_${product.nom.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className={cn(
      "rounded-xl border p-5 space-y-4",
      isClient
        ? "bg-gradient-to-br from-slate-50 to-blue-50/30 border-slate-200"
        : "bg-card border-border"
    )}>
      <div className="flex items-center gap-2">
        <Calculator className={cn("w-5 h-5", isClient ? "text-blue-600" : "text-primary")} />
        <h3 className={cn("font-semibold", isClient ? "text-slate-800" : "text-foreground")}>
          Simulateur de rendement
        </h3>
      </div>

      {annualRate === 0 && (
        <p className={cn("text-xs", isClient ? "text-amber-600" : "text-yellow-600")}>
          ⚠ Taux d'intérêt non défini — les résultats seront à 0.
        </p>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <label className={cn("text-sm font-medium", isClient ? "text-slate-700" : "text-foreground")}>
          Montant d'investissement (€)
        </label>
        <Input
          type="number"
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          min={minAmount}
          max={maxAmount}
          className={cn(amountError && "border-destructive")}
        />
        <Slider
          value={[Math.max(minAmount, Math.min(amount, maxAmount))]}
          onValueChange={v => setAmount(v[0])}
          min={minAmount}
          max={maxAmount}
          step={Math.max(1, Math.round((maxAmount - minAmount) / 100))}
          className="mt-1"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Min: {formatCurrency(minAmount)}€</span>
          <span>Max: {formatCurrency(maxAmount)}€</span>
        </div>
        {amountError && (
          <p className="text-xs text-destructive">
            Le montant doit être entre {formatCurrency(minAmount)}€ et {formatCurrency(maxAmount)}€
          </p>
        )}
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <label className={cn("text-sm font-medium", isClient ? "text-slate-700" : "text-foreground")}>
          Durée : {durationMonths} mois ({(durationMonths / 12).toFixed(1)} an{durationMonths >= 24 ? 's' : ''})
          {lockDuration && (
            <span className="ml-2 text-[10px] text-muted-foreground font-normal">(fixée par le produit)</span>
          )}
        </label>
        {!lockDuration && (
          <Slider
            value={[durationMonths]}
            onValueChange={v => setDurationMonths(v[0])}
            min={1}
            max={Math.max(defaultDuration * 2, 60)}
            step={1}
          />
        )}
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Entrée : {formatMonthDateShort(0, startDate)}</span>
          <span>Sortie : {formatMonthDateShort(durationMonths, startDate)}</span>
        </div>
      </div>

      {/* Compound toggle — locked for compte à terme */}
      <button
        onClick={() => !forceCompound && setCompound(c => !c)}
        disabled={forceCompound}
        className={cn(
          "flex items-center gap-2 w-full p-3 rounded-lg border text-sm transition-colors text-left",
          forceCompound
            ? isClient ? "bg-blue-50 border-blue-200 text-blue-800 cursor-default" : "bg-primary/10 border-primary/20 text-primary cursor-default"
            : compound
              ? isClient ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-primary/10 border-primary/20 text-primary"
              : isClient ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-muted border-border text-muted-foreground"
        )}
      >
        {compound
          ? <ToggleRight className="w-5 h-5 shrink-0" />
          : <ToggleLeft className="w-5 h-5 shrink-0" />}
        <div>
          <span className="font-medium">{compound ? 'Intérêts composés' : 'Intérêts simples'}</span>
          <p className="text-[11px] opacity-70 mt-0.5">
            {forceCompound
              ? 'Capital bloqué — intérêts réinvestis automatiquement'
              : compound
                ? 'Les bénéfices sont réinvestis automatiquement'
                : 'Les bénéfices sont récupérés à chaque échéance'}
          </p>
        </div>
      </button>

      {/* Results */}
      {!amountError && (
        <div className={cn(
          "rounded-lg p-4 space-y-3",
          isClient ? "bg-white border border-slate-100 shadow-sm" : "bg-accent/50 border border-border"
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className={cn("w-4 h-4", isClient ? "text-emerald-600" : "text-green-600")} />
              <span className={cn("text-sm font-semibold", isClient ? "text-slate-800" : "text-foreground")}>Performance nette</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="text-xs h-7 gap-1">
              <Download className="w-3 h-3" />Rapport complet
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bénéfice net</p>
              <p className={cn("text-lg font-bold", isClient ? "text-emerald-600" : "text-green-600")}>
                +{formatCurrency(results.profit)}€
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gain / mois</p>
              <p className={cn("text-lg font-bold", isClient ? "text-blue-600" : "text-primary")}>
                +{formatCurrency(results.monthly)}€
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Capital final</p>
              <p className={cn("text-lg font-bold", isClient ? "text-slate-800" : "text-foreground")}>
                {formatCurrency(results.total)}€
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Performance</p>
              <p className={cn("text-lg font-bold", isClient ? "text-emerald-600" : "text-green-600")}>
                +{formatCurrency((results.profit / Math.max(minAmount, Math.min(amount, maxAmount))) * 100)}%
              </p>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Taux {annualRate}%/an • {compound ? 'capitalisation mensuelle' : 'intérêts simples'} •
            Du {formatMonthDateShort(0, startDate)} au {formatMonthDateShort(durationMonths, startDate)}
          </p>

          {/* Monthly detail table toggle */}
          <button
            onClick={() => setShowTable(t => !t)}
            className={cn(
              "flex items-center gap-1 text-xs font-medium w-full justify-center pt-2 transition-colors",
              isClient ? "text-blue-600 hover:text-blue-700" : "text-primary hover:text-primary/80"
            )}
          >
            {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showTable ? 'Masquer le détail mensuel' : 'Voir le détail mensuel'}
          </button>

          {showTable && (
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <thead className={cn("sticky top-0", isClient ? "bg-slate-100" : "bg-muted")}>
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold">Mois</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Date</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Capital</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Intérêts</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Cumulé</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map(row => (
                    <tr key={row.month} className={cn("border-t", row.month % 2 === 0 ? (isClient ? "bg-slate-50/50" : "bg-muted/30") : "")}>
                      <td className="px-2 py-1.5 font-medium">{row.month}</td>
                      <td className="px-2 py-1.5 text-muted-foreground capitalize">{row.date}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(row.capitalStart)}€</td>
                      <td className={cn("px-2 py-1.5 text-right font-medium", isClient ? "text-emerald-600" : "text-green-600")}>
                        +{formatCurrency(row.interest)}€
                      </td>
                      <td className={cn("px-2 py-1.5 text-right font-semibold", isClient ? "text-blue-600" : "text-primary")}>
                        +{formatCurrency(row.cumulativeInterest)}€
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className={cn("border-t-2 font-semibold", isClient ? "bg-slate-100" : "bg-muted")}>
                  <tr>
                    <td className="px-2 py-2" colSpan={2}>TOTAL</td>
                    <td className="px-2 py-2 text-right">{formatCurrency(Math.max(minAmount, Math.min(amount, maxAmount)))}€</td>
                    <td className={cn("px-2 py-2 text-right", isClient ? "text-emerald-600" : "text-green-600")}>
                      +{formatCurrency(results.profit)}€
                    </td>
                    <td className={cn("px-2 py-2 text-right", isClient ? "text-blue-600" : "text-primary")}>
                      {formatCurrency(results.total)}€
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfitSimulator;
