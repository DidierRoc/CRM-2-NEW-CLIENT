import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const OfflineBanner = () => {
  const [offline, setOffline] = useState(!navigator.onLine);
  const { lang } = useLanguage();

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(0_75%_55%)] text-white text-xs font-semibold shadow-lg premium-rise"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>{lang === 'en' ? 'Offline — connection required for your financial data' : 'Hors ligne — connexion requise pour vos données financières'}</span>
    </div>
  );
};

export default OfflineBanner;
