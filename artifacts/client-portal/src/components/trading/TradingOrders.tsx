import { callCrmApi } from '@/lib/crmApi';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { X } from 'lucide-react';

interface Props {
  orders: any[];
  onCancel: () => void;
}

const TradingOrders = ({ orders, onCancel }: Props) => {
  const { toast } = useToast();
  const { lang } = useLanguage();

  const cancelOrder = async (orderId: string) => {
    try {
      await callCrmApi('client-trading', 'cancel-order', { orderId });
      toast({ title: lang === 'en' ? 'Order cancelled' : 'Ordre annulé' });
      onCancel();
    } catch (err: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{lang === 'en' ? 'No pending orders' : 'Aucun ordre en attente'}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-xs border-b">
            <th className="text-left py-2 px-2">{lang === 'en' ? 'Symbol' : 'Symbole'}</th>
            <th className="text-left py-2 px-2">Type</th>
            <th className="text-left py-2 px-2">{lang === 'en' ? 'Direction' : 'Direction'}</th>
            <th className="text-right py-2 px-2">{lang === 'en' ? 'Qty' : 'Qté'}</th>
            <th className="text-right py-2 px-2">{lang === 'en' ? 'Target price' : 'Prix cible'}</th>
            <th className="text-right py-2 px-2">{lang === 'en' ? 'Leverage' : 'Levier'}</th>
            <th className="text-center py-2 px-2">{lang === 'en' ? 'Action' : 'Action'}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-2 px-2 font-medium">{o.symbol?.replace('USDT', '/USDT')}</td>
              <td className="py-2 px-2 uppercase text-xs font-medium">{o.order_type}</td>
              <td className="py-2 px-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  o.direction === 'long' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {o.direction === 'long' ? 'LONG' : 'SHORT'}
                </span>
              </td>
              <td className="py-2 px-2 text-right font-mono">{o.quantity}</td>
              <td className="py-2 px-2 text-right font-mono">${parseFloat(o.target_price || 0).toFixed(2)}</td>
              <td className="py-2 px-2 text-right font-mono">x{o.leverage}</td>
              <td className="py-2 px-2 text-center">
                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => cancelOrder(o.id)}>
                  <X className="w-3 h-3 mr-1" />{lang === 'en' ? 'Cancel' : 'Annuler'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TradingOrders;
