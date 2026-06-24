import { useMemo, useState } from 'react';
import type { PortalBranding } from '@/lib/portalBranding';
import ubsLogoSrc from '@/assets/ubs-logo-transparent.png';

type BrandLogoSize = 'header' | 'login' | 'sidebar';
type LogoTone = 'dark' | 'light';

interface BrandLogoProps {
  branding: PortalBranding | null;
  size: BrandLogoSize;
  tone?: LogoTone;
  className?: string;
  showTextFallback?: boolean;
}

const sizeClasses: Record<BrandLogoSize, { frame: string; image: string; text: string; pad: string }> = {
  header: {
    frame: 'h-12 max-w-[165px] sm:h-16 sm:max-w-[220px]',
    image: 'max-h-12 max-w-[149px] sm:max-h-16 sm:max-w-[204px]',
    text: 'text-xl sm:text-2xl',
    pad: 'p-2',
  },
  login: {
    frame: 'h-28 w-full max-w-full justify-center sm:h-36',
    image: 'max-h-28 max-w-full sm:max-h-36',
    text: 'text-3xl sm:text-4xl',
    pad: 'p-3',
  },
  sidebar: {
    frame: 'h-9 max-w-[135px] sm:h-12 sm:max-w-[180px]',
    image: 'max-h-9 max-w-[119px] sm:max-h-12 sm:max-w-[164px]',
    text: 'text-lg sm:text-xl',
    pad: 'p-2',
  },
};

const hasTransparentExtension = (url: string) => /\.(png|webp|svg)(\?|#|$)/i.test(url);
const hasSolidExtension = (url: string) => /\.(jpe?g|avif)(\?|#|$)/i.test(url);

export default function BrandLogo({ branding, size, tone = 'dark', className = '', showTextFallback = true }: BrandLogoProps) {
  const [transparent, setTransparent] = useState<boolean | null>(null);
  const logoUrl = branding?.header_logo_url || branding?.logo_url || ubsLogoSrc;
  const companyName = branding?.company_name || branding?.portal_title || '';
  const classes = sizeClasses[size];

  const shouldUseWhiteCard = useMemo(() => {
    if (!logoUrl || tone !== 'dark') return false;
    if (transparent === true) return false;
    if (transparent === false) return true;
    return hasSolidExtension(logoUrl) || !hasTransparentExtension(logoUrl);
  }, [logoUrl, tone, transparent]);

  const handleLogoLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!logoUrl || hasSolidExtension(logoUrl)) {
      setTransparent(false);
      return;
    }
    if (!hasTransparentExtension(logoUrl)) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx || !img.naturalWidth || !img.naturalHeight) return;
      canvas.width = Math.min(img.naturalWidth, 64);
      canvas.height = Math.min(img.naturalHeight, 64);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) {
          setTransparent(true);
          return;
        }
      }
      setTransparent(false);
    } catch {
      setTransparent(hasTransparentExtension(logoUrl));
    }
  };

  if (!logoUrl) {
    return null;
  }

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center ${classes.frame} ${classes.pad} ${shouldUseWhiteCard ? 'rounded-xl bg-white shadow-sm' : ''} ${className}`}
    >
      <img
        src={logoUrl}
        alt={companyName ? `Logo ${companyName}` : 'Logo société'}
        className={`block h-auto w-auto object-contain object-center ${classes.image}`}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        crossOrigin="anonymous"
        onLoad={handleLogoLoad}
        style={{
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))',
          imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'],
        }}
      />
    </div>
  );
}