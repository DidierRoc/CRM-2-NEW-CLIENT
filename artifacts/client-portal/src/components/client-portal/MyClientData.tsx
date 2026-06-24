import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase as crmSupabase, syncCrmRealtimeAuth } from '@/lib/crmSupabaseClient';
import { supabase } from '@/integrations/supabase/client';
import { useCrm } from '@/contexts/CrmContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, FileText, MessageCircle, Mail, Phone, MapPin } from 'lucide-react';

/**
 * Reads the currently logged-in client from the EXISTING CRM session (useCrm)
 * — NO Supabase Auth, NO new login system, NO new routes.
 *
 * All Supabase queries are filtered with .eq('lead_id', leadId) so a client
 * only sees their own data. RLS additionally enforces this server-side.
 */
const MyClientData = () => {
  const { profile, authReady } = useCrm();
  const leadId = profile?.lead_id;

  const [lead, setLead] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady || !leadId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // 1) Profile (lead row acts as the client profile in this schema)
      const leadRes = await supabase
        .from('leads')
        .select('id, civilite, nom, prenom, email, telephone, adresse, code_postal, ville')
        .eq('id', leadId)
        .maybeSingle();

      // 2) Contracts for this lead only
      const contractsRes = await supabase
        .from('client_contracts')
        .select('id, reference, amount, interest_rate, duration_months, signed_at, contract_pdf_url')
        .eq('lead_id', leadId)
        .order('signed_at', { ascending: false });

      // 3) Messages: scoped via the client's profile_id -> conversations they belong to.
      //    (messages has no lead_id column; conversation membership IS the per-client filter,
      //     and is enforced by RLS.)
      const memberRes = await crmSupabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('profile_id', profile?.id ?? '');

      const conversationIds = (memberRes.data ?? []).map((m: any) => m.conversation_id);
      const messagesRes = conversationIds.length
        ? await crmSupabase
            .from('messages')
            .select('id, content, sender_id, conversation_id, created_at')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })
            .limit(20)
        : { data: [] as any[] };

      if (cancelled) return;
      setLead(leadRes.data);
      setContracts(contractsRes.data ?? []);
      setMessages(messagesRes.data ?? []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [authReady, leadId, profile?.id]);

  // Realtime: nouveaux messages live sur la home
  useEffect(() => {
    if (!authReady || !profile?.id) return;
    let channel: any;
    let cancelled = false;
    (async () => {
      await syncCrmRealtimeAuth();
      const { data: members } = await crmSupabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('profile_id', profile.id);
      if (cancelled) return;
      const convIds = (members ?? []).map((m: any) => m.conversation_id);
      if (!convIds.length) return;

      channel = crmSupabase
        .channel(`home-msgs-${profile.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
        }, (payload) => {
          const m: any = payload.new;
          if (!convIds.includes(m.conversation_id)) return;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [m, ...prev].slice(0, 20);
          });
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) crmSupabase.removeChannel(channel);
    };
  }, [authReady, profile?.id]);

  if (!authReady) return null;
  if (!leadId) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-primary" /> Mon profil
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {loading ? (
            <p className="text-muted-foreground">Chargement…</p>
          ) : lead ? (
            <>
              <p className="font-semibold text-foreground">
                {lead.civilite} {lead.prenom} {lead.nom}
              </p>
              {lead.email && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" /> {lead.email}
                </p>
              )}
              {lead.telephone && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {lead.telephone}
                </p>
              )}
              {(lead.adresse || lead.ville) && (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 mt-0.5" />
                  <span>
                    {lead.adresse}
                    {lead.adresse ? <br /> : null}
                    {lead.code_postal} {lead.ville}
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Aucune information</p>
          )}
        </CardContent>
      </Card>

      {/* Contracts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" /> Mes contrats
            <Badge variant="secondary" className="ml-auto">{contracts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {loading ? (
            <p className="text-muted-foreground">Chargement…</p>
          ) : contracts.length === 0 ? (
            <p className="text-muted-foreground">Aucun contrat</p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-auto">
              {contracts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{c.reference || 'Contrat'}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.signed_at ? new Date(c.signed_at).toLocaleDateString('fr-FR') : '—'}
                      {c.duration_months ? ` • ${c.duration_months} mois` : ''}
                      {c.interest_rate ? ` • ${c.interest_rate}%` : ''}
                    </p>
                  </div>
                  <p className="font-semibold text-foreground whitespace-nowrap">
                    {Number(c.amount || 0).toLocaleString('fr-FR')} €
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Messages */}
      <Link to="/client/help" className="block group">
        <Card className="transition-all hover:shadow-md hover:border-primary/40 cursor-pointer h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="w-4 h-4 text-primary" /> Mes messages
              <Badge variant="secondary" className="ml-auto">{messages.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {loading ? (
              <p className="text-muted-foreground">Chargement…</p>
            ) : messages.length === 0 ? (
              <p className="text-muted-foreground">Aucun message — cliquez pour ouvrir la messagerie</p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-auto">
                {messages.slice(0, 8).map((m) => (
                  <li key={m.id} className="py-1.5 border-b last:border-0">
                    <p className="text-foreground line-clamp-2">{m.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(m.created_at).toLocaleString('fr-FR')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
};

export default MyClientData;
