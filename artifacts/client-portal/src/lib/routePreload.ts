// Route chunk preloader — invoked on link hover/focus so the JS chunk is ready
// by the time the user clicks. Eliminates the perceived "page jump".

type Loader = () => Promise<unknown>;

const loaders: Record<string, Loader> = {
  '/client/dashboard': () => import('@/pages/client/ClientDashboard'),
  '/client/profile': () => import('@/pages/client/ClientProfile'),
  '/client/contracts': () => import('@/pages/client/ClientContracts'),
  '/client/products': () => import('@/pages/client/ClientProducts'),
  '/client/trading': () => import('@/pages/client/ClientTrading'),
  '/client/simulator': () => import('@/pages/client/ClientSimulator'),
  '/client/documents': () => import('@/pages/client/ClientDocuments'),
  '/client/withdrawal': () => import('@/pages/client/ClientWithdrawal'),
  '/client/history': () => import('@/pages/client/ClientHistory'),
  '/client/news': () => import('@/pages/client/ClientNews'),
  '/client/help': () => import('@/pages/client/ClientHelp'),
  '/client/links': () => import('@/pages/client/ClientLinks'),
};

const loaded = new Set<string>();

export function preloadRoute(path: string) {
  const loader = loaders[path];
  if (!loader || loaded.has(path)) return;
  loaded.add(path);
  // Fire and forget — failures will be retried on real navigation.
  loader().catch(() => loaded.delete(path));
}

/**
 * Idle-time prefetch of all client routes after first paint.
 * Cheap and one-shot.
 */
export function prefetchAllClientRoutesIdle() {
  const run = () => Object.keys(loaders).forEach(preloadRoute);
  if (typeof window === 'undefined') return;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(run, { timeout: 2500 });
  } else {
    w.setTimeout(run, 1500);
  }
}
