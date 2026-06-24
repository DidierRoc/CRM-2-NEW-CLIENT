import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CRM_ANON_KEY, CRM_AUTH_CHANGED_EVENT, CRM_URL, callCrmApi, clearAuthStorage, crmGetUser, getStoredToken, getStoredUser, markCrmClientAccountMissing } from '@/lib/crmApi';

interface ClientProfile {
  id: string | null;
  lead_id: string;
  user_id: string;
}

interface CrmContextType {
  user: any | null;
  profile: ClientProfile | null;
  loading: boolean;
  authReady: boolean;
  signOut: () => void;
  refreshAuth: (knownUser?: any) => Promise<void>;
}

const defaultValue: CrmContextType = {
  user: null,
  profile: null,
  loading: true,
  authReady: false,
  signOut: () => {},
  refreshAuth: async () => {},
};
const CrmContext = createContext<CrmContextType>(defaultValue);

async function resolveClientAccountFromRest(token: string, userId: string, leadId?: string | null): Promise<ClientProfile | null> {
  const filters = [`user_id.eq.${encodeURIComponent(userId)}`];
  if (leadId) filters.push(`lead_id.eq.${encodeURIComponent(leadId)}`);

  const response = await fetch(`${CRM_URL}/rest/v1/client_accounts?select=id,lead_id,user_id&or=(${filters.join(',')})&limit=1`, {
    headers: {
      apikey: CRM_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  const rows = await response.json();
  const account = Array.isArray(rows) ? rows[0] : null;
  if (!account?.lead_id) return null;

  return {
    id: account.id ?? null,
    lead_id: account.lead_id,
    user_id: account.user_id ?? userId,
  };
}

export const useCrm = () => {
  return useContext(CrmContext);
};

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const syncRequestRef = useRef(0);

  const refreshAuth = useCallback(async (knownUser?: any) => {
    const requestId = ++syncRequestRef.current;
    const token = getStoredToken();

    if (!token) {
      if (requestId !== syncRequestRef.current) return;
      setUser(null);
      setProfile(null);
      setLoading(false);
      setAuthReady(true);
      return;
    }

    const storedUser = knownUser ?? getStoredUser();
    setUser(storedUser);
    setProfile(null);
    setLoading(true);
    setAuthReady(false);

    // Skip the /auth/v1/user round-trip when the caller already has a fresh user object
    const u = knownUser ?? await crmGetUser();

    if (requestId !== syncRequestRef.current) return;
    if (!u) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      setAuthReady(true);
      return;
    }

    setUser(u);

    const metadataLeadId = u?.user_metadata?.lead_id;
    let nextProfile: ClientProfile | null = await resolveClientAccountFromRest(token, u.id, metadataLeadId);
    markCrmClientAccountMissing(!nextProfile);

    nextProfile = nextProfile || (metadataLeadId
      ? { id: null, lead_id: metadataLeadId, user_id: u.id }
      : null);

    // Only call the get-profile Edge Function as a last resort — it has a cold-start
    // penalty of 2-3s and is unnecessary when nextProfile is already resolved above.
    if (!nextProfile?.lead_id) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          markCrmClientAccountMissing(false);
          const data = await callCrmApi('client-self-service', 'get-profile');
          const leadId = data?.clientAccount?.lead_id || data?.lead?.id || u?.user_metadata?.lead_id;

          if (leadId) {
            nextProfile = {
              id: data?.clientAccount?.id ?? null,
              lead_id: leadId,
              user_id: data?.clientAccount?.user_id ?? u.id,
            };
            if (data?.clientAccount?.id) {
              markCrmClientAccountMissing(false);
            }
            break;
          }
        } catch {
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
    }

    if (!nextProfile) {
      const leadId = u?.user_metadata?.lead_id;
      if (leadId) {
        nextProfile = {
          id: null,
          lead_id: leadId,
          user_id: u.id,
        };
      }
    }

    // Clear stale "missing" flag as soon as we have a usable profile so
    // subsequent API calls (documents, contracts, ...) hit the real backend
    // instead of returning the cached empty fallback.
    if (nextProfile?.lead_id) {
      markCrmClientAccountMissing(false);
    }

    if (requestId !== syncRequestRef.current) return;
    setProfile(nextProfile);
    setLoading(false);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    void refreshAuth();

    const handleAuthChanged = () => {
      void refreshAuth();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('crm_')) {
        void refreshAuth();
      }
    };

    // Poll every 3 minutes so a deactivated account is kicked out promptly.
    // crmGetUser() checks banned_until; clearAuthStorage() fires CRM_AUTH_CHANGED_EVENT
    // which triggers another refreshAuth() → user set to null → redirect to login.
    const poll = setInterval(() => { void refreshAuth(); }, 3 * 60 * 1000);

    window.addEventListener(CRM_AUTH_CHANGED_EVENT, handleAuthChanged);
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(poll);
      window.removeEventListener(CRM_AUTH_CHANGED_EVENT, handleAuthChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshAuth]);

  const signOut = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    setProfile(null);
    setLoading(false);
    setAuthReady(true);
  }, []);

  return (
    <CrmContext.Provider value={{ user, profile, loading, authReady, signOut, refreshAuth }}>
      {children}
    </CrmContext.Provider>
  );
};
