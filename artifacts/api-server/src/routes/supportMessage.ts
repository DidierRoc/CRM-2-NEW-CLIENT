import { Router } from "express";

const router = Router();

const SUPABASE_URL = "https://exoisrhuacqeltaucwhu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b2lzcmh1YWNxZWx0YXVjd2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDUxNTAsImV4cCI6MjA5Nzg4MTE1MH0.8nWuwUXvdlMTcE61J9wG2fQYRGmHV329vO0iwZTcmRg";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || SUPABASE_ANON_KEY;
const CRM1_BASE = "https://362eaad2-fbb5-47b9-9c46-fc6dd01c3b60-00-1tkha9bcyw70p.spock.replit.dev";

router.post('/support-message', async (req, res) => {
  const { email, name, message } = req.body as { email?: string; name?: string; message?: string };

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Invalid email' });
    return;
  }
  if (!message || typeof message !== 'string' || message.trim().length < 2) {
    res.status(400).json({ error: 'Message required' });
    return;
  }

  const sanitizedEmail = email.trim().toLowerCase();
  const sanitizedName = (name ?? '').trim();
  const sanitizedMessage = message.trim();

  req.log.info({ email: sanitizedEmail }, '[Support Message] Received from login page');

  // 1. Notify CRM 1 via webhook (fire-and-forget)
  fetch(`${CRM1_BASE}/api/portal-events/message-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: sanitizedEmail,
      name: sanitizedName,
      message: sanitizedMessage,
      source: 'login_page',
    }),
  }).then(() => {
    req.log.info({ email: sanitizedEmail }, '[Support Message] CRM 1 webhook notified');
  }).catch((err) => {
    req.log.warn({ err }, '[Support Message] CRM 1 message-webhook call failed (may not exist yet)');
  });

  try {
    // 2. Find lead by email to get lead_id
    const leadRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(sanitizedEmail)}&select=id,nom,prenom&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (leadRes.ok) {
      const leads: any[] = await leadRes.json();
      const lead = leads[0];

      if (lead) {
        // 3. Insert client_event so it appears in CRM 1 timeline
        const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/client_events`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            lead_id: lead.id,
            event_name: 'login_support_message',
            page: '/login',
          }),
        });

        if (eventRes.ok) {
          req.log.info({ leadId: lead.id }, '[Support Message] client_event inserted');
        } else {
          const body = await eventRes.text();
          req.log.error({ status: eventRes.status, body }, '[Support Message] client_event insert failed');
        }
      } else {
        req.log.warn({ email: sanitizedEmail }, '[Support Message] No lead found — event not inserted');
      }
    }
  } catch (err) {
    req.log.error({ err }, '[Support Message] Unexpected error during Supabase insert');
  }

  res.json({ ok: true });
});

export default router;
