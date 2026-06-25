import { Router } from "express";

const router = Router();

const SUPABASE_URL = "https://exoisrhuacqeltaucwhu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b2lzcmh1YWNxZWx0YXVjd2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDUxNTAsImV4cCI6MjA5Nzg4MTE1MH0.8nWuwUXvdlMTcE61J9wG2fQYRGmHV329vO0iwZTcmRg";

// Use service role key (set as env var) to bypass RLS — falls back to anon
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || SUPABASE_ANON_KEY;

router.post('/password-reset-notify', async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Invalid email' });
    return;
  }

  const sanitized = email.trim().toLowerCase();
  req.log.info({ email: sanitized }, '[Password Reset] Client request received');

  try {
    // 1. Find the lead by email
    const leadRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(sanitized)}&select=id,nom,prenom,assigne_a&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!leadRes.ok) throw new Error(`Lead lookup failed: ${leadRes.status}`);
    const leads: any[] = await leadRes.json();
    const lead = leads[0];

    if (!lead) {
      req.log.warn({ email: sanitized }, '[Password Reset] No lead found for this email');
      // Still return success to the client (don't reveal if email exists)
      res.json({ ok: true });
      return;
    }

    req.log.info({ leadId: lead.id, name: `${lead.prenom} ${lead.nom}` }, '[Password Reset] Lead found');

    // 2. Insert a client_event so it appears in CRM 1
    const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/client_events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        lead_id: lead.id,
        event_name: 'password_reset_request',
        properties: {
          email: sanitized,
          client_name: `${lead.prenom} ${lead.nom}`,
          requested_at: new Date().toISOString(),
          source: 'client_portal',
        },
        page: '/login',
      }),
    });

    if (!eventRes.ok) {
      const errBody = await eventRes.text();
      req.log.error({ status: eventRes.status, body: errBody }, '[Password Reset] Could not insert client_event — service role key may be needed');
    } else {
      req.log.info({ leadId: lead.id }, '[Password Reset] client_event inserted successfully');
    }

  } catch (err) {
    req.log.error({ err }, '[Password Reset] Unexpected error');
  }

  res.json({ ok: true });
});

export default router;
