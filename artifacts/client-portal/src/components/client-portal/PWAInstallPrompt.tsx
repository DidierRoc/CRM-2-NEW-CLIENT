import { useState } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FLOATING_INSTALL_SEEN_KEY = 'fmc_app_install_floating_clicked';

const PWAInstallPrompt = () => {
  const { isInstalled, isIOS, isPreview, canInstall, promptInstall, dismiss } = usePWAInstall();
  const [floatingClicked, setFloatingClicked] = useState(
    () => localStorage.getItem(FLOATING_INSTALL_SEEN_KEY) === 'true'
  );
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (isPreview) {
      toast('Installation disponible après publication', {
        description: 'Pour une vraie installation ordinateur/mobile, ouvrez la version publiée ou le domaine client.',
      });
      return;
    }

    if (!canInstall) {
      toast('Installation non disponible pour le moment', {
        description: 'Ouvrez le site depuis Chrome, Edge ou Safari, puis utilisez le menu du navigateur pour installer FMC app.',
      });
      return;
    }

    const installed = await promptInstall();
    if (installed) {
      localStorage.setItem(FLOATING_INSTALL_SEEN_KEY, 'true');
      setFloatingClicked(true);
      toast.success('FMC app a bien été installée', {
        description: 'Vous pouvez maintenant y accéder depuis votre écran d’accueil ou votre navigateur.',
      });
    }
  };

  if (isInstalled || (floatingClicked && !showIOSGuide)) return null;

  return (
    <>
      {/* Floating bar */}
      {!floatingClicked && (
        <div
          className={cn(
            'fixed bottom-5 right-5 z-[60]',
            'w-[calc(100%-2.5rem)] max-w-sm sm:w-auto sm:min-w-[320px]',
            'rounded-2xl border border-border/70 bg-card/95 backdrop-blur-xl',
            'shadow-[var(--shadow-elegant)]',
            'p-3 flex items-center gap-3 premium-rise'
          )}
          role="dialog"
          aria-label="Télécharger FMC app"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-lg">
            <Download className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">FMC app</p>
            <p className="text-[11px] text-muted-foreground truncate">Télécharger l'application</p>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors shrink-0"
          >
            Télécharger
          </button>
          <button
            onClick={() => {
              dismiss();
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Manual install guide */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[hsl(220_30%_12%)] border border-white/10 p-5 premium-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Installer FMC app</h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-white/80">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span className="flex items-center gap-2">
                  Appuyez sur <Share className="w-4 h-4 inline text-[hsl(16_85%_60%)]" /> dans le menu du navigateur
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span>Choisissez <strong>« Ajouter à l'écran d'accueil »</strong> ou <strong>« Installer l'application »</strong></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <span>Confirmez avec <strong>« Ajouter »</strong></span>
              </li>
            </ol>
            <button
              onClick={() => {
                localStorage.setItem(FLOATING_INSTALL_SEEN_KEY, 'true');
                setFloatingClicked(true);
                dismiss();
                setShowIOSGuide(false);
                toast.success('Instructions de téléchargement confirmées', {
                  description: 'FMC app reste accessible depuis Liens utiles si vous souhaitez recommencer.',
                });
              }}
              className="mt-5 w-full py-2.5 rounded-xl bg-[hsl(16_85%_55%)] text-white text-sm font-semibold"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallPrompt;
