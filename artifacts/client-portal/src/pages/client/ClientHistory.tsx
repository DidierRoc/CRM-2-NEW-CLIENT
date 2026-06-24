import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { useClientHistory } from '@/hooks/useClientData';
import { ClientRowsSkeleton } from '@/components/client-portal/ClientPageFallback';
import { useLanguage } from '@/contexts/LanguageContext';

const ClientHistory = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const { lang } = useLanguage();
  const { data: history, isLoading: loading } = useClientHistory(clientAccount?.lead_id);
  const historyItems = Array.isArray(history) ? history : [];

  if (loading) {
    return <ClientRowsSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{lang === 'en' ? 'Account history' : 'Historique du compte'}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            {lang === 'en' ? 'Recent activity' : 'Activité récente'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyItems.length === 0 ? (
            <p className="text-muted-foreground">{lang === 'en' ? 'No recent activity.' : 'Aucune activité récente.'}</p>
          ) : (
            <div className="space-y-3">
              {historyItems.map((item: any, i: number) => (
                <div key={item.id || i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.action || item.type_action || '—'}</p>
                    <p className="text-xs text-muted-foreground">{item.details || item.commentaire || ''}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR') : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientHistory;
