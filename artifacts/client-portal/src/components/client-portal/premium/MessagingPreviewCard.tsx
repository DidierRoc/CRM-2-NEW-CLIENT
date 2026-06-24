import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { callCrmApi } from '@/lib/crmApi';
import { track } from '@/lib/clientTracking';

interface AdvisorInfo {
  name: string;
  avatarUrl: string | null;
}

const MessagingPreviewCard = () => {
  const navigate = useNavigate();
  const [advisor, setAdvisor] = useState<AdvisorInfo | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [lastPreview, setLastPreview] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const formatFromLogin = (login: string) => {
      const base = login.includes('@') ? login.split('@')[0] : login;
      return base.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
    };
    (async () => {
      try {
        const data: any = await callCrmApi('client-self-service', 'get-advisor');
        const a = data?.advisor || (data?.id ? data : null);
        if (!cancelled && a) {
          const prenom = (a.prenom || '').trim();
          const nom = (a.nom || '').trim();
          const fullName = `${prenom} ${nom}`.trim() || formatFromLogin(a.login || '') || 'Votre conseiller';
          setAdvisor({ name: fullName, avatarUrl: a.avatar_url || null });
        }
      } catch {}
      try {
        const res: any = await callCrmApi('client-messaging', 'get-unread');
        if (cancelled) return;
        setUnread(res?.unreadCount ?? res?.count ?? 0);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const open = () => {
    track('messaging_card_open', { source: 'dashboard' });
    navigate('/client/help');
  };

  const initials = (advisor?.name || 'C')
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('');

  return (
    <button
      type="button"
      onClick={open}
      className="group relative w-full sm:max-w-sm overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-primary to-[hsl(217_55%_22%)] text-primary-foreground text-left shadow-sm transition-all hover:shadow-md premium-rise"
      style={{ animationDelay: '160ms' }}
    >
      <div className="relative flex items-center gap-2.5 px-3 py-2">
        <div className="relative shrink-0">
          {advisor?.avatarUrl ? (
            <img src={advisor.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/25" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/25 flex items-center justify-center text-[11px] font-semibold">
              {initials || <MessageCircle className="w-4 h-4" />}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[hsl(217_55%_22%)]" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/60 font-semibold leading-none">
            Contacter votre conseiller
          </p>
          <h3 className="text-sm font-semibold leading-tight truncate mt-0.5">
            {advisor?.name || 'Votre conseiller'}
          </h3>
        </div>

        {unread > 0 && (
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[hsl(var(--accent))] text-[11px] font-semibold text-white">
            {unread}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-white/70 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
};

export default MessagingPreviewCard;
