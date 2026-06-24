import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClientNotifications, KIND_META, type ClientNotification } from '@/contexts/ClientNotificationsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  textColor: string;
  accentColor: string;
}

function timeAgo(ts: number, lang: 'fr' | 'en') {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (lang === 'en') {
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export default function NotificationBell({ textColor, accentColor }: Props) {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useClientNotifications();

  const handleClick = (n: ClientNotification) => {
    markRead(n.id);
    if (n.href) navigate(n.href);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: textColor }}
          aria-label={lang === 'en' ? 'Notifications' : 'Notifications'}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center text-white shadow-lg animate-pulse"
              style={{ backgroundColor: accentColor }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[360px] p-0 border-border/50 shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {lang === 'en' ? 'Notifications' : 'Notifications'}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0
                ? lang === 'en'
                  ? `${unreadCount} unread`
                  : `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                : lang === 'en'
                ? 'All caught up'
                : 'Tout est à jour'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={markAllRead}
                title={lang === 'en' ? 'Mark all as read' : 'Tout marquer comme lu'}
              >
                <CheckCheck className="w-4 h-4" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={clearAll}
                title={lang === 'en' ? 'Clear all' : 'Effacer tout'}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[420px]">
          {notifications.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <Bell className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {lang === 'en' ? 'No notifications' : 'Aucune notification'}
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                {lang === 'en'
                  ? "You'll be notified of important events here."
                  : 'Vous serez notifié des événements importants ici.'}
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {notifications.map((n) => {
                const Icon = KIND_META[n.kind].icon;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-muted/50 ${
                        !n.read ? 'bg-primary/[0.04]' : ''
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: !n.read ? `${accentColor}1a` : 'hsl(var(--muted))',
                          color: !n.read ? accentColor : 'hsl(var(--muted-foreground))',
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight ${!n.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span
                              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                              style={{ backgroundColor: accentColor }}
                            />
                          )}
                        </div>
                        {n.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.createdAt, lang)}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
