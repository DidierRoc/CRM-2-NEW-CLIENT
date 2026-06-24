import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase } from 'lucide-react';
import { getNetCapital, type ClientTransaction } from '@/lib/clientBalances';
import { useLanguage } from '@/contexts/LanguageContext';

type Subscription = {
  id: string;
  amount: number | string;
  status: string;
  created_at?: string;
  signed_at?: string | null;
  activated_at?: string | null;
  closed_at?: string | null;
  products?: { nom?: string | null; interets?: string | null; duree?: string | null } | null;
  product_nom?: string | null;
  custom_name?: string | null;
  taux?: string | number | null;
  taux_fixe?: string | number | null;
  taux_variable?: string | number | null;
  interets?: string | number | null;
  duree?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  periode_rentabilite?: string | null;
};

const STATUS_META: Record<string, { labelFr: string; labelEn: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  pending_signature: { labelFr: 'En attente de signature', labelEn: 'Awaiting signature', variant: 'outline', className: 'border-amber-500/40 text-amber-600' },
  pending_payment:   { labelFr: 'En attente de paiement',  labelEn: 'Awaiting payment',   variant: 'outline', className: 'border-amber-500/40 text-amber-600' },
  pending:           { labelFr: 'En attente',              labelEn: 'Pending',             variant: 'outline', className: 'border-amber-500/40 text-amber-600' },
  active:            { labelFr: 'En cours',                labelEn: 'Active',              variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-600 text-white' },
  validated:         { labelFr: 'Validé',                  labelEn: 'Validated',           variant: 'default', className: 'bg-blue-600 hover:bg-blue-600 text-white' },
  closed:            { labelFr: 'Clôturé',                 labelEn: 'Closed',              variant: 'secondary' },
  cancelled:         { labelFr: 'Annulé',                  labelEn: 'Cancelled',           variant: 'destructive' },
};

const formatDate = (value?: string | null, lang: 'fr' | 'en' = 'fr') =>
  value ? new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR') : '—';

const formatAmount = (value: number | string) =>
  `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €`;

const MyInvestments = ({
  subscriptions,
  transactions = [],
}: {
  subscriptions: Subscription[];
  transactions?: ClientTransaction[];
}) => {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const items = [...(subscriptions || [])].sort((a, b) => {
    const da = new Date(a.signed_at || a.activated_at || a.created_at || 0).getTime();
    const db = new Date(b.signed_at || b.activated_at || b.created_at || 0).getTime();
    return db - da;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="w-4 h-4 text-primary" /> {lang === 'en' ? 'My investments' : 'Mes investissements'}
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {lang === 'en' ? 'No investments at the moment' : 'Aucun investissement pour le moment'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">{lang === 'en' ? 'Investment' : 'Placement'}</th>
                  <th className="text-left py-2 px-2 font-medium">{lang === 'en' ? 'Subscription date' : 'Date de souscription'}</th>
                  <th className="text-right py-2 px-2 font-medium">{lang === 'en' ? 'Rate' : 'Taux'}</th>
                  <th className="text-right py-2 px-2 font-medium">{lang === 'en' ? 'Duration' : 'Durée'}</th>
                  <th className="text-right py-2 px-2 font-medium">{lang === 'en' ? 'Amount' : 'Montant'}</th>
                  <th className="text-right py-2 px-2 font-medium">{lang === 'en' ? 'Status' : 'Statut'}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sub) => {
                  const metaRaw = STATUS_META[sub.status];
                  const metaLabel = metaRaw ? (lang === 'en' ? metaRaw.labelEn : metaRaw.labelFr) : (sub.status || '—');
                  const meta = metaRaw || { labelFr: sub.status || '—', labelEn: sub.status || '—', variant: 'outline' as const };
                  const name = sub.products?.nom || sub.custom_name || sub.product_nom || (lang === 'en' ? 'Investment' : 'Placement');
                  const date = sub.signed_at || sub.activated_at || sub.created_at;
                  const netCapital = getNetCapital(transactions, sub.id);
                  const tauxRaw = sub.taux ?? sub.taux_fixe ?? sub.taux_variable ?? sub.interets ?? sub.products?.interets;
                  const taux = tauxRaw != null && tauxRaw !== '' && Number(tauxRaw) !== 0
                    ? (String(tauxRaw).includes('%') ? String(tauxRaw) : `${tauxRaw}%`)
                    : '—';
                  const dureeRaw = (() => {
                    if (sub.date_debut && sub.date_fin) {
                      const start = new Date(sub.date_debut);
                      const end = new Date(sub.date_fin);
                      const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
                      return lang === 'en' ? `${months} months` : `${months} mois`;
                    }
                    if (sub.duree) return sub.duree;
                    if (sub.products?.duree) return sub.products.duree;
                    return null;
                  })();
                  const duree = dureeRaw || '—';
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => navigate('/client/contracts')}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                    >
                      <td className="py-2.5 px-2 font-medium text-foreground">{name}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{formatDate(date, lang)}</td>
                      <td className="py-2.5 px-2 text-right text-foreground">{taux}</td>
                      <td className="py-2.5 px-2 text-right text-foreground">{duree}</td>
                      <td className="py-2.5 px-2 text-right font-semibold text-foreground">{formatAmount(netCapital)}</td>
                      <td className="py-2.5 px-2 text-right">
                        <Badge variant={meta.variant} className={meta.className}>{metaLabel}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyInvestments;
