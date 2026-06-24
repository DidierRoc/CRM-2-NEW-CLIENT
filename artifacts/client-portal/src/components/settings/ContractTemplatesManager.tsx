import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  buildCompanyLogoMarkup,
  buildContractPlaceholderValues,
  replaceContractPlaceholders,
} from '@/lib/contractRendering';
import { parseContractTemplateBlocks, rebuildContractTemplateFromBlocks, type ContractTemplateBlock } from '@/lib/contractTemplateBlocks';
import { CompanyBranding } from '@/hooks/useCompanySignature';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { sanitizeContractHtml } from '@/lib/sanitizeHtml';
import {
  FileText,
  Image,
  Loader2,
  Save,
  CheckCircle,
  AlertTriangle,
  Palette,
  Building2,
  Pencil,
  Type,
  ChevronDown,
  ChevronRight,
  Upload,
  LayoutTemplate,
} from 'lucide-react';

interface ContractTemplatesManagerProps {
  branding: CompanyBranding;
}

const SAMPLE_DATA = {
  leadData: {
    civilite: 'M.', prenom: 'Jean', nom: 'Martin',
    email: 'jean.martin@example.com', telephone: '06 00 00 00 00',
    adresse: '12 avenue des Marchés', code_postal: '75008',
    ville: 'Paris', nationalite: 'Française',
  },
  product: {
    nom: 'Placement Signature', categorie: 'livret' as const,
    risque: 'Capital sous conditions', duree: '18 mois',
    interets: '7.20% annuel', prix_minimum: 10000,
    prix_maximum: 150000, periode_disponibilite: 'Toute l\'année',
  },
  amount: 25000,
  signedAt: '2026-04-15T12:00:00.000Z',
  reference: 'CTR-DEMO-2026',
  durationMonths: 18,
};

interface BlockConfig {
  showLogo: boolean;
  logoPosition: 'left' | 'center' | 'right';
  showCompanyInfo: boolean;
  showSignature: boolean;
  showStamp: boolean;
  headerColor: string;
  accentColor: string;
  borderRadius: string;
  fontSize: string;
  customLogoUrl: string | null;
}

type PendingSelection =
  | { type: 'template'; templateId: string }
  | { type: 'block'; blockIndex: number }
  | null;

const buildDefaultConfig = (branding: CompanyBranding): BlockConfig => ({
  showLogo: true,
  logoPosition: 'left',
  showCompanyInfo: true,
  showSignature: true,
  showStamp: true,
  headerColor: branding.primaryColor || '#1B3A5C',
  accentColor: branding.accentColor || '#2D5FA0',
  borderRadius: '18',
  fontSize: '12',
  customLogoUrl: null,
});

const parseStyleValue = (style: string, key: string) => {
  const match = style.match(new RegExp(`${key}\\s*:\\s*([^;]+)`));
  return match?.[1]?.trim() || '';
};

const extractConfigFromBlock = (html: string, branding: CompanyBranding): BlockConfig => {
  const defaults = buildDefaultConfig(branding);
  if (!html || typeof document === 'undefined') return defaults;

  const container = document.createElement('div');
  container.innerHTML = html.trim();
  const shell = container.firstElementChild as HTMLElement | null;

  if (!shell || shell.getAttribute('data-contract-brand-block') !== 'true') {
    return defaults;
  }

  const shellStyle = shell.getAttribute('style') || '';
  const accentBar = shell.querySelector('[data-brand-accent="true"]') as HTMLElement | null;
  const accentStyle = accentBar?.getAttribute('style') || '';
  const logo = shell.querySelector('[data-brand-logo="true"]') as HTMLElement | null;
  const company = shell.querySelector('[data-brand-company="true"]');
  const signature = shell.querySelector('[data-brand-signature="true"]') as HTMLImageElement | null;
  const stamp = shell.querySelector('[data-brand-stamp="true"]') as HTMLImageElement | null;
  const logoImage = logo?.querySelector('img') as HTMLImageElement | null;
  const gradient = accentStyle.match(/linear-gradient\(90deg,\s*([^,]+),\s*([^\)]+)\)/i);

  return {
    showLogo: !!logo,
    logoPosition: (parseStyleValue(logo?.getAttribute('style') || '', 'text-align') as BlockConfig['logoPosition']) || defaults.logoPosition,
    showCompanyInfo: !!company,
    showSignature: !!signature,
    showStamp: !!stamp,
    headerColor: gradient?.[1]?.trim() || defaults.headerColor,
    accentColor: gradient?.[2]?.trim() || defaults.accentColor,
    borderRadius: parseStyleValue(shellStyle, 'border-radius').replace('px', '') || defaults.borderRadius,
    fontSize: parseStyleValue(shellStyle, 'font-size').replace('px', '') || defaults.fontSize,
    customLogoUrl: logoImage?.getAttribute('src') || null,
  };
};

const ContractTemplatesManager = ({ branding }: ContractTemplatesManagerProps) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>('logo');
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection>(null);
  const [blockConfig, setBlockConfig] = useState<BlockConfig>(buildDefaultConfig(branding));
  const [initialConfig, setInitialConfig] = useState<string>(JSON.stringify(buildDefaultConfig(branding)));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contract_templates')
      .select('*')
      .order('created_at', { ascending: false });

    setTemplates(data || []);
    if (data && data.length > 0 && !selectedId) setSelectedId(data[0].id);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const selected = useMemo(() => templates.find((template) => template.id === selectedId) || null, [templates, selectedId]);
  const blocks = useMemo<ContractTemplateBlock[]>(() => parseContractTemplateBlocks(selected?.content || ''), [selected?.content]);
  const selectedBlock = blocks[selectedBlockIndex] || null;
  const isDirty = useMemo(() => JSON.stringify(blockConfig) !== initialConfig, [blockConfig, initialConfig]);
  const logoUrl = blockConfig.customLogoUrl || branding.contractLogoUrl || branding.logoUrl || null;

  useEffect(() => {
    setSelectedBlockIndex(0);
  }, [selectedId]);

  useEffect(() => {
    if (selectedBlockIndex >= blocks.length) setSelectedBlockIndex(0);
  }, [blocks.length, selectedBlockIndex]);

  useEffect(() => {
    const nextConfig = selectedBlock ? extractConfigFromBlock(selectedBlock.html, branding) : buildDefaultConfig(branding);
    setBlockConfig(nextConfig);
    setInitialConfig(JSON.stringify(nextConfig));
  }, [selectedBlock?.id, branding]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const customBranding = useMemo<CompanyBranding>(() => ({
    ...branding,
    primaryColor: blockConfig.headerColor,
    accentColor: blockConfig.accentColor,
    contractLogoUrl: blockConfig.showLogo ? logoUrl : null,
    logoUrl: blockConfig.showLogo ? logoUrl : null,
    companySignatureUrl: blockConfig.showSignature ? branding.companySignatureUrl : null,
    companyStampUrl: blockConfig.showStamp ? branding.companyStampUrl : null,
    companyName: blockConfig.showCompanyInfo ? branding.companyName : '',
    companyAddress: blockConfig.showCompanyInfo ? branding.companyAddress : '',
    companyPostalCode: blockConfig.showCompanyInfo ? branding.companyPostalCode : '',
    companyCity: blockConfig.showCompanyInfo ? branding.companyCity : '',
    companyPhone: blockConfig.showCompanyInfo ? branding.companyPhone : '',
    companyEmail: blockConfig.showCompanyInfo ? branding.companyEmail : '',
    companySiret: blockConfig.showCompanyInfo ? branding.companySiret : '',
    companyCountry: branding.companyCountry || 'France',
  }), [branding, blockConfig, logoUrl]);

  const stripBrandShell = useCallback((html: string) => {
    if (!html || typeof document === 'undefined') return html;
    const container = document.createElement('div');
    container.innerHTML = html.trim();
    const shell = container.firstElementChild as HTMLElement | null;

    if (shell?.getAttribute('data-contract-brand-block') === 'true') {
      const content = shell.querySelector('[data-brand-content="true"]') as HTMLElement | null;
      return content?.innerHTML || shell.innerHTML;
    }

    return html;
  }, []);

  const stripLegacyVisualFromBlock = useCallback((html: string) => {
    if (!html || typeof document === 'undefined') return html;

    const container = document.createElement('div');
    container.innerHTML = html.trim();
    const scope = container.children.length === 1 ? container.firstElementChild as HTMLElement | null : container;

    if (!scope) return html;

    const isVisualOnlyNode = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const text = (htmlElement.textContent || '').replace(/\s+/g, '').trim();
      const hints = `${htmlElement.className || ''} ${htmlElement.getAttribute('title') || ''} ${htmlElement.getAttribute('aria-label') || ''}`.toLowerCase();
      const hasMedia = !!htmlElement.querySelector('img, svg');
      const isEmojiOnly = !!text && text.length <= 4 && /^[\p{Extended_Pictographic}\uFE0F\u200D]+$/u.test(text);
      const isImageOnly = hasMedia && text === '';
      const looksLikeLogo = /logo|icon|badge|picto/.test(hints) && text.length <= 24;
      return isEmojiOnly || isImageOnly || looksLikeLogo;
    };

    scope.querySelectorAll('[data-brand-logo="true"]').forEach((node) => node.remove());
    Array.from(scope.children).slice(0, 3).forEach((child) => {
      if (isVisualOnlyNode(child)) child.remove();
    });

    return container.innerHTML;
  }, []);

  const buildConfigurableBlockHtml = useCallback((rawHtml: string) => {
    const cleanedInner = stripLegacyVisualFromBlock(stripBrandShell(rawHtml)).replace(/\{\{societe_logo\}\}/g, '');
    const logoJustify = blockConfig.logoPosition === 'left'
      ? 'flex-start'
      : blockConfig.logoPosition === 'right'
        ? 'flex-end'
        : 'center';

    const logoMarkup = blockConfig.showLogo && logoUrl
      ? `<div data-brand-logo="true" style="display:flex;justify-content:${logoJustify};align-items:center;margin:0 0 14px 0;">{{societe_logo}}</div>`
      : '';

    const companyMarkup = blockConfig.showCompanyInfo
      ? `<div data-brand-company="true" style="margin-bottom:14px;padding:10px 12px;border:1px solid ${blockConfig.headerColor};border-radius:${Math.max(Number(blockConfig.borderRadius) - 6, 8)}px;background:#ffffff;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${blockConfig.accentColor};margin-bottom:6px;">Société</div>
          <div style="font-size:15px;font-weight:700;color:${blockConfig.headerColor};margin-bottom:4px;">{{societe_nom}}</div>
          <div style="font-size:11px;line-height:1.5;color:#475569;">{{societe_adresse}} {{societe_code_postal}} {{societe_ville}}</div>
          <div style="font-size:11px;line-height:1.5;color:#475569;">{{societe_telephone}} • {{societe_email}}</div>
          <div style="font-size:11px;font-weight:600;color:${blockConfig.headerColor};margin-top:4px;">{{societe_siret}}</div>
        </div>`
      : '';

    const signatureImages = [
      blockConfig.showSignature && branding.companySignatureUrl
        ? `<img data-brand-signature="true" src="${branding.companySignatureUrl}" alt="Signature société" style="max-height:46px;max-width:110px;object-fit:contain;display:block;" />`
        : '',
      blockConfig.showStamp && branding.companyStampUrl
        ? `<img data-brand-stamp="true" src="${branding.companyStampUrl}" alt="Tampon société" style="max-height:52px;max-width:72px;object-fit:contain;display:block;" />`
        : '',
    ].filter(Boolean).join('');

    const signatureMarkup = signatureImages
      ? `<div style="margin-top:14px;padding-top:12px;border-top:1px dashed ${blockConfig.accentColor};display:flex;justify-content:flex-end;gap:10px;align-items:flex-end;">${signatureImages}</div>`
      : '';

    return `<section data-contract-brand-block="true" style="border:1px solid ${blockConfig.headerColor};border-radius:${blockConfig.borderRadius}px;overflow:hidden;background:#ffffff;font-size:${blockConfig.fontSize}px;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
      <div data-brand-accent="true" style="height:4px;background:linear-gradient(90deg, ${blockConfig.headerColor}, ${blockConfig.accentColor});"></div>
      <div data-brand-content="true" style="padding:16px;">${logoMarkup}${companyMarkup}${cleanedInner}${signatureMarkup}</div>
    </section>`;
  }, [blockConfig, branding.companySignatureUrl, branding.companyStampUrl, logoUrl, stripBrandShell, stripLegacyVisualFromBlock]);

  const previewHtml = useMemo(() => {
    if (!selectedBlock) return '';

    return replaceContractPlaceholders(
      buildConfigurableBlockHtml(selectedBlock.html),
      buildContractPlaceholderValues({ ...SAMPLE_DATA, companyBranding: customBranding }),
    ).split('__COMPANY_LOGO__').join(blockConfig.showLogo ? buildCompanyLogoMarkup(customBranding, 'inline') : '');
  }, [selectedBlock, buildConfigurableBlockHtml, customBranding, blockConfig.showLogo]);

  const requestSelection = (selection: PendingSelection) => {
    if (!selection) return;

    if (isDirty) {
      setPendingSelection(selection);
      setShowLeaveWarning(true);
      return;
    }

    if (selection.type === 'template') setSelectedId(selection.templateId);
    if (selection.type === 'block') setSelectedBlockIndex(selection.blockIndex);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const extension = file.name.split('.').pop() || 'png';
    const path = `contract-logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error } = await supabase.storage.from('product-assets').upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      toast.error('Upload du logo impossible');
      return;
    }

    const { data } = supabase.storage.from('product-assets').getPublicUrl(path);
    setBlockConfig((previous) => ({ ...previous, customLogoUrl: data.publicUrl, showLogo: true }));
    setUploading(false);
    toast.success('Logo ajouté');
  };

  const handleSave = async () => {
    if (!selected || !selectedBlock) return;

    const updatedBlocks = blocks.map((block, index) => (
      index === selectedBlockIndex
        ? { ...block, html: buildConfigurableBlockHtml(block.html) }
        : block
    ));

    const content = rebuildContractTemplateFromBlocks(selected.content || '', updatedBlocks);

    setSaving(true);
    const { error } = await supabase.functions.invoke('manage-contracts', {
      body: {
        action: 'save-template',
        templateId: selected.id,
        name: selected.nom,
        content,
        fileUrl: selected.file_url || null,
      },
    });
    setSaving(false);

    if (error) {
      toast.error('Erreur de sauvegarde');
      return;
    }

    setInitialConfig(JSON.stringify(blockConfig));
    toast.success('Bloc enregistré');
    loadTemplates();
  };

  const toggle = (id: string) => setOpenSection((previous) => previous === id ? null : id);

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!templates.length) return <div className="text-center py-8 text-muted-foreground text-xs"><FileText className="w-8 h-8 mx-auto mb-1 opacity-40" /><p>Aucun modèle</p></div>;

  return (
    <>
      <div className="flex gap-3" style={{ height: 'calc(100vh - 280px)', minHeight: '520px' }}>
        <Card className="w-[300px] shrink-0 flex flex-col overflow-hidden">
          <CardHeader className="py-3 px-3 border-b space-y-2">
            <div>
              <CardTitle className="text-xs flex items-center gap-1.5">
                <LayoutTemplate className="w-3.5 h-3.5" />
                Éditeur de blocs
              </CardTitle>
              <p className="text-[10px] text-muted-foreground mt-1">
                Choisis un document source puis modifie un bloc.
              </p>
            </div>

            <div className="rounded-md border bg-muted/20 p-2">
              <p className="text-[9px] font-medium text-muted-foreground mb-1">Document source</p>
              <div className="flex flex-wrap gap-1">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => requestSelection({ type: 'template', templateId: template.id })}
                    className={`px-2 py-1 rounded text-[10px] font-medium border transition-all truncate max-w-[132px] ${template.id === selectedId ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40'}`}
                    title={template.nom}
                  >
                    {template.nom.length > 18 ? `${template.nom.slice(0, 18)}…` : template.nom}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-hidden">
            <p className="text-[9px] font-medium text-muted-foreground mb-2">Blocs disponibles</p>
            <ScrollArea className="h-full pr-2">
              <div className="space-y-2">
                {blocks.map((block, index) => (
                  <button
                    key={block.id}
                    onClick={() => requestSelection({ type: 'block', blockIndex: index })}
                    className={`w-full rounded-lg border p-2 text-left transition-all ${index === selectedBlockIndex ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-semibold">Bloc {index + 1}</span>
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0">{block.label}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{block.excerpt || 'Bloc sans texte'}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="w-[280px] shrink-0 flex flex-col gap-2 overflow-y-auto pr-1">
          <div className="rounded-lg border p-2 bg-muted/20">
            <p className="text-[10px] font-semibold">Bloc sélectionné</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{selectedBlock ? `${selectedBlockIndex + 1}. ${selectedBlock.label}` : 'Aucun bloc'}</p>
            {selected && (
              <Badge variant="outline" className="text-[8px] mt-1 px-1.5 py-0">{selected.statut === 'actif' ? 'Validé' : 'Brouillon'}</Badge>
            )}
          </div>

          <Section icon={Image} title="Logo" open={openSection === 'logo'} onToggle={() => toggle('logo')} ok={!!logoUrl}>
            <div className="space-y-2">
              <Row label="Afficher">
                <Switch className="scale-90" checked={blockConfig.showLogo} onCheckedChange={(value) => setBlockConfig((previous) => ({ ...previous, showLogo: value }))} />
              </Row>
              {blockConfig.showLogo && (
                <>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((position) => (
                      <button
                        key={position}
                        onClick={() => setBlockConfig((previous) => ({ ...previous, logoPosition: position }))}
                        className={`flex-1 py-1 rounded text-[9px] font-medium border ${blockConfig.logoPosition === position ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                      >
                        {position === 'left' ? '←' : position === 'center' ? '↔' : '→'}
                      </button>
                    ))}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button variant="outline" size="sm" className="w-full h-7 text-[10px] gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <Upload className="w-3 h-3" /> {uploading ? 'Upload…' : 'Uploader un logo'}
                  </Button>
                </>
              )}
            </div>
          </Section>

          <Section icon={Palette} title="Couleurs" open={openSection === 'colors'} onToggle={() => toggle('colors')} ok>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="color" value={blockConfig.headerColor} onChange={(event) => setBlockConfig((previous) => ({ ...previous, headerColor: event.target.value }))} className="w-6 h-6 rounded border cursor-pointer p-0" />
                <Input value={blockConfig.headerColor} onChange={(event) => setBlockConfig((previous) => ({ ...previous, headerColor: event.target.value }))} className="h-6 text-[10px] font-mono flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={blockConfig.accentColor} onChange={(event) => setBlockConfig((previous) => ({ ...previous, accentColor: event.target.value }))} className="w-6 h-6 rounded border cursor-pointer p-0" />
                <Input value={blockConfig.accentColor} onChange={(event) => setBlockConfig((previous) => ({ ...previous, accentColor: event.target.value }))} className="h-6 text-[10px] font-mono flex-1" />
              </div>
              <div className="h-4 rounded" style={{ background: `linear-gradient(135deg, ${blockConfig.headerColor}, ${blockConfig.accentColor})` }} />
            </div>
          </Section>

          <Section icon={Building2} title="Infos société" open={openSection === 'company'} onToggle={() => toggle('company')} ok={!!branding.companyName}>
            <Row label="Afficher">
              <Switch className="scale-90" checked={blockConfig.showCompanyInfo} onCheckedChange={(value) => setBlockConfig((previous) => ({ ...previous, showCompanyInfo: value }))} />
            </Row>
          </Section>

          <Section icon={Pencil} title="Signature / tampon" open={openSection === 'sig'} onToggle={() => toggle('sig')} ok={!!(branding.companySignatureUrl || branding.companyStampUrl)}>
            <div className="space-y-1.5">
              <Row label="Signature">
                <Switch className="scale-90" checked={blockConfig.showSignature} onCheckedChange={(value) => setBlockConfig((previous) => ({ ...previous, showSignature: value }))} />
              </Row>
              <Row label="Tampon">
                <Switch className="scale-90" checked={blockConfig.showStamp} onCheckedChange={(value) => setBlockConfig((previous) => ({ ...previous, showStamp: value }))} />
              </Row>
            </div>
          </Section>

          <Section icon={Type} title="Typographie" open={openSection === 'typo'} onToggle={() => toggle('typo')} ok>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-[9px] text-muted-foreground">Police</Label>
                <Input type="number" min={8} max={18} value={blockConfig.fontSize} onChange={(event) => setBlockConfig((previous) => ({ ...previous, fontSize: event.target.value }))} className="h-6 text-[10px] mt-0.5" />
              </div>
              <div className="flex-1">
                <Label className="text-[9px] text-muted-foreground">Arrondi</Label>
                <Input type="number" min={0} max={30} value={blockConfig.borderRadius} onChange={(event) => setBlockConfig((previous) => ({ ...previous, borderRadius: event.target.value }))} className="h-6 text-[10px] mt-0.5" />
              </div>
            </div>
          </Section>

          <Button size="sm" onClick={handleSave} disabled={saving || !selectedBlock || !isDirty} className="w-full h-7 text-xs gap-1.5 mt-1">
            <Save className="w-3 h-3" /> {saving ? 'En cours…' : 'Enregistrer ce bloc'}
          </Button>

          {isDirty && <p className="text-[10px] text-amber-600 text-center">Modifications non enregistrées</p>}
        </div>

        <Card className="w-[260px] shrink-0 flex flex-col overflow-hidden">
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              Aperçu du bloc
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {selectedBlock ? (
                <div className="p-2 bg-background text-foreground">
                  <div
                    style={{ transform: 'scale(0.62)', transformOrigin: 'top left', width: '161%', fontSize: '10px' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(previewHtml) }}
                  />
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground text-xs">Sélectionnez un bloc</div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showLeaveWarning} onOpenChange={setShowLeaveWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
            <AlertDialogDescription>
              Si vous changez de bloc ou de contrat maintenant, vos modifications seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSelection(null)}>Rester</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingSelection?.type === 'template') setSelectedId(pendingSelection.templateId);
              if (pendingSelection?.type === 'block') setSelectedBlockIndex(pendingSelection.blockIndex);
              setPendingSelection(null);
              setShowLeaveWarning(false);
            }}>
              Quitter sans enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

function Section({ icon: Icon, title, open, onToggle, ok, children }: {
  icon: React.ElementType;
  title: string;
  open: boolean;
  onToggle: () => void;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/30 transition-colors">
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] font-medium flex-1">{title}</span>
        {ok ? <CheckCircle className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-amber-500" />}
      </button>
      {open && <div className="px-2 pb-2 pt-1 border-t">{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export default ContractTemplatesManager;
