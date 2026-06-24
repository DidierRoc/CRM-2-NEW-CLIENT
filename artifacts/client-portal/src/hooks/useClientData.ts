import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callCrmApi } from '@/lib/crmApi';
import { supabase } from '@/lib/crmSupabaseClient';
import { useEffect } from 'react';
import { buildContractRenderHtml, isLegacyContractHtml } from '@/lib/clientContractPreview';

export { isLegacyContractHtml } from '@/lib/clientContractPreview';

const enrichContractWithRenderableHtml = async (contract: any, productId?: string, amount?: number | string) => {
  if (!productId) return contract;

  try {
    const preview = await fetchProductContractPreview(productId, amount ?? contract?.amount ?? '0');
    return { ...contract, contract_html_snapshot: preview.contract_html, _render_source: 'fresh_product_template' };
  } catch {
    return contract;
  }
};

export type ClientContractPreviewResponse = {
  contract_html: string;
  template_id: string;
  product_id: string;
  template_version?: number;
};

export async function fetchProductContractPreview(productId: string, amount: number | string): Promise<ClientContractPreviewResponse> {
  const response = await callCrmApi<any>('client-contracts', 'preview', { productId, amount });
  const preview: ClientContractPreviewResponse = response?.contract_html
    ? response
    : response?.preview || response?.contract || response?.data;

  if (!preview?.contract_html?.trim() || preview.product_id !== productId || isLegacyContractHtml(preview.contract_html)) {
    throw new Error('Contrat indisponible');
  }

  return { ...preview, contract_html: buildContractRenderHtml(preview.contract_html) };
}

const STALE_TIME = 5 * 60 * 1000; // 5 minutes — avoid re-fetch on navigation
const CRITICAL_CLIENT_DATA_TIME = 60 * 1000;

const toTime = (value: unknown) => {
  const time = value ? new Date(value as string).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

export function sortClientContracts<T extends { signed_at?: unknown; created_at?: unknown }>(contracts: T[] | null | undefined): T[] {
  return [...(contracts || [])].sort((a: any, b: any) => {
    const signedDiff = toTime(b.signed_at) - toTime(a.signed_at);
    if (signedDiff !== 0) return signedDiff;
    return toTime(b.created_at) - toTime(a.created_at);
  });
}

export function getLatestClientContract<T extends { signed_at?: unknown; created_at?: unknown }>(contracts: T[] | null | undefined): T | null {
  return sortClientContracts(contracts)[0] || null;
}

function normalizeSubscriptionContracts<T extends { client_contracts?: any[] }>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    client_contracts: sortClientContracts(row.client_contracts),
  }));
}

export function normalizeClientSubscriptionRows(raw: any, leadId?: string) {
  const rows = Array.isArray(raw) ? raw : raw?.subscriptions || raw?.contracts || raw?.data || [];
  return rows.map((item: any) => {
    const subscription = item?.subscription || item;
    const product = item?.products || item?.product || subscription?.products || subscription?.product;
    const contracts = item?.client_contracts || item?.contracts || subscription?.client_contracts || [];
    const transactions = item?.client_transactions || item?.transactions || subscription?.client_transactions || [];
    const normalized = {
      ...subscription,
      lead_id: subscription?.lead_id || leadId,
      product_id: subscription?.product_id || product?.id,
      products: product,
      client_contracts: [],
      client_transactions: transactions,
    };
    return {
      ...normalized,
      client_contracts: sortClientContracts(contracts),
    };
  }).filter((row: any) => row?.product_id || row?.products?.id);
}

export async function fetchValidClientProducts(leadId: string) {
  const data = await callCrmApi('client-self-service', 'get-products');
  const rawProducts = Array.isArray(data) ? data : data?.products || [];

  const normalizedProducts = rawProducts.map((item: any) => {
    if (item?.products) return item;
    const product = item?.product || item;
    return {
      id: item?.lead_product_id || item?.assignment_id || `client-product-${product?.id}`,
      lead_id: leadId,
      product_id: product?.id,
      created_at: item?.assigned_at || item?.created_at || product?.created_at,
      products: product,
    };
  }).filter((item: any) => item?.products?.id);

  // Enrich with the real CRM 1 category (category_id → product_categories.slug)
  // The Edge Function only returns the legacy `categorie` enum; the new category system
  // uses a separate product_categories table linked via category_id.
  const productIds = normalizedProducts.map((item: any) => item.products?.id).filter(Boolean);
  if (productIds.length > 0) {
    try {
      const { data: productRows } = await supabase
        .from('products' as any)
        .select('id, category_id, product_categories(slug, libelle, icone, couleur, ordre)')
        .in('id', productIds);

      if (productRows && (productRows as any[]).length > 0) {
        const catMap = new Map((productRows as any[]).map((r: any) => [r.id, r.product_categories]));
        return normalizedProducts.map((item: any) => ({
          ...item,
          products: {
            ...item.products,
            _category: catMap.get(item.products?.id) ?? null,
          },
        }));
      }
    } catch {
      // If the enrichment query fails, fall back to the legacy categorie field silently
    }
  }

  return normalizedProducts;
}

export async function fetchValidClientProduct(leadId: string, productId: string) {
  const products = await fetchValidClientProducts(leadId);
  return products.find((item: any) => item?.product_id === productId || item?.products?.id === productId) || null;
}

export async function fetchValidClientContracts(leadId: string) {
  const data = await callCrmApi('client-contracts', 'list');
  const rows = normalizeClientSubscriptionRows(data, leadId);
  // No per-contract HTML enrichment here — that is done lazily when the user
  // actually opens a contract preview, avoiding N extra API calls on every list load.
  return rows;
}

export async function fetchValidClientSubscription(leadId: string, productId: string) {
  const rows = await fetchValidClientContracts(leadId);
  return rows.find((row: any) => row?.product_id === productId || row?.products?.id === productId) || null;
}

/**
 * Enrich subscription products in the bundle with the real category slug from
 * product_categories (same pattern as fetchAllAvailableProducts).
 * The CRM bundle only carries the legacy `categorie` enum which can be wrong.
 */
async function enrichBundleCategories(bundle: any): Promise<any> {
  const subs: any[] = bundle?.subscriptions || [];
  const productIds = [...new Set(
    subs.map((s: any) => s?.products?.id).filter(Boolean) as string[]
  )];
  if (productIds.length === 0) return bundle;

  try {
    const { data: productRows } = await supabase
      .from('products' as any)
      .select('id, nom, category_id, product_categories(slug, libelle, icone, couleur, ordre)')
      .in('id', productIds);

    if (!productRows || (productRows as any[]).length === 0) return bundle;

    const productMap = new Map((productRows as any[]).map((r: any) => [r.id, r]));
    return {
      ...bundle,
      subscriptions: subs.map((s: any) => {
        if (!s.products) return s;
        const row = productMap.get(s.products.id);
        return {
          ...s,
          products: {
            ...s.products,
            nom: row?.nom || s.products.nom,
            _category: row?.product_categories ?? null,
          },
        };
      }),
    };
  } catch {
    return bundle;
  }
}

/** Single bundle call — profile + portfolio + positions in one round-trip */
export function useClientDashboardBundle(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-dashboard-bundle', leadId],
    queryFn: async () => {
      const bundle = await callCrmApi('client-self-service', 'get-dashboard-bundle');
      return enrichBundleCategories(bundle);
    },
    enabled: !!leadId,
    staleTime: CRITICAL_CLIENT_DATA_TIME,
    refetchOnWindowFocus: false,
  });
}

/**
 * Prefetch ALL client data in the background so every page is instant.
 * Call this once from ClientLayout when clientAccount is ready.
 */
export function usePrefetchClientData(leadId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leadId) return;

    const prefetchIfMissing = (key: any[], fn: () => Promise<any>, stale = STALE_TIME) => {
      const existing = queryClient.getQueryData(key);
      if (!existing) {
        queryClient.prefetchQuery({ queryKey: key, queryFn: fn, staleTime: stale });
      }
    };

    // Core bundle (dashboard, also seeds profile/portfolio/products)
    prefetchIfMissing(
      ['client-dashboard-bundle', leadId],
      async () => {
        const bundle = await callCrmApi('client-self-service', 'get-dashboard-bundle');
        return enrichBundleCategories(bundle);
      },
      CRITICAL_CLIENT_DATA_TIME,
    );

    // Profile
    prefetchIfMissing(['client-profile', leadId], () =>
      callCrmApi('client-self-service', 'get-profile')
    );

    // Products
    prefetchIfMissing(['client-products', leadId], () => fetchValidClientProducts(leadId), CRITICAL_CLIENT_DATA_TIME);

    // Portfolio (used by withdrawal page)
    prefetchIfMissing(['client-portfolio', leadId], () =>
      callCrmApi('client-self-service', 'get-portfolio')
    );

    // Documents
    prefetchIfMissing(['client-documents', leadId], async () => {
      const data = await callCrmApi('client-documents', 'list');
      return data?.documents || data || [];
    });

    // History
    prefetchIfMissing(['client-history', leadId], async () => {
      const data = await callCrmApi('client-self-service', 'get-history');
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.history)) return data.history;
      if (Array.isArray(data?.transactions)) return data.transactions;
      return [];
    });

    // Withdrawals
    prefetchIfMissing(['client-withdrawals', leadId], async () => {
      const data = await callCrmApi('client-self-service', 'get-withdrawals');
      const raw = data?.requests || data || [];
      return Array.isArray(raw) ? raw : [];
    });

    // Trading portfolio
    prefetchIfMissing(['client-trading', leadId], async () => {
      const data = await callCrmApi('client-trading', 'get-portfolio');
      return data?.portfolio || data || null;
    }, 60 * 1000);

    prefetchIfMissing(['client-contracts', leadId], () => fetchValidClientContracts(leadId), CRITICAL_CLIENT_DATA_TIME);

    // All available products (Placements page) — independent of leadId
    prefetchIfMissing(['all-available-products'], fetchAllAvailableProducts, STALE_TIME);
  }, [leadId, queryClient]);
}

export function useClientProfile(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-profile', leadId],
    queryFn: () => callCrmApi('client-self-service', 'get-profile'),
    enabled: !!leadId,
    staleTime: STALE_TIME,
  });
}

export function useClientPortfolio(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-portfolio', leadId],
    queryFn: () => callCrmApi('client-self-service', 'get-portfolio'),
    enabled: !!leadId,
    staleTime: STALE_TIME,
  });
}

export function useClientProducts(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-products', leadId],
    queryFn: () => fetchValidClientProducts(leadId!),
    enabled: !!leadId,
    staleTime: 2 * 60 * 1000, // 2 min — navigating back shows cached data instantly
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/** Shared fetcher — used by useAllAvailableProducts and the prefetch hook */
export async function fetchAllAvailableProducts(): Promise<any[]> {
  // Step 1 — fetch available products via Edge Function
  const raw = await callCrmApi('client-self-service', 'get-products');
  const items = Array.isArray(raw) ? raw : raw?.products || [];
  const products: any[] = items
    .map((item: any) => item?.product || item?.products || item)
    .filter((p: any) => p?.id);

  if (products.length === 0) return [];

  // Step 2 — enrich with real category from product_categories table.
  const ids = products.map((p: any) => p.id);
  try {
    const { data: productRows } = await supabase
      .from('products' as any)
      .select('id, category_id, product_categories(slug, libelle, icone, couleur, ordre)')
      .in('id', ids);

    if (productRows && (productRows as any[]).length > 0) {
      const catMap = new Map((productRows as any[]).map((r: any) => [r.id, r.product_categories]));
      return products.map((p: any) => ({
        ...p,
        _category: catMap.get(p.id) ?? null,
      }));
    }
  } catch {
    // Enrichment failed — fall back to legacy categorie enum handled by resolveCategory
  }

  return products;
}

/** All products available on the platform (not just subscribed ones). */
export function useAllAvailableProducts() {
  return useQuery({
    queryKey: ['all-available-products'],
    queryFn: fetchAllAvailableProducts,
    staleTime: 2 * 60 * 1000, // 2 min — navigating back shows cached data instantly
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useClientContracts(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-contracts', leadId],
    queryFn: () => fetchValidClientContracts(leadId!),
    enabled: !!leadId,
    staleTime: CRITICAL_CLIENT_DATA_TIME,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useClientDocuments(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-documents', leadId],
    queryFn: async () => {
      const data = await callCrmApi('client-documents', 'list');
      return data?.documents || data || [];
    },
    enabled: !!leadId,
    staleTime: 60 * 1000,  // 1 min — avoids refetch on every tab focus/mount
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}


export function useClientHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-history', leadId],
    queryFn: async () => {
      const data = await callCrmApi('client-self-service', 'get-history');
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.history)) return data.history;
      if (Array.isArray(data?.transactions)) return data.transactions;
      return [];
    },
    enabled: !!leadId,
    staleTime: STALE_TIME,
  });
}

export function useClientWithdrawals(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-withdrawals', leadId],
    queryFn: async () => {
      const data = await callCrmApi('client-self-service', 'get-withdrawals');
      const raw = data?.requests || data || [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!leadId,
    staleTime: STALE_TIME,
  });
}

export function useTradingPortfolio(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-trading', leadId],
    queryFn: async () => {
      const data = await callCrmApi('client-trading', 'get-portfolio');
      return data?.portfolio || data || null;
    },
    enabled: !!leadId,
    staleTime: 60 * 1000, // 1 min for trading data
  });
}
