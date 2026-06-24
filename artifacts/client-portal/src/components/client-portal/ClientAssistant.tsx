import { useState, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Sparkles, X, Send, Bot, User as UserIcon, Loader2,
  TrendingUp, Calculator, Wallet, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { getStoredToken } from '@/lib/crmApi';
import { useClientPortfolio } from '@/hooks/useClientData';
import { track } from '@/lib/clientTracking';

type Msg = { role: 'user' | 'assistant'; content: string };

interface Props {
  primaryColor?: string;
  accentColor?: string;
  sidebarColor?: string;
  textColor?: string;
}

const ADVISOR_ESCALATION_PREFIX = '[ESCALADE_CONSEILLER]';

const fmtEUR = (v: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);

const ClientAssistant = ({
  primaryColor = '#1B3A5C',
  accentColor = '#2D5FA0',
  sidebarColor = '#111D2E',
  textColor = '#E8ECF1',
}: Props) => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  // Outlet context exposes the clientAccount injected by ClientLayout.
  const ctx = useOutletContext<{ clientAccount?: { lead_id?: string } } | undefined>();
  const leadId = ctx?.clientAccount?.lead_id;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      role: 'assistant',
      content: lang === 'en'
        ? "Hello 👋 I am your wealth management assistant. Ask me questions about your portfolio, your contracts, or simulate a scenario."
        : "Bonjour 👋 Je suis votre assistant patrimonial. Posez-moi vos questions sur votre portefeuille, vos contrats ou simulez un scénario.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAdvisorMessage, setPendingAdvisorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live portfolio context for dynamic suggestions (no-op until leadId available)
  const { data: portfolio } = useClientPortfolio(leadId);

  const dynamicSuggestions = useMemo(() => {
    const list: string[] = [];
    if (portfolio?.totalValue && portfolio.totalValue > 0) {
      list.push(lang === 'en' ? 'How much will I have in 12 months?' : 'Combien aurai-je dans 12 mois ?');
    }
    if (portfolio?.activeSubs?.length) {
      list.push(lang === 'en'
        ? `Explain my ${portfolio.activeSubs.length} contract${portfolio.activeSubs.length > 1 ? 's' : ''}`
        : `Explique-moi mes ${portfolio.activeSubs.length} contrat${portfolio.activeSubs.length > 1 ? 's' : ''}`);
    }
    if (portfolio?.totalInterests && portfolio.totalInterests > 0) {
      list.push(lang === 'en' ? 'What is my current performance?' : 'Quelle est ma performance actuelle ?');
    }
    list.push(lang === 'en' ? "What happens if I invest €500 more per month?" : "Que se passe-t-il si j'investis 500 € de plus par mois ?");
    if (portfolio?.totalValue) {
      const half = Math.round(portfolio.totalValue / 2 / 100) * 100;
      if (half > 0) list.push(lang === 'en' ? `Can I withdraw ${fmtEUR(half)}?` : `Puis-je retirer ${fmtEUR(half)} ?`);
    }
    return list.slice(0, 4);
  }, [portfolio, lang]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      track('assistant_open');
      track('help_chat_open', { source: 'floating_assistant' });
    }
  }, [open]);

  useEffect(() => {
    const openHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      setOpen(true);
      if (detail?.prompt) setInput(detail.prompt);
    };
    window.addEventListener('client-assistant-open', openHandler as EventListener);
    return () => window.removeEventListener('client-assistant-open', openHandler as EventListener);
  }, []);

  const sendToAdvisor = async (content: string) => {
    try {
      const conversation = await import('@/lib/crmApi').then(({ callCrmApi }) =>
        callCrmApi('client-messaging', 'get-conversation')
      );
      if (!conversation?.conversationId) throw new Error('Conversation indisponible');
      await import('@/lib/crmApi').then(({ callCrmApi }) =>
        callCrmApi('client-messaging', 'send-message', {
          conversationId: conversation.conversationId,
          content,
        })
      );
      setPendingAdvisorMessage(null);
      setMessages((prev) => [...prev, { role: 'assistant', content: lang === 'en' ? 'Your message has been sent to your advisor.' : 'Votre message a bien été envoyé à votre conseiller.' }]);
      track('assistant_advisor_fallback_sent');
      track('help_message_sent', {
        conversationId: conversation.conversationId,
        source: 'floating_assistant_escalation',
        length: content.length,
      });
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: lang === 'en' ? 'Advisor transmission is temporarily unavailable. You can retry from My messaging.' : 'La transmission au conseiller est momentanément indisponible. Vous pouvez réessayer depuis Ma messagerie.' }]);
    }
  };

  const send = async (text: string, source: 'typed' | 'suggestion' = 'typed') => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    track('assistant_message', { source, length: trimmed.length });

    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const crmAccessToken = getStoredToken();
      const { data, error } = await supabase.functions.invoke('client-assistant', {
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          crmAccessToken,
          leadId,
        },
      });
      if (error) throw error;
      const rawReply = data?.reply || data?.error || (lang === 'en' ? "Sorry, I couldn't respond." : "Désolé, je n'ai pas pu répondre.");
      const shouldEscalate = rawReply.startsWith(ADVISOR_ESCALATION_PREFIX);
      const reply = rawReply.replace(ADVISOR_ESCALATION_PREFIX, '').trim();
      setMessages((prev) => [...prev, { role: 'assistant', content: reply || (lang === 'en' ? 'Would you like to send this message to your advisor?' : 'Souhaitez-vous envoyer ce message à votre conseiller ?') }]);
      setPendingAdvisorMessage(shouldEscalate ? trimmed : null);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: lang === 'en' ? "The service is temporarily unavailable. Please try again in a moment." : "Le service est momentanément indisponible. Réessayez dans un instant.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_ACTIONS = [
    {
      icon: TrendingUp,
      label: lang === 'en' ? 'Invest' : 'Investir',
      onClick: () => {
        track('click_invest', { source: 'assistant' });
        track('cta_invest_click', { source: 'assistant' });
        navigate('/client/products');
        setOpen(false);
      },
    },
    {
      icon: Calculator,
      label: lang === 'en' ? 'Simulate' : 'Simuler',
      onClick: () => {
        track('click_simulate', { source: 'assistant' });
        track('cta_simulate_click', { source: 'assistant' });
        navigate('/client/simulator');
        setOpen(false);
      },
    },
    {
      icon: FileText,
      label: lang === 'en' ? 'Contracts' : 'Contrats',
      onClick: () => {
        track('contract_view', { source: 'assistant' });
        navigate('/client/contracts');
        setOpen(false);
      },
    },
    {
      icon: Wallet,
      label: lang === 'en' ? 'Withdrawal' : 'Retrait',
      onClick: () => {
        track('click_withdraw', { source: 'assistant' });
        navigate('/client/withdrawal');
        setOpen(false);
      },
    },
  ];

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[60] group"
          aria-label={lang === 'en' ? 'Open assistant' : "Ouvrir l'assistant"}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
              boxShadow: `0 8px 28px ${accentColor}55, 0 0 0 4px ${accentColor}20`,
            }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span
            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full animate-pulse"
            style={{ backgroundColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.25)' }}
          />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-[60] w-[calc(100vw-3rem)] sm:w-[420px] h-[640px] max-h-[calc(100vh-6rem)] rounded-2xl shadow-2xl flex flex-col overflow-hidden border"
          style={{
            backgroundColor: '#ffffff',
            borderColor: `${primaryColor}20`,
            boxShadow: `0 20px 60px ${primaryColor}40`,
          }}
        >
          {/* Header */}
          <div
            className="p-4 flex items-center justify-between"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${sidebarColor})` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})` }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">{lang === 'en' ? 'Wealth assistant' : 'Assistant patrimonial'}</h3>
                <p className="text-[11px] text-white/70 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {lang === 'en' ? 'Online — advisory only' : 'En ligne — conseil uniquement'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
              aria-label={lang === 'en' ? 'Close' : 'Fermer'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick actions */}
          <div
            className="px-3 py-2 border-b bg-slate-50/70 grid grid-cols-4 gap-1.5"
            style={{ borderColor: `${primaryColor}10` }}
          >
            {QUICK_ACTIONS.map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition text-slate-700"
              >
                <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: m.role === 'user' ? `${primaryColor}15` : `${accentColor}15`,
                    color: m.role === 'user' ? primaryColor : accentColor,
                  }}
                >
                  {m.role === 'user' ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'rounded-tr-sm text-white'
                      : 'rounded-tl-sm bg-white border border-slate-200 text-slate-800'
                  }`}
                  style={
                    m.role === 'user'
                      ? { background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }
                      : undefined
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                >
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
                </div>
              </div>
            )}

            {messages.length <= 1 && !loading && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500 px-1">{lang === 'en' ? 'Personalised suggestions' : 'Suggestions personnalisées'}</p>
                {dynamicSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      track('assistant_suggestion_click', { suggestion: s });
                      send(s, 'suggestion');
                    }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition text-slate-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {pendingAdvisorMessage && !loading && (
              <div className="ml-9 rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
                <p className="text-xs text-slate-600">{lang === 'en' ? 'Would you like to send this message to your advisor?' : 'Souhaitez-vous envoyer ce message à votre conseiller ?'}</p>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 text-xs" onClick={() => sendToAdvisor(pendingAdvisorMessage)}>
                    {lang === 'en' ? 'Send' : 'Envoyer'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPendingAdvisorMessage(null)}>
                    {lang === 'en' ? 'Cancel' : 'Annuler'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-3 border-t bg-white flex gap-2"
            style={{ borderColor: `${primaryColor}15` }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === 'en' ? 'Ask your question…' : 'Posez votre question…'}
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                color: '#fff',
              }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="px-3 pb-2 text-[10px] text-center text-slate-400 bg-white">
            {lang === 'en' ? 'ⓘ Responses are indicative and do not constitute investment advice.' : 'ⓘ Les réponses sont indicatives et ne constituent pas un conseil en investissement.'}
          </p>
        </div>
      )}
    </>
  );
};

export default ClientAssistant;
