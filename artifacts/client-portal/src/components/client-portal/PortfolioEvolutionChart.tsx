import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';

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
    return { nom: sub.custom_name, categorie: 'Sur mesure', interets: `${rate}%`, duree };
  }
  return null;
}

interface Props {
  activeSubs: any[];
  onDownloadStatement: () => void;
}

type TimeRange = 'all' | '6m' | '1y' | '2y';

const PortfolioEvolutionChart = ({ activeSubs, onDownloadStatement }: Props) => {
  const { lang } = useLanguage();
  const [selectedContract, setSelectedContract] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const chartData = useMemo(() => {
    const subs = selectedContract === 'all'
      ? activeSubs
      : activeSubs.filter(s => s.id === selectedContract);

    if (subs.length === 0) return { data: [], todayIndex: 0 };

    // Find the earliest start date and latest end date
    const now = new Date();
    let earliestStart = now;
    let latestEnd = now;

    for (const sub of subs) {
      const product = resolveSubProduct(sub);
      if (!product) continue;
      const start = new Date(sub.activated_at || sub.date_debut || sub.created_at);
      const duration = parseDurationMonths(product.duree || '12 mois');
      const end = new Date(start);
      end.setMonth(end.getMonth() + duration);

      if (start < earliestStart) earliestStart = new Date(start);
      if (end > latestEnd) latestEnd = new Date(end);
    }

    // Calculate total months from earliest start to latest end
    const totalMonths = Math.max(1,
      (latestEnd.getFullYear() - earliestStart.getFullYear()) * 12 +
      latestEnd.getMonth() - earliestStart.getMonth()
    );

    // Current month index relative to start
    const todayMonthIndex = Math.max(0,
      (now.getFullYear() - earliestStart.getFullYear()) * 12 +
      now.getMonth() - earliestStart.getMonth()
    );

    // Apply time range filter
    let startMonth = 0;
    let endMonth = totalMonths;

    if (timeRange === '6m') {
      startMonth = Math.max(0, todayMonthIndex - 3);
      endMonth = Math.min(totalMonths, todayMonthIndex + 3);
    } else if (timeRange === '1y') {
      startMonth = Math.max(0, todayMonthIndex - 6);
      endMonth = Math.min(totalMonths, todayMonthIndex + 6);
    } else if (timeRange === '2y') {
      startMonth = Math.max(0, todayMonthIndex - 12);
      endMonth = Math.min(totalMonths, todayMonthIndex + 12);
    }

    const data: any[] = [];
    let adjustedTodayIndex = 0;

    for (let m = startMonth; m <= endMonth; m++) {
      const date = new Date(earliestStart);
      date.setMonth(date.getMonth() + m);

      let capital = 0;
      let interests = 0;

      for (const sub of subs) {
        const product = resolveSubProduct(sub);
        if (!product) continue;
        const rate = parseRate(product.interets || '0%');
        const monthlyRate = rate / 100 / 12;
        const subStart = new Date(sub.activated_at || sub.date_debut || sub.created_at);
        const duration = parseDurationMonths(product.duree || '12 mois');

        // Month offset relative to this sub's start
        const subMonthOffset = (date.getFullYear() - subStart.getFullYear()) * 12 +
          date.getMonth() - subStart.getMonth();

        if (subMonthOffset >= 0 && subMonthOffset <= duration) {
          // REAL capital from confirmed transactions, NOT contract face value.
          const invested = Number(sub.investedNet ?? 0);
          capital += invested;
          interests += invested * monthlyRate * subMonthOffset;
        }
      }

      const isFuture = m > todayMonthIndex;
      const isToday = m === todayMonthIndex;

      if (isToday) adjustedTodayIndex = data.length;

      const label = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

      data.push({
        label,
        capital: Math.round(capital),
        interests: Math.round(interests),
        total: Math.round(capital + interests),
        isFuture,
        // For future projection styling
        pastTotal: isFuture ? null : Math.round(capital + interests),
        futureTotal: isFuture ? Math.round(capital + interests) : null,
        pastInterests: isFuture ? null : Math.round(interests),
        futureInterests: isFuture ? Math.round(interests) : null,
      });
    }

    return { data, todayIndex: adjustedTodayIndex };
  }, [activeSubs, selectedContract, timeRange]);

  if (chartData.data.length <= 1) return null;

  const todayLabel = chartData.data[chartData.todayIndex]?.label;

  return (
    <div className="border rounded-lg bg-card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-foreground">{lang === 'en' ? 'Portfolio evolution' : 'Évolution du portefeuille'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{lang === 'en' ? 'Past and future projection of your investments' : 'Passé et projection future de vos investissements'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onDownloadStatement}>
          <Download className="w-3.5 h-3.5 mr-1" />{lang === 'en' ? 'PDF Statement' : 'Relevé PDF'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Contract filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{lang === 'en' ? 'Contract:' : 'Contrat :'}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedContract('all')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                selectedContract === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {lang === 'en' ? 'All' : 'Tous'}
            </button>
            {activeSubs.map(sub => (
              <button
                key={sub.id}
                onClick={() => setSelectedContract(sub.id)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors max-w-[120px] truncate ${
                  selectedContract === sub.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                title={sub.products?.nom || sub.custom_name}
              >
                {sub.products?.nom || sub.custom_name || (lang === 'en' ? 'Contract' : 'Contrat')}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-5 bg-border hidden sm:block" />

        {/* Time range filter */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex gap-1">
            {(lang === 'en' ? [
              { value: 'all' as TimeRange, label: 'All' },
              { value: '6m' as TimeRange, label: '6 months' },
              { value: '1y' as TimeRange, label: '1 year' },
              { value: '2y' as TimeRange, label: '2 years' },
            ] : [
              { value: 'all' as TimeRange, label: 'Tout' },
              { value: '6m' as TimeRange, label: '6 mois' },
              { value: '1y' as TimeRange, label: '1 an' },
              { value: '2y' as TimeRange, label: '2 ans' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  timeRange === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary opacity-80" />
          <span className="text-muted-foreground">Capital</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(var(--chart-2, 142 71% 45%))' }} />
          <span className="text-muted-foreground">{lang === 'en' ? 'Interest (past)' : 'Intérêts (passé)'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm border-2 border-dashed" style={{ borderColor: 'hsl(var(--chart-2, 142 71% 45%))' }} />
          <span className="text-muted-foreground">{lang === 'en' ? 'Interest (projection)' : 'Intérêts (projection)'}</span>
        </div>
        <Badge variant="outline" className="text-[10px] ml-auto">
          <TrendingUp className="w-3 h-3 mr-1" />{lang === 'en' ? 'Today' : "Aujourd'hui"}
        </Badge>
      </div>

      {/* Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
              interval={Math.max(0, Math.floor(chartData.data.length / 8))}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
            />
            <Tooltip
              formatter={(value: unknown, name: string) => {
                const v = value as number | null;
                if (v === null || v === undefined) return ['-', ''];
                const labels: Record<string, string> = lang === 'en' ? {
                  pastTotal: 'Value (actual)',
                  futureTotal: 'Value (projection)',
                  capital: 'Capital',
                  pastInterests: 'Interest (actual)',
                  futureInterests: 'Interest (projection)',
                } : {
                  pastTotal: 'Valeur (réel)',
                  futureTotal: 'Valeur (projection)',
                  capital: 'Capital',
                  pastInterests: 'Intérêts (réel)',
                  futureInterests: 'Intérêts (projection)',
                };
                return [`${v.toLocaleString('fr-FR')} €`, labels[name] || name];
              }}
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            {todayLabel && (
              <ReferenceLine
                x={todayLabel}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: lang === 'en' ? 'Today' : "Aujourd'hui",
                  position: 'top',
                  style: { fontSize: 10, fill: 'hsl(var(--primary))' },
                }}
              />
            )}
            {/* Capital base */}
            <Area
              type="monotone"
              dataKey="capital"
              stackId="1"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.12}
              strokeWidth={2}
            />
            {/* Past interests */}
            <Area
              type="monotone"
              dataKey="pastInterests"
              stackId="1"
              stroke="hsl(var(--chart-2, 142 71% 45%))"
              fill="hsl(var(--chart-2, 142 71% 45%))"
              fillOpacity={0.25}
              strokeWidth={2}
              connectNulls={false}
            />
            {/* Future interests */}
            <Area
              type="monotone"
              dataKey="futureInterests"
              stackId="1"
              stroke="hsl(var(--chart-2, 142 71% 45%))"
              fill="hsl(var(--chart-2, 142 71% 45%))"
              fillOpacity={0.08}
              strokeWidth={2}
              strokeDasharray="6 3"
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PortfolioEvolutionChart;
