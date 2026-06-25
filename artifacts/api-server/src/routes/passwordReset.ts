import { Router } from "express";

const router = Router();

const SUPABASE_URL = "https://exoisrhuacqeltaucwhu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b2lzcmh1YWNxZWx0YXVjd2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDUxNTAsImV4cCI6MjA5Nzg4MTE1MH0.8nWuwUXvdlMTcE61J9wG2fQYRGmHV329vO0iwZTcmRg";

router.post('/password-reset-notify', async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Invalid email' });
    return;
  }

  const sanitized = email.trim().toLowerCase();
  req.log.info({ email: sanitized }, 'Password reset requested by client');

  // Store the request in Supabase so advisors can see it
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/password_reset_requests`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ email: sanitized, requested_at: new Date().toISOString() }),
    });
  } catch {
    // Table may not exist yet — log only, don't fail the request
    req.log.warn({ email: sanitized }, 'Could not store reset request in DB (table may not exist)');
  }

  res.json({ ok: true });
});

export default router;
