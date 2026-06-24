/**
 * connectionLog — insère directement dans client_connection_logs (Supabase).
 *
 * Fire-and-forget : ne bloque jamais l'UI, erreurs avalées silencieusement.
 *
 * Usage :
 *   logConnection(clientAccount.id, 'page_view', 'Mes Placements');
 *   logConnection(clientAccount.id, 'login');
 */
import { supabase } from '@/integrations/supabase/client';

export type ConnectionAction =
  | 'login'
  | 'logout'
  | 'page_view'
  | 'password_change'
  | 'profile_update'
  | 'document_upload'
  | 'contract_signed'
  | 'subscription_created'
  | 'withdrawal_request';

/**
 * @param clientAccountId  id de la table client_accounts
 * @param action           code action (voir ConnectionAction)
 * @param details          texte libre optionnel (nom de page, fichier…)
 */
export const logConnection = (
  clientAccountId: string | null | undefined,
  action: ConnectionAction,
  details?: string,
): void => {
  if (!clientAccountId) return;

  const userAgent =
    typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

  supabase
    .from('client_connection_logs')
    .insert({
      client_account_id: clientAccountId,
      action,
      details: details ?? null,
      user_agent: userAgent ?? null,
    })
    .then(({ error }) => {
      if (error) {
        // Erreur silencieuse — ne pas perturber l'UX
        console.warn('[connectionLog] insert error:', error.message);
      }
    });
};
