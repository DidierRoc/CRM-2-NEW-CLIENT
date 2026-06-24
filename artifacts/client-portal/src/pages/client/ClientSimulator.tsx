import { useOutletContext } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import GeneralSimulator from '@/components/products/GeneralSimulator';
import { useClientProducts, useClientProfile } from '@/hooks/useClientData';
import { ClientRowsSkeleton } from '@/components/client-portal/ClientPageFallback';
import { useLanguage } from '@/contexts/LanguageContext';

const ClientSimulator = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const { lang } = useLanguage();
  const leadId = clientAccount?.lead_id;
  const { data: productsData, isLoading: loadingProducts } = useClientProducts(leadId);
  const { data: profileData } = useClientProfile(leadId);

  const products = (productsData || [])
    .filter((lp: any) => lp.products || lp.nom)
    .map((lp: any) => lp.products || lp);
  const clientName = profileData?.lead ? `${profileData.lead.prenom} ${profileData.lead.nom}` : '';
  const loading = loadingProducts;

  if (loading) {
    return <ClientRowsSkeleton rows={5} />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
          <Calculator className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{lang === 'en' ? 'Return simulator' : 'Simulateur de rendement'}</h1>
          <p className="text-sm text-slate-500">{lang === 'en' ? 'Estimate the performance of your investments' : 'Estimez les performances de vos investissements'}</p>
        </div>
      </div>

      <GeneralSimulator products={products} variant="client" clientName={clientName} />
    </div>
  );
};

export default ClientSimulator;
