import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QrCode, Smartphone, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClientQRCodeProps {
  portalUrl: string;
  logoUrl?: string | null;
  primaryColor?: string;
  textColor?: string;
}

const ClientQRCode = ({ portalUrl, logoUrl, primaryColor = '#6366f1', textColor = '#f8fafc' }: ClientQRCodeProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="relative p-2 rounded-lg transition-all hover:scale-105 group"
          style={{ backgroundColor: `${primaryColor}20` }}
          title="Installer l'application"
        >
          <QrCode className="w-5 h-5" style={{ color: textColor }} />
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: primaryColor }}
          />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-lg">
            <Smartphone className="w-5 h-5" />
            Installer sur votre téléphone
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Scannez ce QR code avec votre téléphone pour accéder à votre espace client et l'installer en raccourci.
          </p>
          
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-2xl shadow-lg inline-block">
              <QRCodeSVG
                value={portalUrl}
                size={200}
                level="H"
                includeMargin={false}
                fgColor="#0f172a"
                bgColor="#ffffff"
                imageSettings={logoUrl ? {
                  src: logoUrl,
                  height: 40,
                  width: 40,
                  excavate: true,
                } : undefined}
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Comment installer :
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Scannez le QR code avec l'appareil photo</li>
              <li>Ouvrez le lien dans votre navigateur</li>
              <li><strong>iPhone</strong> : Partager → Ajouter à l'écran d'accueil</li>
              <li><strong>Android</strong> : Menu → Installer l'application</li>
            </ol>
          </div>

          <p className="text-[10px] text-muted-foreground/60">
            L'application s'installera comme un raccourci avec logo sur votre téléphone
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientQRCode;
