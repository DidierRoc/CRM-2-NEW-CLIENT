import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Bell, Phone, Mail, Briefcase, ShieldCheck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { callCrmApi, isCrmAdvisorMissingError, isCrmProfileMissingError } from '@/lib/crmApi';
import { supabase, syncCrmRealtimeAuth } from '@/lib/crmSupabaseClient';
import ProfessionalChat from '@/components/client-portal/ProfessionalChat';
import type { Message } from '@/types/messaging';
import { ClientRowsSkeleton } from '@/components/client-portal/ClientPageFallback';
import { flushNow, track } from '@/lib/clientTracking';

interface AdvisorProfile {
  id: string;
  login: string;
  nom?: string | null;
  prenom?: string | null;
  email: string;
  telephone: string | null;
  fonction: string | null;
  avatar_url: string | null;
  description?: string | null;
  biographie?: string | null;
}

interface ConversationResponse {
  conversationId?: string | null;
  myProfileId?: string | null;
  clientProfileId?: string | null;
  advisorName?: string | null;
  advisorAvatar?: string | null;
  advisor?: {
    id?: string;
    login?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
}

const CLIENT_MESSAGES_READ_EVENT = 'client-messages-read';
const CLIENT_MESSAGES_READ_STORAGE_KEY = 'client_messages_last_read_at';

const notifyMessagesRead = (readAt = new Date().toISOString()) => {
  localStorage.setItem(CLIENT_MESSAGES_READ_STORAGE_KEY, readAt);
  window.dispatchEvent(new Event(CLIENT_MESSAGES_READ_EVENT));
};

const buildAdvisorDisplayName = (data: ConversationResponse | null | undefined): string => {
  const advisor: any = data?.advisor;
  const prenom = advisor?.prenom?.trim?.();
  const nom = advisor?.nom?.trim?.();
  if (prenom || nom) return [prenom, nom].filter(Boolean).join(' ');
  const raw = data?.advisorName ?? advisor?.login;
  if (!raw) return 'Votre conseiller';
  if (raw.includes('@')) {
    return raw.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  return raw;
};

const getConversationMeta = (data: ConversationResponse | null | undefined) => ({
  conversationId: data?.conversationId ?? null,
  myProfileId: data?.myProfileId ?? data?.clientProfileId ?? null,
  advisorProfileId: data?.advisor?.id ?? null,
  advisorName: buildAdvisorDisplayName(data),
  advisorAvatar: data?.advisorAvatar ?? data?.advisor?.avatar_url ?? null,
});

const normalizeMessage = (message: any, myProfileId: string | null, advisorName: string): Message => ({
  id: message.id,
  conversation_id: message.conversation_id,
  sender_id: message.sender_id,
  content: message.content,
  created_at: message.created_at,
  senderLogin: message.sender_id === myProfileId ? 'Moi' : advisorName,
  attachment_url: message.attachment_url ?? null,
  attachment_name: message.attachment_name ?? null,
});

const mergeMessages = (current: Message[], incoming: Message[]) => {
  const byId = new Map<string, Message>();
  [...current, ...incoming].forEach(message => byId.set(message.id, message));
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

const persistConversationMessages = (convId: string, incoming: Message[]) => {
  const cacheKey = `conv_${convId}`;
  let cachedMessages: Message[] = [];
  try {
    const cached = localStorage.getItem(cacheKey);
    cachedMessages = cached ? JSON.parse(cached) : [];
    if (!Array.isArray(cachedMessages)) cachedMessages = [];
  } catch {
    cachedMessages = [];
  }
  const merged = mergeMessages(cachedMessages, incoming);
  localStorage.setItem(cacheKey, JSON.stringify(merged));
  return merged;
};

const resolveStableConversation = async (
  conversationId: string | null,
  myProfileId: string | null,
  advisorProfileId: string | null
) => {
  if (!myProfileId) return conversationId;

  const { data: memberships } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('profile_id', myProfileId);

  const conversationIds = Array.from(new Set((memberships || []).map(m => m.conversation_id).filter(Boolean)));
  let stableConversationId = conversationId;

  if (conversationId && conversationIds.includes(conversationId)) {
    stableConversationId = conversationId;
  } else if (conversationIds.length > 0) {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, created_at, is_group')
      .in('id', conversationIds)
      .eq('is_group', false)
      .order('created_at', { ascending: true });

    stableConversationId = conversations?.[0]?.id ?? conversationId;
  }

  if (stableConversationId) {
    const { data: existingClientMember } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', stableConversationId)
      .eq('profile_id', myProfileId)
      .maybeSingle();

    if (!existingClientMember) {
      await supabase
        .from('conversation_members')
        .insert({ conversation_id: stableConversationId, profile_id: myProfileId });
    }
  }

  if (stableConversationId && advisorProfileId) {
    const { data: existingAdvisorMember } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', stableConversationId)
      .eq('profile_id', advisorProfileId)
      .maybeSingle();

    if (!existingAdvisorMember) {
      await supabase
        .from('conversation_members')
        .insert({ conversation_id: stableConversationId, profile_id: advisorProfileId });
    }
  }

  return stableConversationId;
};

const ClientHelp = () => {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState('messages');

  return (
    <div className="space-y-6">
      {/* Bank-style secure header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary via-primary to-[hsl(217_55%_22%)] text-primary-foreground shadow-[0_20px_50px_-25px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 45%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.08), transparent 50%)" }} />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20 shrink-0">
              <MessageCircle className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-semibold">{lang === 'en' ? 'Secure area' : 'Espace sécurisé'}</p>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{lang === 'en' ? 'Private messaging' : 'Messagerie privée'}</h1>
              <p className="text-sm text-white/70 mt-1 max-w-md">
                {lang === 'en' ? 'Communicate confidentially with your dedicated advisor.' : 'Échangez en toute confidentialité avec votre conseiller dédié.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-xs font-medium ring-1 ring-white/15">
              <Lock className="w-3.5 h-3.5" /> {lang === 'en' ? 'End-to-end encryption' : 'Chiffrement de bout en bout'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-medium text-emerald-100 ring-1 ring-emerald-300/30">
              <ShieldCheck className="w-3.5 h-3.5" /> {lang === 'en' ? 'Verified channel' : 'Canal vérifié'}
            </span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-12 p-1 bg-card border border-border/60 rounded-xl shadow-sm">
          <TabsTrigger value="messages" className="gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <MessageCircle className="w-4 h-4" /> Messages
          </TabsTrigger>
          <TabsTrigger value="alertes" className="gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <Bell className="w-4 h-4" /> {lang === 'en' ? 'Alerts' : 'Alertes'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-5">
          <MessagesTab />
        </TabsContent>
        <TabsContent value="alertes" className="mt-5">
          <AlertesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ─── MESSAGES TAB ─── */
const CONV_META_CACHE_KEY = 'client-conv-meta-v1';

const readConvMetaCache = () => {
  try {
    const raw = localStorage.getItem(CONV_META_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const writeConvMetaCache = (meta: { conversationId: string; myProfileId: string; advisorName: string; advisorAvatar: string | null }) => {
  try { localStorage.setItem(CONV_META_CACHE_KEY, JSON.stringify(meta)); } catch {}
};

const MessagesTab = () => {
  const { lang } = useLanguage();
  const cachedMeta = readConvMetaCache();
  const [conversationId, setConversationId] = useState<string | null>(cachedMeta?.conversationId ?? null);
  const [myProfileId, setMyProfileId] = useState<string | null>(cachedMeta?.myProfileId ?? null);
  const [advisorName, setAdvisorName] = useState(cachedMeta?.advisorName ?? '');
  const [advisorAvatar, setAdvisorAvatar] = useState<string | null>(cachedMeta?.advisorAvatar ?? null);
  const [memberLastRead, setMemberLastRead] = useState<Map<string, string>>(new Map());
  // If we have cached metadata, skip the loading skeleton — show chat immediately
  const [loading, setLoading] = useState(!cachedMeta?.conversationId);
  const [messagingUnavailable, setMessagingUnavailable] = useState(false);
  const [noAdvisorAssigned, setNoAdvisorAssigned] = useState(false);
  const [chatOpenTracked, setChatOpenTracked] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await callCrmApi<ConversationResponse>('client-messaging', 'get-conversation');
        if (data) {
          const meta = getConversationMeta(data);
          const stableConversationId = await resolveStableConversation(
            meta.conversationId,
            meta.myProfileId,
            meta.advisorProfileId
          );
          setConversationId(stableConversationId);
          setMyProfileId(meta.myProfileId);
          setAdvisorName(meta.advisorName);
          setAdvisorAvatar(meta.advisorAvatar);
          if (stableConversationId && meta.myProfileId) {
            writeConvMetaCache({
              conversationId: stableConversationId,
              myProfileId: meta.myProfileId,
              advisorName: meta.advisorName,
              advisorAvatar: meta.advisorAvatar,
            });
          }
          if (stableConversationId) {
            notifyMessagesRead();
            track('help_chat_open', { conversationId: stableConversationId, source: 'help_messages_tab' });
            flushNow();
            setChatOpenTracked(true);
          }
        }
      } catch (err: any) {
        if (isCrmAdvisorMissingError(err)) {
          setNoAdvisorAssigned(true);
          setConversationId(null);
          setMyProfileId(null);
          return;
        }

        if (isCrmProfileMissingError(err)) {
          setMessagingUnavailable(true);
          setConversationId(null);
          setMyProfileId(null);
          return;
        }

        if (err?.status === 401 || err?.message?.includes('401') || err?.message?.includes('expirée')) {
          setMessagingUnavailable(true);
          setConversationId(null);
          setMyProfileId(null);
          return;
        }

        // Non-fatal: we already show content from cache, just log
        console.error('Failed to init messaging', err);
        if (!conversationId) setMessagingUnavailable(true);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!conversationId || chatOpenTracked) return;
    track('help_chat_open', { conversationId, source: 'help_messages_tab' });
    flushNow();
    setChatOpenTracked(true);
  }, [conversationId, chatOpenTracked]);

  // Poll read receipts
  useEffect(() => {
    if (!conversationId) return;
    const fetchReads = async () => {
      const { data } = await supabase
        .from('conversation_members')
        .select('profile_id, last_read_at')
        .eq('conversation_id', conversationId);
      if (data) setMemberLastRead(new Map(data.map(d => [d.profile_id, d.last_read_at])));
    };
    fetchReads();
    const interval = setInterval(fetchReads, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const loadMessages = useCallback(async (convId: string): Promise<Message[]> => {
    await syncCrmRealtimeAuth();
    const { data, error } = await supabase
      .from('messages').select('*').eq('conversation_id', convId)
      .order('created_at', { ascending: true }).limit(500);

    if (error) {
      console.error('[messaging] load error', error);
      try {
        const cached = localStorage.getItem(`conv_${convId}`);
        const parsed = cached ? JSON.parse(cached) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    if (myProfileId) {
      const readAt = new Date().toISOString();
      await supabase
        .from('conversation_members')
        .update({ last_read_at: readAt })
        .eq('conversation_id', convId)
        .eq('profile_id', myProfileId);
      notifyMessagesRead(readAt);
    }

    const normalized = (data || []).map(m => normalizeMessage(m, myProfileId, advisorName));
    // Replace cache with fresh DB data (source of truth — deleted messages must disappear)
    localStorage.setItem(`conv_${convId}`, JSON.stringify(normalized));
    return normalized;
  }, [myProfileId, advisorName]);

  const sendMsg = useCallback(async (
    convId: string,
    content: string,
    attachment?: { url: string; name: string }
  ): Promise<Message | null> => {
    if (!myProfileId || messagingUnavailable) return null;
    try {
      const result = await callCrmApi('client-messaging', 'send-message', {
        conversationId: convId,
        content: content || (attachment ? `📎 ${attachment.name}` : ''),
        attachmentUrl: attachment?.url,
        attachmentName: attachment?.name,
      });
      track('help_message_sent', {
        conversationId: convId,
        hasAttachment: Boolean(attachment),
        length: (content || '').length,
        source: 'help_messages_tab',
      });
      flushNow();
      const sentMessage = {
        id: result?.id || crypto.randomUUID(),
        conversation_id: convId,
        sender_id: myProfileId,
        content: content || (attachment ? `📎 ${attachment.name}` : ''),
        created_at: new Date().toISOString(),
        senderLogin: 'Moi',
        attachment_url: attachment?.url || null,
        attachment_name: attachment?.name || null,
      };
      persistConversationMessages(convId, [sentMessage]);
      return sentMessage;
    } catch (err) {
      if (isCrmProfileMissingError(err)) {
        setMessagingUnavailable(true);
      }
      return null;
    }
  }, [myProfileId, messagingUnavailable]);

  const subscribe = useCallback((convId: string, cb: (msg: Message) => void, onDelete?: (id: string) => void) => {
    let active = true;
    syncCrmRealtimeAuth();
    const channel = supabase
      .channel(`client-conv-${convId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        const m = payload.new as any;
        if (myProfileId) {
          const readAt = new Date().toISOString();
          supabase
            .from('conversation_members')
            .update({ last_read_at: readAt })
            .eq('conversation_id', convId)
            .eq('profile_id', myProfileId)
            .then(() => notifyMessagesRead(readAt));
        }
        const normalized = normalizeMessage(m, myProfileId, advisorName);
        persistConversationMessages(convId, [normalized]);
        cb(normalized);
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        if (!active) return;
        const deletedId = (payload.old as any)?.id;
        if (!deletedId) return;
        // Update localStorage cache
        try {
          const cacheKey = `conv_${convId}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const msgs: Message[] = JSON.parse(cached);
            localStorage.setItem(cacheKey, JSON.stringify(msgs.filter(m => m.id !== deletedId)));
          }
        } catch {}
        onDelete?.(deletedId);
      })
      .subscribe(async status => {
        if (!active) return;
        if (status === 'SUBSCRIBED') return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          await syncCrmRealtimeAuth(true);
        }
      });
    return () => { active = false; supabase.removeChannel(channel); };
  }, [myProfileId, advisorName]);

  if (messagingUnavailable) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground space-y-2">
          <p>{lang === 'en' ? 'Messaging temporarily unavailable.' : 'Messagerie temporairement indisponible.'}</p>
          <p className="text-xs">{lang === 'en' ? 'The CRM backend has not yet found the client profile required for the conversation.' : 'Le backend CRM ne trouve pas encore le profil client nécessaire à la conversation.'}</p>
        </CardContent>
      </Card>
    );
  }

  if (noAdvisorAssigned) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground space-y-2">
          <p>{lang === 'en' ? 'No advisor assigned yet.' : 'Aucun conseiller assigné pour le moment.'}</p>
          <p className="text-xs">{lang === 'en' ? "Messaging will be available once an advisor is assigned to you." : "La messagerie sera disponible dès qu’un conseiller vous sera attribué."}</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <ClientRowsSkeleton rows={5} />;
  }

  if (!conversationId || !myProfileId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">{lang === 'en' ? 'Conversation currently unavailable.' : 'Conversation indisponible pour le moment.'}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.25)]" style={{ height: '70vh' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-gradient-to-r from-card to-muted/40">
        <div className="flex items-center gap-3 min-w-0">
          {advisorAvatar ? (
            <img src={advisorAvatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
              {(advisorName || 'C').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{advisorName || (lang === 'en' ? 'Your advisor' : 'Votre conseiller')}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {lang === 'en' ? 'Dedicated advisor · private line' : 'Conseiller dédié · ligne privée'}
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="w-3 h-3" /> {lang === 'en' ? 'Encrypted' : 'Chiffré'}
        </span>
      </div>
      <div style={{ height: 'calc(70vh - 57px)' }}>
        <ProfessionalChat
          conversationId={conversationId}
          myProfileId={myProfileId}
          otherName={advisorName || (lang === 'en' ? 'Your advisor' : 'Votre conseiller')}
          otherAvatar={advisorAvatar}
          variant="panel"
          loadMessages={loadMessages}
          sendMessage={sendMsg}
          subscribeToMessages={subscribe}
          memberLastRead={memberLastRead}
        />
      </div>
    </Card>
  );
};

/* ─── ALERTES TAB ─── */
const AlertesTab = () => {
  const { lang } = useLanguage();
  return (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">
        <Bell className="w-5 h-5 text-primary" />
        {lang === 'en' ? 'Alerts & notifications' : 'Alertes et notifications'}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-center py-12 text-muted-foreground space-y-3">
        <Bell className="w-12 h-12 mx-auto opacity-30" />
        <p className="text-sm">{lang === 'en' ? 'No alerts at the moment' : 'Aucune alerte pour le moment'}</p>
        <p className="text-xs">{lang === 'en' ? 'This feature will be available soon.' : 'Cette fonctionnalité sera bientôt disponible.'}</p>
      </div>
    </CardContent>
  </Card>
  );
};

/* ─── CONSEILLER TAB ─── */
const formatAdvisorName = (login: string | null | undefined): string => {
  if (!login) return 'Votre conseiller';
  // If login is an email, extract the name part and format it
  const name = login.includes('@') ? login.split('@')[0] : login;
  return name
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

const isValidFonction = (f: string | null | undefined): boolean => {
  if (!f) return false;
  const hidden = ['sans_acces', 'sans acces', '', 'null', 'undefined'];
  return !hidden.includes(f.toLowerCase().trim());
};

const getAdvisorInitials = (advisor: AdvisorProfile): string => {
  const first = advisor.prenom?.trim()?.[0] || advisor.login?.trim()?.[0] || 'C';
  const last = advisor.nom?.trim()?.[0] || advisor.login?.trim()?.split(/\s+/)?.[1]?.[0] || '';
  return `${first}${last}`.toUpperCase();
};

const ConseillerTab = ({ onContactClick }: { onContactClick: () => void }) => {
  const [advisor, setAdvisor] = useState<AdvisorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    callCrmApi('client-self-service', 'get-advisor')
      .then(data => {
        if (data?.advisor) setAdvisor(data.advisor);
        else if (data?.id) setAdvisor(data as AdvisorProfile);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-48 rounded-xl bg-card/60 border border-border/40 animate-pulse" aria-hidden="true" />;
  }

  if (!advisor) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun conseiller assigné</CardContent></Card>;
  }

  const displayName = formatAdvisorName(advisor.login);
  const displayFonction = isValidFonction(advisor.fonction) ? advisor.fonction : null;
  const initials = getAdvisorInitials(advisor);

  const openAssistant = () => {
    onContactClick();
  };

  return (
    <>
    <Card className="overflow-hidden">
      <CardContent className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-10">
        <div className="flex flex-col items-center gap-5 mb-8 text-center">
          <div className="relative">
            {advisor.avatar_url ? (
              <img src={advisor.avatar_url} alt={displayName} className="w-[210px] h-[210px] rounded-2xl object-cover object-center shadow-2xl ring-4 ring-primary/20 ring-offset-4 ring-offset-background" />
            ) : (
              <div className="w-[210px] h-[210px] rounded-2xl bg-primary/10 flex items-center justify-center text-5xl font-semibold text-primary shadow-2xl ring-4 ring-primary/20 ring-offset-4 ring-offset-background">
                {initials}
              </div>
            )}
            <Button
              variant="outline"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/95 px-5 py-2.5 text-foreground shadow-xl border-border/70 backdrop-blur hover:bg-primary hover:text-primary-foreground hover:border-primary whitespace-nowrap"
              onClick={() => setProfileOpen(true)}
            >
              Voir le profil
            </Button>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-foreground">{displayName}</h3>
            {displayFonction && <p className="text-sm font-semibold text-primary">{displayFonction}</p>}
            {advisor.description && <p className="mt-2 text-sm text-muted-foreground italic max-w-md">{advisor.description}</p>}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button className="gap-2" onClick={openAssistant}><MessageCircle className="w-4 h-4" /> Contacter</Button>
          </div>
        </div>

        <div className="space-y-4">
          {displayFonction && <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Fonction" value={displayFonction} />}
          <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={advisor.email || 'Non renseigné'} />
          <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={advisor.telephone || 'Non renseigné'} />
        </div>
      </CardContent>
    </Card>
    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Profil conseiller</DialogTitle></DialogHeader>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-5">
            {advisor.avatar_url ? (
              <img src={advisor.avatar_url} alt={displayName} className="w-full sm:w-60 aspect-square rounded-2xl object-cover border border-border" />
            ) : (
              <div className="w-full sm:w-60 aspect-square rounded-2xl bg-primary/10 flex items-center justify-center text-4xl font-semibold text-primary border border-border">{initials}</div>
            )}
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <h3 className="text-2xl font-semibold text-foreground">{displayName}</h3>
                {displayFonction && <p className="text-muted-foreground">{displayFonction}</p>}
              </div>
              {advisor.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="w-4 h-4" />{advisor.email}</p>}
              {advisor.telephone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-4 h-4" />{advisor.telephone}</p>}
              <Button className="gap-2" onClick={openAssistant}><MessageCircle className="w-4 h-4" /> Ouvrir la messagerie</Button>
            </div>
          </div>
          {advisor.description && <section><h4 className="font-semibold text-foreground mb-2">À propos</h4><p className="text-sm text-muted-foreground italic">{advisor.description}</p></section>}
          {advisor.biographie && <section><h4 className="font-semibold text-foreground mb-2">Parcours & expérience</h4><p className="text-sm text-muted-foreground whitespace-pre-wrap">{advisor.biographie}</p></section>}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  </div>
);

export default ClientHelp;
