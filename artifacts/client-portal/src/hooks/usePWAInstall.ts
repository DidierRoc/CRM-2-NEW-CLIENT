import { useEffect, useState, useCallback } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const isLovablePreview = () =>
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com');

export function usePWAInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [canShow, setCanShow] = useState(false);
  const [installConfirmed, setInstallConfirmed] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    // Detect iOS Safari (no beforeinstallprompt support)
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    // Already installed?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    setIsInstalled(standalone);

    // Skip prompt logic if running inside Lovable preview iframe
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    const isPreviewHost =
      window.location.hostname.includes('id-preview--') ||
      window.location.hostname.includes('lovableproject.com');
    setIsPreview(isPreviewHost || inIframe);

    if (standalone || inIframe || isPreviewHost) return;

    // Cooldown after dismiss
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const cooledDown = !dismissedAt || Date.now() - dismissedAt > DISMISS_COOLDOWN_MS;

    if (ios && cooledDown) {
      setCanShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (cooledDown) setCanShow(true);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setCanShow(false);
      setDeferred(null);
      setInstallConfirmed(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    setCanShow(false);
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    const accepted = choice.outcome === 'accepted';
    if (accepted) setInstallConfirmed(true);
    return accepted;
  }, [deferred]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setCanShow(false);
  }, []);

  return {
    canShow,
    isInstalled,
    isIOS,
    isPreview,
    canInstall: Boolean(deferred) && !isLovablePreview(),
    installConfirmed,
    setInstallConfirmed,
    promptInstall,
    dismiss,
  };
}
