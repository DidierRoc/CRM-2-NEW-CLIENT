import { createClient } from '@supabase/supabase-js';
import { CRM_URL, CRM_ANON_KEY, ensureFreshCrmToken, getStoredToken } from '@/lib/crmApi';

export { callCrmApi, getStoredToken } from '@/lib/crmApi';
export const CRM_FUNCTIONS_URL = `${CRM_URL}/functions/v1`;

// Create a Supabase client pointing to CRM1
// Always inject the current CRM auth token so RLS-protected REST queries
// behave like the authenticated client session instead of falling back to anon.
const crmFetch: typeof fetch = async (input, init) => {
  const token = await ensureFreshCrmToken();
  const headers = new Headers(init?.headers);

  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('Pragma', 'no-cache');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(input, { ...init, headers, cache: 'no-store' });

  if ((response.status === 401 || response.status === 403) && token) {
    const freshToken = await ensureFreshCrmToken(true);
    if (freshToken && freshToken !== token) {
      headers.set('Authorization', `Bearer ${freshToken}`);
      response = await fetch(input, { ...init, headers, cache: 'no-store' });
    }
  }

  return response;
};

export const supabase = createClient(CRM_URL, CRM_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: crmFetch },
});

export async function syncCrmRealtimeAuth(force = false) {
  const currentToken = getStoredToken();
  if (currentToken) {
    supabase.realtime.setAuth(currentToken);
  }
  const token = await ensureFreshCrmToken(force);
  if (token && token !== currentToken) {
    supabase.realtime.setAuth(token);
  }
  return token;
}
