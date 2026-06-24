import { callCrmApi } from '@/lib/crmApi';
import { toast } from 'sonner';
import { track } from '@/lib/clientTracking';
import { downloadContractPdf } from '@/lib/contractPdf';

export interface DownloadContractResult {
  signed_url: string;
  pdfUrl?: string | null;
  mock?: boolean;
  filename?: string;
  content_type?: string;
}

type ContractPdfFallbackData = Parameters<typeof downloadContractPdf>[0];

/**
 * Calls the client contract endpoint and triggers a browser download.
 * - mock=true → opens HTML in a new tab (preview)
 * - otherwise → downloads the PDF blob
 */
export async function downloadContractFromServer(contractId: string): Promise<void> {
  const data = await callCrmApi<DownloadContractResult>('client-contracts', 'get-pdf', { contractId });
  const signedUrl = data?.signed_url || data?.pdfUrl || '';

  if (!signedUrl) {
    track('contract_download_error', { contract_id: contractId });
    throw new Error('Échec de la génération du contrat');
  }

  track('contract_download', {
    contract_id: contractId,
    mode: data.mock ? 'mock_html' : 'pdf',
  });

  if (data.mock) {
    // Open HTML preview in a new tab for now
    window.open(signedUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Force a real download as a blob to bypass inline viewer
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error('Téléchargement impossible');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = data.filename || `contrat-${contractId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Wrapper handling toasts + tracking. Safe to call from a button onClick.
 * Uses a discreet "preparing" loader and a success/error toast.
 */
export async function downloadContractWithToast(
  contractId: string,
  fallbackData?: ContractPdfFallbackData,
): Promise<void> {
  const t = toast.loading('Préparation du document sécurisé…');
  try {
    if (fallbackData?.contractHtml?.trim()) {
      await downloadContractPdf(fallbackData);
      toast.success('Contrat signé généré', { id: t });
      return;
    }

    await downloadContractFromServer(contractId);
    toast.success('Contrat prêt', { id: t });
  } catch (err: any) {
    if (fallbackData?.contractHtml?.trim()) {
      await downloadContractPdf(fallbackData);
      toast.success('Contrat généré depuis le document signé', { id: t });
      return;
    }
    toast.error(err?.message || 'Impossible de générer le contrat', { id: t });
    throw err;
  }
}
