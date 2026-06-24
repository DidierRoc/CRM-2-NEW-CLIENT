import { useEffect, useRef, useState } from 'react';

/**
 * Polling intelligent :
 * - Suspend quand l'onglet est masqué (visibilitychange)
 * - Suspend quand la fenêtre perd le focus
 * - Relance immédiatement au focus / retour visible
 * - Limite les re-renders : ne déclenche le tick qu'aux intervalles réels
 *
 * Usage :
 *   const tick = useSmartPolling(30000);
 *   useEffect(() => { refetch(); }, [tick]);
 */
export function useSmartPolling(intervalMs: number, enabled: boolean = true): number {
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef<boolean>(typeof document !== 'undefined' ? !document.hidden : true);

  useEffect(() => {
    if (!enabled) return;

    const start = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => {
        if (isActiveRef.current) setTick((t) => t + 1);
      }, intervalMs);
    };

    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleVisibility = () => {
      const visible = !document.hidden;
      isActiveRef.current = visible;
      if (visible) {
        // Relance immédiate au retour
        setTick((t) => t + 1);
        start();
      } else {
        stop();
      }
    };

    const handleFocus = () => {
      isActiveRef.current = true;
      setTick((t) => t + 1);
      start();
    };

    const handleBlur = () => {
      isActiveRef.current = false;
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    if (isActiveRef.current) start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [intervalMs, enabled]);

  return tick;
}
