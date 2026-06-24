import { useEffect, useState } from 'react';
import { BarChart3, ShieldAlert, TrendingUp, Activity } from 'lucide-react';

const ADVICES = [
  {
    icon: ShieldAlert,
    title: 'Maîtrisez votre effet de levier',
    text: "Un effet de levier élevé amplifie autant vos gains que vos pertes. Restez prudent et adaptez-le à votre tolérance au risque.",
  },
  {
    icon: Activity,
    title: 'Surveillez les indicateurs de marché',
    text: "Avant chaque entrée, vérifiez les tendances, le volume et les niveaux de support/résistance pour confirmer votre analyse.",
  },
  {
    icon: TrendingUp,
    title: 'Respectez votre stratégie de trading',
    text: "Ne tradez jamais sous le coup de l'émotion. Suivez votre plan, vos stop-loss et vos objectifs de prise de profit.",
  },
  {
    icon: ShieldAlert,
    title: 'Diversifiez vos positions',
    text: "Évitez de concentrer votre capital sur un seul actif. La diversification réduit l'exposition à un événement défavorable.",
  },
  {
    icon: Activity,
    title: 'Définissez toujours un Stop-Loss',
    text: "Un stop-loss est votre meilleure protection. Il limite vos pertes et préserve votre capital pour les opportunités futures.",
  },
  {
    icon: TrendingUp,
    title: 'Le trading comporte des risques',
    text: "Ne tradez que l'argent que vous pouvez vous permettre de perdre. Les performances passées ne garantissent pas les résultats futurs.",
  },
];

interface Props {
  progress: number; // 0-100
}

const TradingLoadingScreen = ({ progress }: Props) => {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % ADVICES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const advice = ADVICES[currentIdx];
  const Icon = advice.icon;

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1b1b2f] via-[#1e1e3a] to-[#16162a] px-6">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <BarChart3 className="w-7 h-7 text-[#4a90d9]" />
          <h1 className="text-2xl font-bold text-[#e2e4ea] tracking-tight">
            Préparation de votre plateforme de trading
          </h1>
        </div>

        {/* Advice card */}
        <div
          key={currentIdx}
          className="bg-[#252540]/80 backdrop-blur-sm border border-[#3a3a52] rounded-xl p-8 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-400/80 font-semibold mb-2">
                Conseil de prévention
              </p>
              <h3 className="text-lg font-semibold text-[#e2e4ea] mb-2">{advice.title}</h3>
              <p className="text-sm text-[#a0a4b8] leading-relaxed">{advice.text}</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8a8fa3]">Chargement des cours et données de marché…</span>
            <span className="text-[#4a90d9] font-mono font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-[#2d2d44] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4a90d9] to-[#5cb3ff] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-center gap-1.5 pt-2">
            {ADVICES.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === currentIdx ? 'w-6 bg-[#4a90d9]' : 'w-1.5 bg-[#3a3a52]'
                }`}
              />
            ))}
          </div>
        </div>

        <p className="text-center text-[10px] text-[#6b7082] mt-8 italic">
          Les marchés financiers comportent des risques. Tradez de manière responsable.
        </p>
      </div>
    </div>
  );
};

export default TradingLoadingScreen;
