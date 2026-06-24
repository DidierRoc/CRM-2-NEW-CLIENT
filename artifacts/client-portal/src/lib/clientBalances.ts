/**
 * Centralized helpers to compute REAL client capital from confirmed transactions.
 *
 * Rule (non-negotiable, set by product owner):
 *   Net capital = sum(confirmed deposits) − sum(confirmed withdrawals)
 *
 * `client_subscriptions.amount` is the FACE VALUE of the contract (used for the
 * legal contract document and for the "amount to wire" prompt). It MUST NOT be
 * displayed as the client's real available capital. As long as no confirmed
 * deposit exists on a subscription, its real capital is 0.
 */

export type ClientTransaction = {
  id?: string;
  subscription_id?: string | null;
  type?: string | null;
  status?: string | null;
  amount?: number | string | null;
};

const sum = (txs: ClientTransaction[], type: string) =>
  txs
    .filter((t) => t?.type === type && t?.status === 'confirmed')
    .reduce((acc, t) => acc + Number(t?.amount || 0), 0);

const txsFor = (
  transactions: ClientTransaction[] | null | undefined,
  subscriptionId: string | null | undefined,
): ClientTransaction[] => {
  if (!Array.isArray(transactions) || !subscriptionId) return [];
  return transactions.filter((t) => t?.subscription_id === subscriptionId);
};

export const getConfirmedDeposits = (
  transactions: ClientTransaction[] | null | undefined,
  subscriptionId: string | null | undefined,
) => sum(txsFor(transactions, subscriptionId), 'deposit');

export const getConfirmedWithdrawals = (
  transactions: ClientTransaction[] | null | undefined,
  subscriptionId: string | null | undefined,
) => sum(txsFor(transactions, subscriptionId), 'withdrawal');

export const getConfirmedInterests = (
  transactions: ClientTransaction[] | null | undefined,
  subscriptionId: string | null | undefined,
) => sum(txsFor(transactions, subscriptionId), 'interest');

export const getConfirmedBonuses = (
  transactions: ClientTransaction[] | null | undefined,
  subscriptionId: string | null | undefined,
) => sum(txsFor(transactions, subscriptionId), 'bonus');

/**
 * REAL net capital for a subscription — deposits + bonuses minus withdrawals, confirmed only.
 * Never falls back to `sub.amount`. If no confirmed deposit/bonus exists, returns 0.
 * Floored at 0 to avoid negative display.
 */
export const getNetCapital = (
  transactions: ClientTransaction[] | null | undefined,
  subscriptionId: string | null | undefined,
): number => {
  const net = getConfirmedDeposits(transactions, subscriptionId)
    + getConfirmedBonuses(transactions, subscriptionId)
    - getConfirmedWithdrawals(transactions, subscriptionId);
  return Math.max(0, net);
};
