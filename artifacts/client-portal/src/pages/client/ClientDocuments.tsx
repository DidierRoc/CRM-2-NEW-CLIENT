import { useRef, useState, useEffect } from 'react';
import { logConnection } from '@/lib/connectionLog';
import { useOutletContext } from 'react-router-dom';
import { callCrmApi } from '@/lib/crmApi';
import { supabase } from '@/lib/crmSupabaseClient';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Download, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useClientDocuments } from '@/hooks/useClientData';
import { useQueryClient } from '@tanstack/react-query';
import { ClientRowsSkeleton } from '@/components/client-portal/ClientPageFallback';
import { useLanguage } from '@/contexts/LanguageContext';

async function fetchDocBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from('lead-documents')
    .download(path);
  if (error || !data) {
    throw new Error(error?.message || 'Cannot load file');
  }
  return data;
}

const ClientDocuments = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const { lang } = useLanguage();
  const { data: documents = [], isLoading: loading } = useClientDocuments(clientAccount?.lead_id);
  const [uploading, setUploading] = useState(false);
  const [actionDocId, setActionDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    logConnection(clientAccount?.id, 'page_view', 'Mes Documents');
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !clientAccount?.lead_id) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const filePath = `${clientAccount.lead_id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('lead-documents')
          .upload(filePath, file);
        if (uploadError) { toast.error(uploadError.message); continue; }
        await callCrmApi('client-documents', 'upload', {
          nom: file.name,
          url: filePath,
          type: ext || 'autre',
        });
      }
      await callCrmApi('manage-client-accounts', 'log-activity', {
        clientAccountId: clientAccount.id,
        activityAction: 'document_upload',
        details: `Upload de ${files.length} document(s)`,
      });
      logConnection(clientAccount.id, 'document_upload', `Upload de ${files.length} document(s)`);
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
      toast.success(lang === 'en' ? 'Document(s) uploaded' : 'Document(s) uploadé(s)');
    } catch (err: any) {
      toast.error(err.message);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleView = async (doc: any) => {
    const win = window.open('', '_blank');
    setActionDocId(`view-${doc.id}`);
    try {
      const blob = await fetchDocBlob(doc.url);
      const objUrl = URL.createObjectURL(blob);
      if (win && !win.closed) {
        win.location.href = objUrl;
        setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
      } else {
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = doc.nom;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
        toast.info(lang === 'en' ? 'Popup blocked — file downloaded instead' : 'Popup bloqué — fichier téléchargé à la place');
      }
    } catch (err: any) {
      win?.close();
      toast.error(lang === 'en' ? 'Preview error' : 'Erreur lors de la prévisualisation');
    } finally {
      setActionDocId(null);
    }
  };

  const handleDownload = async (doc: any) => {
    setActionDocId(`dl-${doc.id}`);
    try {
      const blob = await fetchDocBlob(doc.url);
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = doc.nom;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch (err: any) {
      toast.error(lang === 'en' ? 'Download error' : 'Erreur lors du téléchargement');
    } finally {
      setActionDocId(null);
    }
  };

  if (loading) return <ClientRowsSkeleton rows={3} />;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{lang === 'en' ? 'My documents' : 'Mes documents'}</h1>
            <p className="text-sm text-slate-500">{lang === 'en' ? 'Upload and manage your supporting documents' : 'Uploadez et gérez vos pièces justificatives'}</p>
          </div>
        </div>
        <div>
          <input type="file" ref={fileInputRef} onChange={handleUpload} multiple className="hidden" />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl"
          >
            {uploading
              ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
              : <Upload className="w-4 h-4 mr-1" />}
            {lang === 'en' ? 'Add a document' : 'Ajouter un document'}
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{lang === 'en' ? 'No documents yet' : 'Aucun document pour le moment'}</p>
          <p className="text-sm text-slate-400 mt-1">{lang === 'en' ? 'Click "Add a document" to get started' : 'Cliquez sur "Ajouter un document" pour commencer'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {documents.map((doc: any) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 text-sm">{doc.nom}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(doc.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(doc)}
                    disabled={actionDocId !== null}
                    className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                    title={lang === 'en' ? 'Preview' : 'Prévisualiser'}
                  >
                    {actionDocId === `view-${doc.id}`
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    disabled={actionDocId !== null}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    title={lang === 'en' ? 'Download' : 'Télécharger'}
                  >
                    {actionDocId === `dl-${doc.id}`
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDocuments;
