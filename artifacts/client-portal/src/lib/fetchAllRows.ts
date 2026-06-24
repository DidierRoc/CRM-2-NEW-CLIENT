import { supabase } from '@/integrations/supabase/client';

const DEFAULT_BATCH_SIZE = 1000;

export async function fetchAllRows<T>(
  createQuery: () => any,
  batchSize = DEFAULT_BATCH_SIZE,
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await createQuery().range(from, from + batchSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  return rows;
}

export async function fetchAllLeads<T>(
  selectClause: string,
  options?: { isNonAffectes?: boolean; batchSize?: number },
) {
  return fetchAllRows<T>(() => {
    let query = supabase.from('leads').select(selectClause).order('created_at', { ascending: false });

    if (options?.isNonAffectes) {
      query = query.is('assigne_a', null);
    }

    return query;
  }, options?.batchSize);
}