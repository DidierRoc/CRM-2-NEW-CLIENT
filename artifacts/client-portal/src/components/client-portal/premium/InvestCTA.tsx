import { Sparkles, TrendingUp, ArrowRight, Calculator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/clientTracking';

interface Props {
  projectedGain?: number;
  bestRate?: number;
  primaryColor?: string;
  accentColor?: string;
}

const fmtEUR = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const InvestCTA = ({
  projectedGain = 0,
  bestRate = 0,
  primaryColor = '#1B3A5C',
  accentColor = '#2D5FA0',
}: Props) => {
  const navigate = useNavigate();
  const hasProjection = projectedGain > 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white shadow-xl"
      style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)` }}
    >
      {/* Decorative blob */}
      <div
        className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
      />
      <div className="absolute -right-6 -bottom-10 w-32 h-32 rounded-full opacity-10 bg-white" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-medium mb-2.5">
            <Sparkles className="w-3 h-3" />
            <span>Faites fructifier votre capital</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold leading-tight">
            {hasProjection ? (
              <>
                Vous pourriez gagner{' '}
                <span className="text-white underline decoration-white/40 underline-offset-4">
                  {fmtEUR(projectedGain)}
                </span>{' '}
                supplémentaires
              </>
            ) : (
              <>Découvrez nos contrats jusqu'à {bestRate > 0 ? `${bestRate}%` : '8%'} annuel</>
            )}
          </h2>
          <p className="text-sm text-white/80 mt-1.5 max-w-md">
            {hasProjection
              ? 'Simulez un nouvel investissement et visualisez vos rendements futurs en quelques secondes.'
              : 'Des produits sécurisés, transparents et adaptés à votre profil.'}
          </p>
          {hasProjection && (
            <p className="text-[10px] text-white/55 mt-2 italic">
              Simulation basée sur vos contrats actifs et leur taux contractuel.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Button
            onClick={() => {
              track('click_invest', { source: 'dashboard_cta', projectedGain, bestRate });
              track('cta_invest_click', { source: 'dashboard', projectedGain });
              navigate('/client/products');
            }}
            className="bg-white text-slate-900 hover:bg-white/90 font-semibold shadow-lg"
          >
            <TrendingUp className="w-4 h-4 mr-1.5" />
            Investir
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
          <Button
            onClick={() => {
              track('click_simulate', { source: 'dashboard_cta' });
              track('cta_simulate_click', { source: 'dashboard' });
              navigate('/client/simulator');
            }}
            variant="outline"
            className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
          >
            <Calculator className="w-4 h-4 mr-1.5" />
            Simuler
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvestCTA;
