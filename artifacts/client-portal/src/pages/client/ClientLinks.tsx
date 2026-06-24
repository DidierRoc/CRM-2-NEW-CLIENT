import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, Link2, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const ClientLinks = () => {
  const { isIOS, isPreview, canInstall, promptInstall } = usePWAInstall();
  const { lang } = useLanguage();

  const handleInstall = async () => {
    if (isPreview) {
      toast(lang === 'en' ? 'Installation available after publishing' : 'Installation disponible après publication', {
        description: lang === 'en'
          ? 'For a real desktop/mobile install, open the published version or client domain.'
          : 'Pour une vraie installation ordinateur/mobile, ouvrez la version publiée ou le domaine client.',
      });
      return;
    }

    if (isIOS || !canInstall) {
      toast(lang === 'en' ? 'Manual installation' : 'Installation manuelle', {
        description: lang === 'en'
          ? 'Open the browser menu and choose "Add to Home Screen" or "Install app".'
          : 'Ouvrez le menu du navigateur puis choisissez "Ajouter à l\'écran d\'accueil" ou "Installer l\'application".',
      });
      return;
    }

    const installed = await promptInstall();
    if (installed) {
      toast.success(lang === 'en' ? 'App installed successfully' : 'FMC app a bien été installée', {
        description: lang === 'en'
          ? 'You can now open it from your home screen or browser.'
          : 'Vous pouvez maintenant l\'ouvrir depuis votre écran d\'accueil ou votre navigateur.',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">{lang === 'en' ? 'Useful links' : 'Liens utiles'}</h1>
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shrink-0">
              <Download className="w-8 h-8 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-semibold text-primary">FMC app</p>
              <h2 className="text-2xl font-bold text-foreground">{lang === 'en' ? 'Download the app' : "Télécharger l'application"}</h2>
              <p className="text-muted-foreground max-w-2xl">
                {lang === 'en'
                  ? 'Quickly access your client portal from mobile, tablet, or desktop.'
                  : 'Accédez rapidement à votre espace client depuis mobile, tablette ou ordinateur.'}
              </p>
            </div>
            <Button onClick={handleInstall} size="lg" className="shrink-0">
              <Download className="w-4 h-4" />
              {lang === 'en' ? 'Download' : 'Télécharger'}
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            <div className="rounded-xl border border-border/70 bg-card/80 p-4 flex gap-3">
              <Smartphone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">{lang === 'en' ? 'Mobile' : 'Mobile'}</p>
                <p className="text-sm text-muted-foreground">
                  {lang === 'en'
                    ? 'On iPhone: tap the share icon in Safari, then "Add to Home Screen".'
                    : 'Sur iPhone : partage Safari, puis "Sur l\'écran d\'accueil".'}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/80 p-4 flex gap-3">
              <Monitor className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">{lang === 'en' ? 'Desktop' : 'Ordinateur'}</p>
                <p className="text-sm text-muted-foreground">
                  {lang === 'en'
                    ? 'In Chrome or Edge: use the install button in the browser address bar.'
                    : 'Depuis Chrome ou Edge : utilisez le bouton d\'installation du navigateur.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            {lang === 'en' ? 'Resources' : 'Ressources'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{lang === 'en' ? 'Useful links will be available here soon.' : 'Les liens utiles seront bientôt disponibles ici.'}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientLinks;
