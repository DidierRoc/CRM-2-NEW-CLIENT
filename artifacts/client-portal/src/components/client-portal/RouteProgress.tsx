import { useEffect, useState } from 'react';

/**
 * Subtle top progress bar shown during lazy chunk loading.
 * Stays mounted under <Suspense fallback> — keeps the previous page visible
 * (no big skeleton flashes / no "page disappearing").
 */
const RouteProgress = ({ color = '#2D5FA0' }: { color?: string }) => {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    let mounted = true;
    let p = 8;
    const tick = () => {
      if (!mounted) return;
      // Ease toward 90% — finishes when Suspense unmounts this fallback
      p = p + Math.max(1, (90 - p) * 0.18);
      setProgress(p);
    };
    const id = window.setInterval(tick, 120);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <>
      {/* Thin top progress bar */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 right-0 top-0 z-[60] h-[3px] overflow-hidden"
      >
        <div
          className="h-full transition-[width] duration-150 ease-out"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)`,
            boxShadow: `0 0 10px ${color}80`,
          }}
        />
      </div>
      {/* Solid background filler — prevents the white flash when the previous
          page unmounts before the new lazy chunk has loaded. */}
      <div aria-hidden="true" className="min-h-[60vh] w-full bg-background" />
    </>
  );
};

export default RouteProgress;
