import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, RefreshCw, Clock, ExternalLink } from 'lucide-react';

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  image: string | null;
  category: string;
  source: string;
}


const CATEGORY_COLORS: Record<string, string> = {
  Bourse:   'bg-green-500/10 text-green-700 border-green-500/20',
  Épargne:  'bg-blue-500/10 text-blue-700 border-blue-500/20',
  Finance:  'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  Crypto:   'bg-purple-500/10 text-purple-700 border-purple-500/20',
  Forex:    'bg-amber-500/10 text-amber-700 border-amber-500/20',
};

const ALL_CATEGORIES = ['Tous', 'Bourse', 'Épargne', 'Finance', 'Crypto'];

const timeAgo = (dateStr: string) => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
};

const ArticleImage = ({ src, title }: { src: string; title: string }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => { setHasError(false); }, [src]);
  if (hasError || !src) return null;
  return (
    <div className="hidden sm:block flex-shrink-0 w-24 h-20 rounded-lg overflow-hidden bg-muted">
      <img
        src={src}
        alt={title}
        loading="eager"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

async function fetchAllNews(): Promise<Article[]> {
  try {
    const res = await fetch('/api/news');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

const ClientNews = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('Tous');

  const fetchNews = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const all = await fetchAllNews();
      setArticles(all);
    } catch (e) {
      console.error('Failed to fetch news', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(() => fetchNews(), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'Tous' ? articles : articles.filter(a => a.category === filter);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-primary" /> Actu et Info
        </h1>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-primary" />
          Actu et Info
        </h1>
        <button
          onClick={() => fetchNews(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filter === cat
                ? 'bg-primary text-primary-foreground shadow'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} article{filtered.length > 1 ? 's' : ''} disponible{filtered.length > 1 ? 's' : ''}
        {filtered.length === 0 && articles.length === 0 && (
          <span className="ml-2 text-amber-600">— chargement des flux en cours…</span>
        )}
      </p>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="border">
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucun article disponible pour cette catégorie.
            </CardContent>
          </Card>
        ) : (
          filtered.map((article, i) => (
            <a
              key={article.link || `${article.category}-${i}`}
              href={article.link || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`block group ${!article.link ? 'pointer-events-none' : ''}`}
            >
              <Card className="border hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {article.image && (
                      <ArticleImage src={article.image} title={article.title} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {article.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {article.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[article.category] || ''}`}>
                          {article.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-medium">{article.source}</span>
                        {article.pubDate && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(article.pubDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))
        )}
      </div>
    </div>
  );
};

export default ClientNews;
