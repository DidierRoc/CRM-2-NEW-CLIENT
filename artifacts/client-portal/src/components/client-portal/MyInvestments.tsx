import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase } from 'lucide-react';
import { getNetCapital, type ClientTransaction } from '@/lib/clientBalances';

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


const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  pending_signature: { label: 'En attente de signature', variant: 'outline', className: 'border-amber-500/40 text-amber-600' },
  pending_payment:   { label: 'En attente de paiement',  variant: 'outline', className: 'border-amber-500/40 text-amber-600' },
  pending:           { label: 'En attente',              variant: 'outline', className: 'border-amber-500/40 text-amber-600' },
  active:            { label: 'En cours',                variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-600 text-white' },
  validated:         { label: 'Validé',                  variant: 'default', className: 'bg-blue-600 hover:bg-blue-600 text-white' },
  closed:            { label: 'Clôturé',                 variant: 'secondary' },
  cancelled:         { label: 'Annulé',                  variant: 'destructive' },
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('fr-FR') : '—';

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
  const items = [...(subscriptions || [])].sort((a, b) => {
    const da = new Date(a.signed_at || a.activated_at || a.created_at || 0).getTime();
    const db = new Date(b.signed_at || b.activated_at || b.created_at || 0).getTime();
    return db - da;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="w-4 h-4 text-primary" /> Mes investissements
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun investissement pour le moment
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Placement</th>
                  <th className="text-left py-2 px-2 font-medium">Date de souscription</th>
                  <th className="text-right py-2 px-2 font-medium">Taux</th>
                  <th className="text-right py-2 px-2 font-medium">Durée</th>
                  <th className="text-right py-2 px-2 font-medium">Montant</th>
                  <th className="text-right py-2 px-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sub) => {
                  const meta = STATUS_META[sub.status] || { label: sub.status || '—', variant: 'outline' as const };
                  const name = sub.products?.nom || sub.custom_name || sub.product_nom || 'Placement';
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
                      return `${months} mois`;
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
                      <td className="py-2.5 px-2 text-muted-foreground">{formatDate(date)}</td>
                      <td className="py-2.5 px-2 text-right text-foreground">{taux}</td>
                      <td className="py-2.5 px-2 text-right text-foreground">{duree}</td>
                      <td className="py-2.5 px-2 text-right font-semibold text-foreground">{formatAmount(netCapital)}</td>
                      <td className="py-2.5 px-2 text-right">
                        <Badge variant={meta.variant} className={meta.className}>{meta.label}</Badge>
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
