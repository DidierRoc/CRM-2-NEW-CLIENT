import { useEffect, useState, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, TrendingUp, Calculator, Shield, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/clientTracking';

const STORAGE_KEY = 'lovable.client.onboarding.done';

interface Step {
  icon: typeof Sparkles;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: 'Bienvenue dans votre espace',
    body:
      'Votre espace personnel regroupe vos contrats, vos performances et vos opérations. Tout est sécurisé et accessible à tout moment.',
  },
  {
    icon: TrendingUp,
    title: 'Suivez vos performances',
    body:
      'Le tableau de bord affiche votre capital, vos intérêts cumulés et votre projection à 12 mois — mis à jour quotidiennement.',
  },
  {
    icon: Calculator,
    title: 'Simulez et investissez',
    body:
      "Utilisez le simulateur pour visualiser un nouvel investissement, ou souscrivez directement à un contrat depuis l'onglet Contrats.",
  },
  {
    icon: MessageCircle,
    title: 'Votre assistant patrimonial',
    body:
      "Posez vos questions à tout moment via l'assistant en bas à droite. Il connaît vos contrats et vous aide à prendre les bonnes décisions.",
  },
  {
    icon: Shield,
    title: 'Vous êtes en sécurité',
    body:
      'Chiffrement bancaire, signature électronique légale, historique complet : votre confiance est notre priorité.',
  },
];

interface Props {
  primaryColor?: string;
  accentColor?: string;
  /** When set to a non-zero value, force the tour to (re)open (e.g. via help button). */
  triggerKey?: number;
}

export const hasCompletedOnboarding = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const OnboardingTour = ({
  primaryColor = '#1B3A5C',
  accentColor = '#2D5FA0',
  triggerKey = 0,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-open on first connection
  useEffect(() => {
    if (!hasCompletedOnboarding()) {
      setOpen(true);
      setStep(0);
      track('onboarding_start', { source: 'auto' });
    }
  }, []);

  // Manual reopen via help button
  useEffect(() => {
    if (triggerKey > 0) {
      setOpen(true);
      setStep(0);
      track('onboarding_start', { source: 'manual' });
    }
  }, [triggerKey]);

  const close = useCallback((reason: 'complete' | 'skip') => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    track(reason === 'complete' ? 'onboarding_complete' : 'onboarding_skip', {
      step,
    });
    setOpen(false);
  }, [step]);

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div
          className="relative p-6 pb-4"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
        >
          <button
            onClick={() => close('skip')}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-3">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">{current.title}</h2>
        </div>

        {/* Body */}
        <div className="p-6 pt-4">
          <p className="text-sm text-slate-600 leading-relaxed">{current.body}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6' : 'w-1.5 bg-slate-200'
                }`}
                style={i === step ? { backgroundColor: accentColor } : undefined}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 mt-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (step > 0 ? setStep(step - 1) : close('skip'))}
              className="text-slate-500"
            >
              {step > 0 ? (
                <>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Précédent
                </>
              ) : (
                'Passer'
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => (isLast ? close('complete') : setStep(step + 1))}
              className="text-white"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
            >
              {isLast ? "C'est parti" : 'Suivant'}
              {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
