const CRM_URL = "https://yvcrtolqqkdfjnwdqrgp.supabase.co";
const CRM_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Y3J0b2xxcWtkZmpud2RxcmdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDM2NDAsImV4cCI6MjA5NTkxOTY0MH0.5EOy_QKSK6ldIem4Ps3FWkP7fDcxDrAPY9vS-t4m2kQ";
const CRM2_API_KEY = import.meta.env.VITE_CRM2_API_KEY;

export { CRM_URL, CRM_ANON_KEY };
export const CRM_AUTH_CHANGED_EVENT = "crm-auth-changed";

function dispatchCrmAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CRM_AUTH_CHANGED_EVENT));
  }
}

function storeUserSnapshot(user: any | null) {
  if (user) {
    localStorage.setItem("crm_user", JSON.stringify(user));
    return;
  }

  localStorage.removeItem("crm_user");
}

export class CrmApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CrmApiError";
    this.status = status;
  }
}

export function isCrmProfileMissingError(error: unknown): boolean {
  return error instanceof CrmApiError && error.status === 404 && /profil introuvable/i.test(error.message);
}

export function isCrmAdvisorMissingError(error: unknown): boolean {
  return error instanceof CrmApiError && error.status === 404 && /aucun conseiller assigné/i.test(error.message);
}

export function isCrmClientAccountMissingError(error: unknown): boolean {
  return error instanceof CrmApiError && error.status === 404 && /compte client introuvable/i.test(error.message);
}

export function markCrmClientAccountMissing(missing: boolean) {
  if (missing) localStorage.setItem("crm_client_account_missing", "true");
  else localStorage.removeItem("crm_client_account_missing");
}

function isCrmClientAccountMarkedMissing() {
  return localStorage.getItem("crm_client_account_missing") === "true";
}

function getClientAccountFallback(functionName: string, action: string): any | undefined {
  const storedUser = getStoredUser();
  const leadId = storedUser?.user_metadata?.lead_id ?? null;
  const userId = storedUser?.id ?? null;

  if (functionName === "client-self-service") {
    if (action === "get-profile") {
      return {
        clientAccount: leadId ? { id: null, lead_id: leadId, user_id: userId } : null,
        lead: leadId ? { id: leadId } : null,
        missingClientAccount: true,
      };
    }
    if (action === "get-dashboard-bundle") {
      return {
        lead: leadId ? { id: leadId } : null,
        subscriptions: [],
        transactions: [],
        tradingPortfolio: null,
        positions: [],
        missingClientAccount: true,
      };
    }
    if (action === "get-products") return { products: [], missingClientAccount: true };
    if (action === "get-portfolio") return { portfolio: null, missingClientAccount: true };
    if (action === "get-history") return { history: [], missingClientAccount: true };
    if (action === "get-withdrawals") return { requests: [], missingClientAccount: true };
    if (action === "get-advisor") return { advisor: null, missingClientAccount: true };
  }

  // Always hit the API for documents — fallback caused stale empty list to be served forever.
  if (functionName === "client-contracts" && action === "list")
    return { subscriptions: [], contracts: [], missingClientAccount: true };
  if (functionName === "client-messaging" && action === "get-unread")
    return { unreadCount: 0, count: 0, missingClientAccount: true };
  if (functionName === "client-trading" && action === "get-portfolio")
    return { portfolio: null, missingClientAccount: true };

  return undefined;
}

// ── Token helpers ──────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem("crm_access_token");
}

export function getStoredUser(): any | null {
  try {
    return JSON.parse(localStorage.getItem("crm_user") || "null");
  } catch {
    return null;
  }
}

export function clearAuthStorage() {
  localStorage.removeItem("crm_access_token");
  localStorage.removeItem("crm_refresh_token");
  localStorage.removeItem("crm_user");
  localStorage.removeItem("crm_expires_at");
  localStorage.removeItem("crm_client_account_missing");
  dispatchCrmAuthChange();
}

export function storeAuthData(data: { access_token: string; refresh_token: string; user: any; expires_at: number }) {
  localStorage.setItem("crm_access_token", data.access_token);
  localStorage.setItem("crm_refresh_token", data.refresh_token);
  storeUserSnapshot(data.user ?? getStoredUser());
  localStorage.setItem("crm_expires_at", String(data.expires_at));
  localStorage.removeItem("crm_client_account_missing");
  dispatchCrmAuthChange();
}

async function refreshCrmToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("crm_refresh_token");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${CRM_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CRM_ANON_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    storeAuthData(data);
    return true;
  } catch {
    return false;
  }
}

export async function ensureFreshCrmToken(force = false): Promise<string | null> {
  const token = getStoredToken();
  const expiresAt = Number(localStorage.getItem("crm_expires_at") || 0);
  const shouldRefresh = force || !token || (expiresAt > 0 && Date.now() >= (expiresAt - 60) * 1000);

  if (shouldRefresh) {
    await refreshCrmToken();
  }

  return getStoredToken();
}

// ── CRM API caller with auto-refresh ──────────────────────────

export async function callCrmApi<T = any>(
  functionName: string,
  action: string = "",
  params: Record<string, any> = {},
  token?: string | null,
): Promise<T> {
  const isPublicFunction = functionName === "public-branding" || functionName === "public-config";
  const authToken = token ?? (isPublicFunction ? getStoredToken() : await ensureFreshCrmToken());
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: CRM_ANON_KEY,
  };
  if (CRM2_API_KEY) headers["x-api-key"] = CRM2_API_KEY;
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const method = isPublicFunction ? "GET" : "POST";
  const body = method === "POST" ? JSON.stringify({ action, ...params }) : undefined;
  const url = `${CRM_URL}/functions/v1/${functionName}`;
  const fetchOptions: RequestInit = { method, headers, body, cache: "no-store" };

  if (!isPublicFunction && isCrmClientAccountMarkedMissing()) {
    const fallback = getClientAccountFallback(functionName, action);
    if (fallback !== undefined) return fallback as T;
  }

  let res = await fetch(url, fetchOptions);

  // Auto-refresh on 401 — try once, but DO NOT auto-sign-out on failure.
  // A single 401 from a background poll (e.g. messaging) must not kick the
  // user back to the login page. We just surface the error; the next call
  // will retry, and a real logout only happens via explicit signOut().
  if (res.status === 401 && !token) {
    const refreshed = await refreshCrmToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getStoredToken()}`;
      res = await fetch(url, fetchOptions);
    } else {
      throw new CrmApiError("Session expirée", 401);
    }
  }

  const raw = await res.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!res.ok) {
    const message = data?.error || "Erreur API";
    if (res.status === 404 && /compte client introuvable/i.test(message)) {
      const fallback = getClientAccountFallback(functionName, action);
      if (fallback !== undefined) {
        markCrmClientAccountMissing(true);
        return fallback as T;
      }
    }
    throw new CrmApiError(message, res.status);
  }
  return data as T;
}

// ── Auth helpers (CRM1 REST API) ──────────────────────────────

export class CrmSignInError extends Error {
  status: number;
  code?: string;
  requestId: string;
  step: "auth" | "roles" | "role_check" | "network";
  constructor(message: string, opts: { status?: number; code?: string; requestId?: string; step: CrmSignInError["step"] }) {
    super(message);
    this.name = "CrmSignInError";
    this.status = opts.status ?? 0;
    this.code = opts.code;
    this.requestId =
      opts.requestId ||
      `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    this.step = opts.step;
  }
}

export async function crmSignIn(email: string, password: string) {
  const localId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let res: Response;
  try {
    res = await fetch(`${CRM_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CRM_ANON_KEY, "x-request-id": localId },
      body: JSON.stringify({ email, password }),
    });
  } catch (networkErr: any) {
    throw new CrmSignInError(networkErr?.message || "Erreur réseau", {
      step: "network",
      requestId: localId,
    });
  }

  const reqId = res.headers.get("x-request-id") || res.headers.get("sb-request-id") || localId;
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new CrmSignInError(
      data?.error_description || data?.msg || data?.error || "Identifiants incorrects",
      { status: res.status, code: data?.error_code || data?.code, requestId: reqId, step: "auth" },
    );
  }

  // Verify client role
  let rolesRes: Response;
  try {
    rolesRes = await fetch(
      `${CRM_URL}/rest/v1/user_roles?select=role&user_id=eq.${data.user.id}`,
      { headers: { apikey: CRM_ANON_KEY, Authorization: `Bearer ${data.access_token}`, "x-request-id": localId } },
    );
  } catch (networkErr: any) {
    throw new CrmSignInError(networkErr?.message || "Erreur réseau lors de la vérification du rôle", {
      step: "network",
      requestId: localId,
    });
  }

  const rolesReqId = rolesRes.headers.get("x-request-id") || rolesRes.headers.get("sb-request-id") || localId;
  const roles = await rolesRes.json().catch(() => []);
  if (!rolesRes.ok) {
    throw new CrmSignInError("Impossible de vérifier le rôle du compte", {
      status: rolesRes.status,
      requestId: rolesReqId,
      step: "roles",
    });
  }

  const isClient = Array.isArray(roles) && roles.some((r: any) => r.role === "client");
  if (!isClient) {
    throw new CrmSignInError("Ce compte n'est pas un compte client", {
      status: 403,
      code: "not_client_role",
      requestId: rolesReqId,
      step: "role_check",
    });
  }

  storeAuthData(data);
  return data;
}

function isUserBanned(user: any): boolean {
  if (!user?.banned_until) return false;
  try {
    return new Date(user.banned_until).getTime() > Date.now();
  } catch {
    return false;
  }
}

export async function crmGetUser(): Promise<any | null> {
  const token = getStoredToken();
  if (!token) return null;

  const res = await fetch(`${CRM_URL}/auth/v1/user`, {
    headers: { apikey: CRM_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const user = await res.json();
    // If the CRM admin has deactivated this account, log out immediately
    if (isUserBanned(user)) {
      clearAuthStorage();
      return null;
    }
    storeUserSnapshot(user);
    return user;
  }

  // Try refresh
  const refreshed = await refreshCrmToken();
  if (!refreshed) {
    clearAuthStorage();
    return null;
  }

  const retry = await fetch(`${CRM_URL}/auth/v1/user`, {
    headers: { apikey: CRM_ANON_KEY, Authorization: `Bearer ${getStoredToken()}` },
  });
  if (retry.ok) {
    const user = await retry.json();
    if (isUserBanned(user)) {
      clearAuthStorage();
      return null;
    }
    storeUserSnapshot(user);
    return user;
  }

  clearAuthStorage();
  return null;
}

export function crmSignOut() {
  clearAuthStorage();
}
