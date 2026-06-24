import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/crmSupabaseClient';
import { Plus, FileText, Pencil, Trash2, Eye, Loader2, CheckCircle, XCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ContractTemplateEditor from './ContractTemplateEditor';
import { renderContractHtml } from '@/lib/contractRendering';
import { useCompanySignature } from '@/hooks/useCompanySignature';
import { sanitizeContractHtml } from '@/lib/sanitizeHtml';

const ContractTemplatesList = () => {
  const { branding } = useCompanySignature();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickBaseOpen, setPickBaseOpen] = useState(false);
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = true;

  const renderTemplatePreview = useCallback((content: string) => {
    return renderContractHtml(content || '<p style="color:#64748b;text-align:center;padding:36px 12px;">Contenu vide</p>', {
      leadData: {
        civilite: 'M.',
        prenom: 'Jean',
        nom: 'Martin',
        email: 'jean.martin@example.com',
        telephone: '06 00 00 00 00',
        adresse: '12 avenue des Marchés',
        code_postal: '75008',
        ville: 'Paris',
        nationalite: 'Française',
      },
      product: {
        nom: 'Placement Signature',
        categorie: 'livret',
        risque: 'Capital sous conditions',
        duree: '18 mois',
        interets: '7.20% annuel',
        prix_minimum: 10000,
        prix_maximum: 150000,
        periode_disponibilite: 'Toute l’année',
      },
      amount: 25000,
      signedAt: '2026-04-15T12:00:00.000Z',
      reference: 'CTR-DEMO-2026',
      durationMonths: 18,
    }, undefined, branding);
  }, [branding]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contract_templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Open the "pick a base template" dialog
  const openCreateFlow = () => {
    setSelectedBaseId('');
    setPickBaseOpen(true);
  };

  // After picking a base template (or blank), open editor
  const confirmBaseFromId = (id: string) => {
    setPickBaseOpen(false);
    setEditingId(null);
    setUploadedFileUrl(null);
    if (id && id !== 'blank') {
      const base = templates.find(t => t.id === id);
      if (base) {
        setTemplateName(`${base.nom} (copie)`);
        setTemplateContent(base.content);
      } else {
        setTemplateName('');
        setTemplateContent('');
      }
    } else {
      setTemplateName('');
      setTemplateContent('');
    }
    setEditorOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isHtml = ['html', 'htm', 'txt'].includes(ext);

    if (isHtml) {
      // HTML/TXT: read content into editor
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPickBaseOpen(false);
        setEditingId(null);
        setUploadedFileUrl(null);
        setTemplateName(file.name.replace(/\.(html?|txt)$/i, ''));
        setTemplateContent(ev.target?.result as string);
        setEditorOpen(true);
      };
      reader.readAsText(file);
    } else {
      // PDF/DOCX: upload to storage
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('product-assets')
        .upload(`contract-templates/${fileName}`, file);

      if (error) {
        toast.error('Erreur lors de l\'upload : ' + error.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('product-assets')
        .getPublicUrl(`contract-templates/${fileName}`);

      setPickBaseOpen(false);
      setEditingId(null);
      setUploadedFileUrl(urlData.publicUrl);
      setTemplateName(file.name.replace(/\.(pdf|docx?)$/i, ''));
      setTemplateContent(`<p style="text-align:center;padding:40px 20px;"><a href="${urlData.publicUrl}" target="_blank" style="color:#3B82F6;font-weight:600;">📄 Voir le fichier uploadé : ${file.name}</a></p>`);
      setEditorOpen(true);
    }
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setTemplateName(t.nom);
    setTemplateContent(t.content);
    setUploadedFileUrl(t.file_url || null);
    setEditorOpen(true);
  };

  const openPreview = (t: any) => {
    setPreviewName(t.nom);
    setPreviewContent(renderTemplatePreview(t.content));
    setPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('Le nom du modèle est requis');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-contracts', {
        body: {
          action: 'save-template',
          templateId: editingId,
          name: templateName.trim(),
          content: templateContent,
          fileUrl: uploadedFileUrl,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (editingId) {
        toast.success('Modèle mis à jour');
      } else {
        toast.success('Modèle créé (brouillon)');
      }
      setEditorOpen(false);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce modèle de contrat ?')) return;
    const { data, error } = await supabase.functions.invoke('manage-contracts', {
      body: {
        action: 'delete-template',
        templateId: id,
      },
    });

    if (error || data?.error) {
      toast.error(error?.message || data?.error);
      return;
    }

    toast.success('Modèle supprimé');
    loadTemplates();
  };

  const handleToggleStatus = async (t: any) => {
    const { data, error } = await supabase.functions.invoke('manage-contracts', {
      body: {
        action: 'toggle-template-status',
        templateId: t.id,
      },
    });

    if (error || data?.error) {
      toast.error(error?.message || data?.error);
      return;
    }

    const newStatus = data?.status === 'actif' ? 'actif' : 'brouillon';
    toast.success(newStatus === 'actif' ? 'Contrat validé — sélectionnable par les produits' : 'Contrat repassé en brouillon');
    loadTemplates();
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {canManage && (
          <div className="flex justify-end">
            <Button onClick={openCreateFlow}>
              <Plus className="w-4 h-4 mr-2" />Créer un contrat
            </Button>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-card">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucun modèle de contrat</p>
            {canManage && (
              <Button variant="outline" className="mt-3" onClick={openCreateFlow}>
                <Plus className="w-4 h-4 mr-2" />Créer votre premier contrat
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.id} className="border rounded-lg bg-card p-4 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold text-foreground text-sm">{t.nom}</h3>
                  </div>
                  <Badge className={t.statut === 'actif' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}>
                    {t.statut === 'actif' ? 'Validé' : 'Brouillon'}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-3">
                  {stripHtml(t.content).substring(0, 150) || 'Contenu vide'}
                </p>

                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPreview(t)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${t.statut === 'actif' ? 'text-yellow-600' : 'text-green-600'}`}
                          onClick={() => handleToggleStatus(t)}
                          title={t.statut === 'actif' ? 'Repasser en brouillon' : 'Valider le contrat'}
                        >
                          {t.statut === 'actif' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pick base template dialog — WordPress style */}
      <Dialog open={pickBaseOpen} onOpenChange={setPickBaseOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choisir un modèle de base</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cliquez sur un modèle pour l'utiliser comme base, puis personnalisez-le.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
            {/* Blank template card */}
            <div
              onClick={() => { setSelectedBaseId('blank'); confirmBaseFromId('blank'); }}
              className="group cursor-pointer border-2 border-dashed rounded-lg hover:border-primary hover:shadow-lg transition-all overflow-hidden"
            >
              <div className="h-48 flex flex-col items-center justify-center bg-muted/30 group-hover:bg-primary/5 transition-colors">
                <Plus className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-sm font-medium text-muted-foreground group-hover:text-primary mt-2">Partir de zéro</p>
              </div>
              <div className="p-3 border-t">
                <p className="text-xs font-medium text-foreground">Document vierge</p>
                <p className="text-[10px] text-muted-foreground">Commencer avec un contrat vide</p>
              </div>
            </div>

            {/* Upload card */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer border-2 border-dashed rounded-lg hover:border-primary hover:shadow-lg transition-all overflow-hidden"
            >
              <div className="h-48 flex flex-col items-center justify-center bg-muted/30 group-hover:bg-primary/5 transition-colors">
                <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-sm font-medium text-muted-foreground group-hover:text-primary mt-2">Uploader un contrat</p>
              </div>
              <div className="p-3 border-t">
                <p className="text-xs font-medium text-foreground">Importer un fichier</p>
                <p className="text-[10px] text-muted-foreground">PDF, Word ou HTML</p>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,.txt,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Template cards — all templates as base */}
            {templates.map(t => (
              <div
                key={t.id}
                onClick={() => { setSelectedBaseId(t.id); confirmBaseFromId(t.id); }}
                className={`group cursor-pointer border-2 rounded-lg hover:border-primary hover:shadow-lg transition-all overflow-hidden ${selectedBaseId === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
              >
                {/* Mini preview of the HTML content */}
                <div className="h-48 overflow-hidden bg-white relative">
                  <div
                    className="absolute inset-0 p-3 text-[6px] leading-[8px] text-gray-700 pointer-events-none origin-top-left scale-[0.45]"
                    style={{ width: '222%', height: '222%' }}
                      dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(renderTemplatePreview(t.content)) }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/80" />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
                      Utiliser ce modèle
                    </span>
                  </div>
                </div>
                <div className="p-3 border-t bg-card">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground truncate">{t.nom}</p>
                    <Badge className={`text-[9px] px-1.5 py-0 ${t.statut === 'actif' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {t.statut === 'actif' ? 'Validé' : 'Brouillon'}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {stripHtml(t.content).substring(0, 60) || 'Contenu vide'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le modèle' : 'Créer un nouveau contrat'}</DialogTitle>
          </DialogHeader>
          {!editingId && (
            <p className="text-xs text-muted-foreground -mt-2">
              Le contrat sera créé en <Badge variant="outline" className="text-xs">Brouillon</Badge>. Validez-le ensuite pour le rendre sélectionnable par les produits.
            </p>
          )}
          <ContractTemplateEditor
            templateName={templateName}
            onNameChange={setTemplateName}
            content={templateContent}
            onContentChange={setTemplateContent}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : (editingId ? 'Mettre à jour' : 'Créer le contrat (brouillon)')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aperçu : {previewName}</DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-sm max-w-none p-4 border rounded-lg bg-background"
            dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(previewContent) }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContractTemplatesList;
