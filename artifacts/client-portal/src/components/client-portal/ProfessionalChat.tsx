import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Minus, Search, Paperclip, FileText, Download, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/crmSupabaseClient';
import type { Message } from '@/types/messaging';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProfessionalChatProps {
  conversationId: string;
  myProfileId: string;
  otherName: string;
  otherAvatar?: string | null;
  isGroup?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  minimized?: boolean;
  variant?: 'window' | 'panel';
  loadMessages: (convId: string) => Promise<Message[]>;
  sendMessage: (convId: string, content: string, attachment?: { url: string; name: string }) => Promise<Message | null>;
  subscribeToMessages: (convId: string, cb: (msg: Message) => void, onDelete?: (id: string) => void) => () => void;
  /** Map of profile_id -> last_read_at for read receipts */
  memberLastRead?: Map<string, string>;
}

const formatDate = (dateStr: string, lang: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return lang === 'en' ? 'Today' : "Aujourd'hui";
  if (diffDays === 1) return lang === 'en' ? 'Yesterday' : 'Hier';
  const locale = lang === 'en' ? 'en-CA' : 'fr-FR';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: diffDays > 365 ? 'numeric' : undefined });
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const isImageFile = (name: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);

const mergeMessages = (current: Message[], incoming: Message[]) => {
  const byId = new Map<string, Message>();
  [...current, ...incoming].forEach(message => byId.set(message.id, message));
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

const ProfessionalChat: React.FC<ProfessionalChatProps> = ({
  conversationId,
  myProfileId,
  otherName,
  otherAvatar,
  isGroup,
  onClose,
  onMinimize,
  minimized,
  variant = 'window',
  loadMessages,
  sendMessage,
  subscribeToMessages,
  memberLastRead,
}) => {
  const { lang } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages
  useEffect(() => {
    if (minimized) return;
    setLoading(true);
    const cached = localStorage.getItem(`conv_${conversationId}`);
    if (cached) {
      try {
        const cachedMessages = JSON.parse(cached) as Message[];
        setMessages(Array.isArray(cachedMessages) ? cachedMessages : []);
      } catch {
        localStorage.removeItem(`conv_${conversationId}`);
      }
    }
    loadMessages(conversationId).then(msgs => {
      // Replace state with fresh DB data (source of truth)
      setMessages(msgs);
      localStorage.setItem(`conv_${conversationId}`, JSON.stringify(msgs));
      setLoading(false);
    }).catch(error => {
      console.error('[messaging] load error', error);
      setLoading(false);
    });
  }, [conversationId, minimized, loadMessages]);

  // Subscribe to new messages and deletions
  useEffect(() => {
    if (minimized) return;
    const unsub = subscribeToMessages(
      conversationId,
      (newMsg) => {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const updated = mergeMessages(prev, [newMsg]);
          localStorage.setItem(`conv_${conversationId}`, JSON.stringify(updated));
          return updated;
        });
      },
      (deletedId) => {
        setMessages(prev => {
          const updated = prev.filter(m => m.id !== deletedId);
          localStorage.setItem(`conv_${conversationId}`, JSON.stringify(updated));
          return updated;
        });
      }
    );
    return unsub;
  }, [conversationId, minimized, subscribeToMessages]);

  // Auto-scroll
  useEffect(() => {
    if (!minimized && !searchOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, minimized, searchOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input;
    setInput('');
    await sendMessage(conversationId, content);
    // L'affichage du message est géré uniquement par la subscription Realtime
    // pour éviter le doublon (optimiste vs DB)
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(path);
      const sent = await sendMessage(conversationId, '', { url: urlData.publicUrl, name: file.name });
      if (sent) {
        setMessages(prev => {
          if (prev.some(m => m.id === sent.id)) return prev;
          const updated = mergeMessages(prev, [sent]);
          localStorage.setItem(`conv_${conversationId}`, JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Read receipt check
  const isReadByOther = useCallback((msg: Message) => {
    if (msg.sender_id !== myProfileId || !memberLastRead) return false;
    for (const [pid, lastRead] of memberLastRead) {
      if (pid !== myProfileId && lastRead >= msg.created_at) return true;
    }
    return false;
  }, [myProfileId, memberLastRead]);

  // Filter messages for search
  const filteredMessages = searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  filteredMessages.forEach(msg => {
    const dateKey = new Date(msg.created_at).toDateString();
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateKey) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, msgs: [msg] });
    }
  });

  const isPanel = variant === 'panel';
  const containerHeight = isPanel ? 'h-full' : 'h-[440px]';
  const containerWidth = isPanel ? 'w-full' : 'w-[340px]';

  // Minimized state
  if (minimized) {
    return (
      <button
        onClick={onMinimize}
        className="flex items-center gap-2 bg-card border border-border rounded-t-lg px-3 py-2 shadow-lg hover:bg-accent/50 transition-colors min-w-[180px] max-w-[220px]"
      >
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-primary-foreground">{getInitials(otherName)}</span>
        </div>
        <span className="text-xs font-medium truncate flex-1 text-left">{otherName}</span>
        {onClose && (
          <button onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-3 h-3" />
          </button>
        )}
      </button>
    );
  }

  return (
    <div className={cn('flex flex-col bg-card border border-border shadow-2xl', containerWidth, containerHeight, !isPanel && 'rounded-t-xl')}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b bg-primary/5 rounded-t-xl shrink-0">
        {otherAvatar ? (
          <img src={otherAvatar} alt={otherName} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-primary-foreground">{getInitials(otherName)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{otherName}</p>
        </div>
        <button onClick={() => setSearchOpen(s => !s)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Search className="w-4 h-4" />
        </button>
        {onMinimize && (
          <button onClick={onMinimize} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <Minus className="w-4 h-4" />
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="px-3 py-2 border-b bg-muted/30 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'en' ? 'Search in conversation...' : 'Rechercher dans la conversation...'}
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-background rounded-lg border border-border outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : groupedMessages.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Send className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{lang === 'en' ? 'No messages' : 'Aucun message'}</p>
              <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Send the first message!' : 'Envoyez le premier message !'}</p>
            </div>
          ) : (
            groupedMessages.map(group => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground font-medium px-2">{formatDate(group.msgs[0].created_at, lang)}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {group.msgs.map((msg, idx) => {
                  const isMine = msg.sender_id === myProfileId;
                  const showAvatar = !isMine && (idx === 0 || group.msgs[idx - 1].sender_id !== msg.sender_id);
                  const showName = isGroup && !isMine && showAvatar;
                  const isLastInGroup = idx === group.msgs.length - 1 || group.msgs[idx + 1].sender_id !== msg.sender_id;

                  return (
                    <div key={msg.id} className={cn('flex gap-2 mb-0.5', isMine ? 'flex-row-reverse' : 'flex-row', isLastInGroup && 'mb-3')}>
                      {/* Avatar */}
                      {!isMine && (
                        <div className="w-7 shrink-0">
                          {showAvatar ? (
                            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                              <span className="text-[9px] font-bold text-foreground">{getInitials(msg.senderLogin || '')}</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                      <div className={cn('max-w-[75%] flex flex-col', isMine ? 'items-end' : 'items-start')}>
                        {showName && (
                          <span className="text-[10px] font-medium text-muted-foreground mb-0.5 px-1">{msg.senderLogin}</span>
                        )}
                        <div className={cn(
                          'rounded-2xl px-3.5 py-2 shadow-sm',
                          isMine
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md',
                        )}>
                          {/* Attachment */}
                          {msg.attachment_url && (
                            <div className="mb-1.5">
                              {isImageFile(msg.attachment_name || '') ? (
                                <img
                                  src={msg.attachment_url}
                                  alt={msg.attachment_name || 'image'}
                                  className="max-w-full max-h-40 rounded-lg object-cover cursor-pointer"
                                  onClick={() => window.open(msg.attachment_url!, '_blank')}
                                />
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    'flex items-center gap-2 p-2 rounded-lg transition-colors',
                                    isMine ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' : 'bg-background/60 hover:bg-background'
                                  )}
                                >
                                  <FileText className="w-4 h-4 shrink-0" />
                                  <span className="text-xs truncate flex-1">{msg.attachment_name}</span>
                                  <Download className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                </a>
                              )}
                            </div>
                          )}
                          {msg.content && !msg.content.startsWith('📎 ') && (
                            <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          )}
                          <div className={cn('flex items-center gap-1 mt-0.5', isMine ? 'justify-end' : 'justify-start')}>
                            <span className={cn('text-[9px]', isMine ? 'text-primary-foreground/50' : 'text-muted-foreground')}>
                              {new Date(msg.created_at).toLocaleTimeString(lang === 'en' ? 'en-CA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMine && (
                              isReadByOther(msg)
                                ? <CheckCheck className="w-3 h-3 text-blue-300" />
                                : <Check className="w-3 h-3 text-primary-foreground/40" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="px-3 py-2.5 border-t bg-background/50 shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={lang === 'en' ? 'Write a message...' : 'Écrire un message...'}
            className="flex-1 px-3 py-2 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() && !uploading}
            className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all disabled:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {uploading && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            {lang === 'en' ? 'Uploading file...' : 'Envoi du fichier...'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalChat;
