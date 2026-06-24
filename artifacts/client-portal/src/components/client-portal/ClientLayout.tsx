import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { callCrmApi, getStoredUser, isCrmAdvisorMissingError, isCrmProfileMissingError } from '@/lib/crmApi';
import { usePrefetchClientData } from '@/hooks/useClientData';
import { useClientRealtimeSync } from '@/hooks/useClientRealtimeSync';
import { useCrm } from '@/contexts/CrmContext';
import {
  LayoutDashboard, User, FileText, Package, Upload, LogOut, Menu, X,
  Wallet, Clock, Newspaper, HelpCircle, Link2, UserCircle, BarChart3, MessageCircle,
  ChevronLeft, ChevronRight, ChevronDown, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ClientQRCode from './ClientQRCode';
import NotificationBell from './NotificationBell';
import PWAInstallPrompt from './PWAInstallPrompt';
import OfflineBanner from './OfflineBanner';
import PageTransition from './PageTransition';
import OnboardingTour from './OnboardingTour';
import BrandLogo from './BrandLogo';
import { ClientShellSkeleton } from './ClientPageFallback';

import { ClientNotificationsProvider } from '@/contexts/ClientNotificationsContext';
import { gradientStyle } from '@/components/settings/GradientColorPicker';
import { startTracking, track, flushNow } from '@/lib/clientTracking';
import { logConnection } from '@/lib/connectionLog';
import { fetchPortalBranding, getCachedPortalBranding, isPortalBrandingFresh, type PortalBranding } from '@/lib/portalBranding';
import { usePresence } from '@/hooks/usePresence';
import { supabase as crmSupabase, syncCrmRealtimeAuth } from '@/lib/crmSupabaseClient';
import luxempartLogo from '@/assets/luxempart-logo.svg';
import luxempartLogoWhite from '@/assets/luxempart-logo-white.svg';

type NavItem = { label: string; icon: any; path: string; key: string };

// Prefetch map: hovering a nav item triggers the dynamic import before the click.
// The browser downloads the chunk in the background — click lands instantly.
const ROUTE_PREFETCHES: Record<string, () => Promise<unknown>> = {
  '/client/dashboard':  () => import('@/pages/client/ClientDashboard'),
  '/client/profile':    () => import('@/pages/client/ClientProfile'),
  '/client/contracts':  () => import('@/pages/client/ClientContracts'),
  '/client/documents':  () => import('@/pages/client/ClientDocuments'),
  '/client/products':   () => import('@/pages/client/ClientProducts'),
  '/client/trading':    () => import('@/pages/client/ClientTrading'),
  '/client/simulator':  () => import('@/pages/client/ClientSimulator'),
  '/client/withdrawal': () => import('@/pages/client/ClientWithdrawal'),
  '/client/history':    () => import('@/pages/client/ClientHistory'),
  '/client/news':       () => import('@/pages/client/ClientNews'),
  '/client/help':       () => import('@/pages/client/ClientHelp'),
  '/client/links':      () => import('@/pages/client/ClientLinks'),
};
const prefetch = (path: string) => ROUTE_PREFETCHES[path]?.();

const CLIENT_MESSAGES_READ_EVENT = 'client-messages-read';
const CLIENT_MESSAGES_READ_STORAGE_KEY = 'client_messages_last_read_at';

type NavSection = {
  title: string;
  items: NavItem[];
};

const allNavItems: NavItem[] = [
  { label: 'Accueil', icon: LayoutDashboard, path: '/client/dashboard', key: 'dashboard' },
  { label: 'Les placements', icon: Package, path: '/client/products', key: 'products' },
  { label: 'Trading', icon: BarChart3, path: '/client/trading', key: 'trading' },
  { label: 'Mes contrats', icon: FileText, path: '/client/contracts', key: 'contracts' },
  { label: 'Retrait de fonds', icon: Wallet, path: '/client/withdrawal', key: 'withdrawal' },

  { label: 'Actu et info', icon: Newspaper, path: '/client/news', key: 'news' },
  { label: 'Ma messagerie', icon: MessageCircle, path: '/client/help', key: 'help' },
  { label: 'Mon compte', icon: UserCircle, path: '/client/profile', key: 'profile' },
];

const sectionDefs: { title: string; keys: string[] }[] = [
  { title: 'Tableau de bord', keys: ['dashboard'] },
  { title: 'Investissements', keys: ['products', 'trading'] },
  { title: 'Mes services', keys: ['contracts', 'withdrawal', 'history', 'news'] },
  { title: 'Support et compte', keys: ['help', 'profile'] },
];

const ClientLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [clientName, setClientName] = useState('');
  const [clientAccount, setClientAccount] = useState<any>(null);
  const [portalSettings, setPortalSettings] = useState<PortalBranding | null>(() => getCachedPortalBranding());
  const [unreadCount, setUnreadCount] = useState(0);
  const [messagingUnavailable, setMessagingUnavailable] = useState(false);
  const [onboardingTriggerKey, setOnboardingTriggerKey] = useState(0);
  const [tradingActive, setTradingActive] = useState<boolean>(true);

  const markMessagesRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setUnreadCount(0);
    localStorage.setItem(CLIENT_MESSAGES_READ_STORAGE_KEY, readAt);
    window.dispatchEvent(new Event(CLIENT_MESSAGES_READ_EVENT));

    try {
      const conversation = await callCrmApi<any>('client-messaging', 'get-conversation');
      const profileId = conversation?.myProfileId ?? conversation?.clientProfileId ?? null;
      if (!profileId) return;

      await crmSupabase
        .from('conversation_members')
        .update({ last_read_at: readAt })
        .eq('profile_id', profileId);
    } catch {
      // The local read marker keeps the sidebar badge hidden even if the CRM read receipt is delayed.
    }
  }, []);

  const getUnreadAfterLastLocalRead = useCallback(async (serverCount: number) => {
    const lastReadAt = localStorage.getItem(CLIENT_MESSAGES_READ_STORAGE_KEY);
    if (!lastReadAt || serverCount <= 0) return serverCount;

    try {
      const conversation = await callCrmApi<any>('client-messaging', 'get-conversation');
      const profileId = conversation?.myProfileId ?? conversation?.clientProfileId ?? null;
      if (!profileId) return serverCount;

      const { data: memberships, error: membershipsError } = await crmSupabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('profile_id', profileId);

      const conversationIds = Array.from(new Set((memberships || []).map(m => m.conversation_id).filter(Boolean)));
      if (membershipsError || conversationIds.length === 0) return serverCount;

      const { count, error } = await crmSupabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', profileId)
        .gt('created_at', lastReadAt);

      if (error || typeof count !== 'number') return serverCount;
      return count;
    } catch {
      return serverCount;
    }
  }, []);

  // Live-listen to leads.trading_active to hide/show Trading nav item
  useEffect(() => {
    const leadId = clientAccount?.lead_id;
    if (!leadId) return;
    let cancelled = false;

    const refreshTradingStatus = async () => {
      const { data, error } = await crmSupabase
        .from('leads')
        .select('trading_active')
        .eq('id', leadId)
        .maybeSingle();

      if (!cancelled && !error) setTradingActive(!!(data as any)?.trading_active);
    };

    let poll: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof crmSupabase.channel> | null = null;

    syncCrmRealtimeAuth().then(() => {
      if (cancelled) return;

      refreshTradingStatus();

      channel = crmSupabase
        .channel(`lead-nav-${leadId}`)
        .on('broadcast', { event: 'trading_mode_changed' }, ({ payload }) => {
          setTradingActive(!!payload?.trading_active);
        })
        .on(
          'postgres_changes' as any,
          { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
          (payload: any) => setTradingActive(!!payload.new?.trading_active),
        )
        .subscribe();

      // Polling fallback (toutes les 20s) au cas où le realtime soit coupé
      poll = setInterval(refreshTradingStatus, 20_000);
    });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (channel) crmSupabase.removeChannel(channel);
    };
  }, [clientAccount?.lead_id]);

  // Start the analytics buffer once.
  useEffect(() => {
    startTracking();
  }, []);

  // Login log is fired directly inside loadClientData() once clientAccountId is confirmed.

  // Track route changes (page_view) — log to analytics + CRM journal
  useEffect(() => {
    track('page_view', { path: location.pathname });
    if (!clientAccount?.id) return;
    const pageLabel = allNavItems.find(n => location.pathname.startsWith(n.path))?.label
      ?? ({ '/client/simulator': 'Simulateur', '/client/history': 'Historique', '/client/documents': 'Documents', '/client/links': 'Liens utiles' } as Record<string, string>)[location.pathname]
      ?? location.pathname;
    callCrmApi('manage-client-accounts', 'log-activity', {
      clientAccountId: clientAccount.id,
      activityAction: 'page_view',
      details: pageLabel,
    }).catch(() => {});
  }, [location.pathname, clientAccount?.id]);

  // Load portal settings via public-config with local stale-while-revalidate cache
  useEffect(() => {
    if (portalSettings && isPortalBrandingFresh()) return;
    fetchPortalBranding().then(setPortalSettings).catch(() => {});
  }, []);

  // Realtime: refetch branding when CRM admins update portal settings
  useEffect(() => {
    let cancelled = false;
    const refreshConfig = () => {
      fetchPortalBranding().then((b) => { if (!cancelled) setPortalSettings(b); }).catch(() => {});
    };
    let channel: ReturnType<typeof crmSupabase.channel> | null = null;
    syncCrmRealtimeAuth().then(() => {
      if (cancelled) return;
      channel = crmSupabase
        .channel('public-config-sync')
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'client_portal_settings' }, refreshConfig)
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'branding_settings' }, refreshConfig)
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) crmSupabase.removeChannel(channel);
    };
  }, []);

  // Build visible sections based on settings
  const navSections: NavSection[] = useMemo(() => {
    const configuredItems = portalSettings?.menu_config?.filter(m => m.visible !== false) ?? [];
    const visibleKeys = new Set(
      configuredItems.length > 0
        ? configuredItems.map(item => item.key)
        : allNavItems.map(item => item.key)
    );
    if (!tradingActive) visibleKeys.delete('trading');

    return sectionDefs
      .map(sd => ({
        title: sd.title,
        items: sd.keys
          .filter(k => visibleKeys.has(k))
          .map(k => allNavItems.find(n => n.key === k)!)
          .filter(Boolean),
      }))
      .filter(s => s.items.length > 0);
  }, [portalSettings, tradingActive]);

  // Init open sections
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach(s => { initial[s.title] = true; });
    setOpenSections(initial);
  }, [navSections]);

  // Auto-open section containing active route
  useEffect(() => {
    navSections.forEach(section => {
      if (section.items.some(item => location.pathname === item.path)) {
        setOpenSections(prev => ({ ...prev, [section.title]: true }));
      }
    });
  }, [location.pathname, navSections]);

  const { user: crmUser, profile: crmProfile, loading: crmLoading, authReady, signOut } = useCrm();

  // Prefetch all client data as soon as lead_id is known
  usePrefetchClientData(clientAccount?.lead_id);
  useClientRealtimeSync(clientAccount?.lead_id);
  usePresence(clientAccount?.id);

  // Redirect to login only after auth is fully resolved
  useEffect(() => {
    if (!authReady) return;
    if (!crmUser) {
      navigate('/client/login', { replace: true });
      return;
    }

    const storedUser = crmUser ?? getStoredUser();

    // Load client data from CRM
    const loadClientData = async () => {
      try {
        const profile = await callCrmApi('client-self-service', 'get-profile');
        const fallbackLeadId = storedUser?.user_metadata?.lead_id ?? crmProfile?.lead_id ?? null;
        const resolvedLeadId = profile?.clientAccount?.lead_id || profile?.lead?.id || fallbackLeadId;

        if (!resolvedLeadId) {
          if (crmProfile?.lead_id) {
            setClientAccount({
              id: crmProfile.id,
              lead_id: crmProfile.lead_id,
              user_id: crmProfile.user_id,
            });
            setClientName(storedUser?.email || 'Client');
          }
          return;
        }

        // If the API didn't return a client_account id, fetch it from the DB
        let clientAccountId = profile?.clientAccount?.id ?? null;
        const userId = profile?.clientAccount?.user_id ?? storedUser?.id ?? null;
        if (!clientAccountId && userId) {
          try {
            const { supabase: crmDb } = await import('@/lib/crmSupabaseClient');
            const { data: caRow } = await crmDb
              .from('client_accounts')
              .select('id')
              .eq('user_id', userId)
              .maybeSingle();
            if (caRow?.id) clientAccountId = caRow.id;
          } catch {}
        }

        setClientAccount({
          id: clientAccountId,
          lead_id: resolvedLeadId,
          user_id: userId,
        });

        // Log login once — fired here where token is guaranteed fresh and id resolved
        if (clientAccountId && sessionStorage.getItem('lx.pending_login_log') === '1') {
          sessionStorage.removeItem('lx.pending_login_log');
          logConnection(clientAccountId, 'login');
          callCrmApi('manage-client-accounts', 'log-activity', {
            clientAccountId,
            activityAction: 'login',
            details: 'Connexion',
          }).catch(() => {});
        }

        if (profile?.lead) {
          const fullName = `${profile.lead.prenom || ''} ${profile.lead.nom || ''}`.trim();
          setClientName(fullName || storedUser?.email || 'Client');
        } else {
          setClientName(storedUser?.email || 'Client');
        }
      } catch {
        // Use CRM context profile as fallback
        if (crmProfile?.lead_id) {
          setClientAccount({
            id: crmProfile.id,
            lead_id: crmProfile.lead_id,
            user_id: crmProfile.user_id,
          });
        }
        setClientName(storedUser?.email || 'Client');
      }

      // Get unread messages count
      callCrmApi('client-messaging', 'get-unread')
        .then(async (res: any) => {
          const serverCount = res?.unreadCount ?? res?.count ?? 0;
          setUnreadCount(await getUnreadAfterLastLocalRead(serverCount));
        })
        .catch((error) => {
          if (isCrmProfileMissingError(error) || isCrmAdvisorMissingError(error)) {
            setMessagingUnavailable(true);
          }
          setUnreadCount(0);
        });
    };
    loadClientData();
  }, [authReady, crmProfile, crmUser, navigate, getUnreadAfterLastLocalRead]);

  // Poll unread messages + reset when entering /client/help
  useEffect(() => {
    if (!clientAccount || messagingUnavailable) return;

    const refresh = async () => {
      try {
        const res = await callCrmApi('client-messaging', 'get-unread');
        const serverCount = res?.unreadCount ?? res?.count ?? 0;
        setUnreadCount(await getUnreadAfterLastLocalRead(serverCount));
      } catch (error) {
        if (isCrmProfileMissingError(error) || isCrmAdvisorMissingError(error)) {
          setMessagingUnavailable(true);
        }
        setUnreadCount(0);
      }
    };

    // When the user lands on the messaging page, hide the badge immediately
    if (location.pathname === '/client/help') {
      markMessagesRead();
      return;
    }

    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [clientAccount, messagingUnavailable, location.pathname, getUnreadAfterLastLocalRead, markMessagesRead]);

  useEffect(() => {
    const handleMessagesRead = () => setUnreadCount(0);
    window.addEventListener(CLIENT_MESSAGES_READ_EVENT, handleMessagesRead);
    return () => window.removeEventListener(CLIENT_MESSAGES_READ_EVENT, handleMessagesRead);
  }, []);


  const handleLogout = async () => {
    track('session_end', { reason: 'logout' });
    await flushNow();
    if (clientAccount?.id) {
      logConnection(clientAccount.id, 'logout');
      await callCrmApi('manage-client-accounts', 'log-activity', {
        clientAccountId: clientAccount.id,
        activityAction: 'logout',
      }).catch(() => {});
    }
    signOut();
    navigate('/client/login', { replace: true });
  };

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Luxempart branding (forced, overrides DB config)
  const colors = {
    primary: '#1A2B4A',
    secondary: '#152338',
    accent: '#2D5FA0',
    bg: '#FFFFFF',
    sidebar: '#FFFFFF',
    text: '#14181F',
  };

  const portalTitle = 'Luxempart';
  const headerLogoUrl = luxempartLogoWhite;
  const headerBannerUrl = null;
  const companyName = 'Luxempart';
  const headerTagline = '';
  const headerTextColor = '#FFFFFF';
  const headerStyle = 'minimal' as PortalBranding['header_style'];

  // Luxempart dark navy header — matches corporate site
  const headerBackgroundStyle = {
    background: 'linear-gradient(135deg, #080f1c 0%, #0e1d36 35%, #152338 65%, #1a2b4a 100%)',
  };
  const headerOverlay = 'transparent';

  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-[82vw] max-w-[300px] lg:w-64';

  // Show loading while auth is resolving - prevents premature redirect
  if (!authReady || crmLoading) {
    return <ClientShellSkeleton />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <ClientNotificationsProvider leadId={clientAccount?.lead_id} messagingEnabled={!messagingUnavailable}>
      <div className="min-h-screen client-content-light" style={gradientStyle(colors.bg)}>
        {/* Premium white-label header */}
        <header
          className="relative h-14 overflow-hidden border-b shadow-sm sm:h-[112px]"
          style={{ ...headerBackgroundStyle, borderColor: `${colors.primary}18` }}
        >
          <div className="absolute inset-0" style={{ background: headerOverlay }} aria-hidden="true" />
          <div className="relative z-10 flex h-full items-center justify-between px-3 sm:px-6 lg:px-8">
            {/* Left: burger + logo */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden flex-shrink-0 p-2 rounded-lg transition hover:bg-white/10"
                style={{ color: headerTextColor }}
                aria-label="Menu"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <img
                src={luxempartLogoWhite}
                alt="Luxempart"
                className="h-8 sm:h-14 w-auto shrink-0"
                style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.25))' }}
              />
            </div>
            {/* Right: actions */}
            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
              {/* Guide — desktop only */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setOnboardingTriggerKey((k) => k + 1)}
                    className="hidden sm:flex p-2 rounded-lg transition hover:bg-white/10"
                    style={{ color: headerTextColor }}
                    aria-label="Revoir le guide de bienvenue"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Revoir le guide</TooltipContent>
              </Tooltip>
              <NotificationBell textColor={headerTextColor} accentColor={colors.accent} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/client/profile')}
                    className="hover:bg-white/10 px-2"
                    style={{ color: headerTextColor }}
                  >
                    <UserCircle className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Mon compte</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="hover:text-destructive hover:bg-white/10 px-2"
                style={{ color: headerTextColor }}
              >
                <LogOut className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <aside
            className={`fixed lg:sticky top-14 sm:top-0 left-0 h-[calc(100vh-3.5rem)] sm:h-screen ${sidebarWidth} transition-all duration-300 z-40 lg:translate-x-0 overflow-y-auto overflow-x-hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            style={{ ...gradientStyle(colors.sidebar), borderRight: `1px solid rgba(255,255,255,0.08)` }}
          >
            <nav className={`${collapsed ? 'p-2' : 'p-4'} space-y-3`}>
              {navSections.map(section => {
                if (collapsed) {
                  return (
                    <div key={section.title} className="space-y-1">
                      {section.items.map(item => {
                        const active = location.pathname === item.path;
                        const showBadge = item.key === 'help' && unreadCount > 0;
                        return (
                          <Tooltip key={item.path}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                                onMouseEnter={() => prefetch(item.path)}
                                className="w-full flex items-center justify-center p-2.5 rounded-lg transition-all relative"
                                style={{
                                  backgroundColor: active ? colors.accent : 'transparent',
                                  color: active ? '#ffffff' : `${colors.text}70`,
                                  boxShadow: active ? `0 4px 12px ${colors.accent}40` : 'none',
                                }}
                              >
                                <item.icon className="w-5 h-5 shrink-0" />
                                {showBadge && (
                                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                    {unreadCount}
                                  </span>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8}>
                              {item.label}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <div key={section.title} className="mt-2">
                    <div
                      className="w-full flex items-center gap-2 px-3 py-2 mb-2 select-none border-l-[3px] rounded-r-md"
                      style={{
                        borderColor: '#1A2B4A',
                        backgroundColor: 'rgba(26, 43, 74, 0.07)',
                      }}
                    >
                      <p
                        className="text-[14px] font-bold uppercase tracking-[0.12em]"
                        style={{ color: '#14181F' }}
                      >
                        {section.title}
                      </p>

                    </div>

                    <div className="space-y-0.5">

                      {section.items.map(item => {
                        const active = location.pathname === item.path;
                        const showBadge = item.key === 'help' && unreadCount > 0;
                        return (
                          <button
                            key={item.path}
                            onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                            onMouseEnter={() => prefetch(item.path)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative"
                            style={{
                              backgroundColor: active ? colors.accent : 'transparent',
                              color: active ? '#ffffff' : `${colors.text}99`,
                              boxShadow: active ? `0 4px 12px ${colors.accent}40` : 'none',
                            }}
                          >
                            <item.icon className="w-4 h-4 shrink-0" />
                            {item.label}
                            {showBadge && (
                              <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                );
              })}
            </nav>

            <div className="hidden lg:flex absolute bottom-4 left-0 right-0 justify-center">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="p-2 rounded-lg transition-all"
                style={{ backgroundColor: `${colors.text}10`, color: `${colors.text}70` }}
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>
          </aside>

          {/* Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 lg:hidden"
              style={{ background: 'rgba(0,0,0,0.45)', top: '3.5rem' }}
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main content */}
          <main
            className="flex-1 p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col pb-24 lg:pb-8 relative"
            style={{
              background:
                'radial-gradient(1200px 600px at 0% 0%, hsl(218 45% 94%) 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, hsl(215 50% 93%) 0%, transparent 60%), linear-gradient(180deg, hsl(218 25% 95%) 0%, hsl(215 20% 92%) 100%)',
            }}
          >
            <div className="flex-1">
              <PageTransition>
                <Outlet context={{ clientAccount, portalSettings }} />
              </PageTransition>
            </div>

          </main>

        </div>
        <OfflineBanner />
        <OnboardingTour
          primaryColor={colors.primary}
          accentColor={colors.accent}
          triggerKey={onboardingTriggerKey}
        />
      </div>
      </ClientNotificationsProvider>
    </TooltipProvider>
  );
};

export default ClientLayout;
