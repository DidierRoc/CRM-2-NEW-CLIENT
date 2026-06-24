import { Component, type ReactNode, type ErrorInfo } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null; chunkError: boolean };

const isChunkLoadError = (err: unknown): boolean => {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading')
  );
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, chunkError: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, chunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    // Clear any stale chunk/cache state before reloading
    try {
      const CACHE_KEY = 'client-portal-live-updates-v23';
      localStorage.removeItem(CACHE_KEY);
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    const { error, chunkError } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f8f9fc',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '40px 32px',
            maxWidth: '420px',
            boxShadow: '0 4px 24px rgba(0,0,0,.08)',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111111', margin: '0 0 8px' }}>
            {chunkError ? 'Mise à jour disponible' : 'Une erreur est survenue'}
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
            {chunkError
              ? 'Une nouvelle version de la plateforme est disponible. Rechargez la page pour continuer.'
              : 'La page a rencontré un problème inattendu. Rechargez pour réessayer.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: '#111111',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
