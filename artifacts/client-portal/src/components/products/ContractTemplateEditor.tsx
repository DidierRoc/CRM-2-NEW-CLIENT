import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Building2, Trash2 } from 'lucide-react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, ChevronDown, Tag, TableProperties, ArrowUp, ArrowDown, Layers, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { parseContractTemplateBlocks, rebuildContractTemplateFromBlocks } from '@/lib/contractTemplateBlocks';
import { sanitizeContractHtml } from '@/lib/sanitizeHtml';

const DYNAMIC_FIELDS = [
  {
    group: 'Client',
    fields: [
      { tag: '{{civilite}}', label: 'Civilité' },
      { tag: '{{prenom}}', label: 'Prénom' },
      { tag: '{{nom}}', label: 'Nom' },
      { tag: '{{email}}', label: 'Email' },
      { tag: '{{telephone}}', label: 'Téléphone' },
      { tag: '{{adresse}}', label: 'Adresse' },
      { tag: '{{code_postal}}', label: 'Code postal' },
      { tag: '{{ville}}', label: 'Ville' },
      { tag: '{{nationalite}}', label: 'Nationalité' },
    ],
  },
  {
    group: 'Banque',
    fields: [
      { tag: '{{banque_nom}}', label: 'Nom de la banque' },
      { tag: '{{banque_iban}}', label: 'IBAN' },
      { tag: '{{banque_bic}}', label: 'BIC' },
      { tag: '{{banque_titulaire}}', label: 'Titulaire du compte' },
    ],
  },
  {
    group: 'Bénéficiaire',
    fields: [
      { tag: '{{beneficiaire_nom}}', label: 'Nom du bénéficiaire' },
      { tag: '{{beneficiaire_prenom}}', label: 'Prénom du bénéficiaire' },
      { tag: '{{beneficiaire_part}}', label: 'Part (%)' },
      { tag: '{{beneficiaire_lien}}', label: 'Lien de parenté' },
    ],
  },
  {
    group: 'Personne morale',
    fields: [
      { tag: '{{pm_raison_sociale}}', label: 'Raison sociale' },
      { tag: '{{pm_siret}}', label: 'SIRET' },
      { tag: '{{pm_rcs}}', label: 'Numéro RCS' },
      { tag: '{{pm_forme_juridique}}', label: 'Forme juridique' },
      { tag: '{{pm_adresse}}', label: 'Adresse siège' },
      { tag: '{{pm_representant}}', label: 'Représentant' },
    ],
  },
  {
    group: 'Produit',
    fields: [
      { tag: '{{produit_nom}}', label: 'Nom du produit' },
      { tag: '{{produit_categorie}}', label: 'Catégorie' },
      { tag: '{{produit_duree}}', label: 'Durée' },
      { tag: '{{produit_risque}}', label: 'Risque' },
      { tag: '{{produit_interets}}', label: 'Taux d\'intérêts' },
      { tag: '{{prix_minimum}}', label: 'Prix minimum' },
      { tag: '{{prix_maximum}}', label: 'Prix maximum' },
      { tag: '{{montant}}', label: 'Montant souscrit' },
    ],
  },
  {
    group: 'Société',
    fields: [
      { tag: '{{societe_nom}}', label: 'Raison sociale' },
      { tag: '{{societe_adresse}}', label: 'Adresse' },
      { tag: '{{societe_code_postal}}', label: 'Code postal' },
      { tag: '{{societe_ville}}', label: 'Ville' },
      { tag: '{{societe_telephone}}', label: 'Téléphone' },
      { tag: '{{societe_email}}', label: 'Email' },
      { tag: '{{societe_siret}}', label: 'SIRET' },
      { tag: '{{societe_logo}}', label: 'Logo société' },
    ],
  },
  {
    group: 'Co-souscripteur',
    fields: [
      { tag: '{{co_civilite}}', label: 'Civilité co-souscripteur' },
      { tag: '{{co_prenom}}', label: 'Prénom co-souscripteur' },
      { tag: '{{co_nom}}', label: 'Nom co-souscripteur' },
      { tag: '{{co_email}}', label: 'Email co-souscripteur' },
      { tag: '{{co_telephone}}', label: 'Téléphone co-souscripteur' },
      { tag: '{{co_adresse}}', label: 'Adresse co-souscripteur' },
      { tag: '{{co_code_postal}}', label: 'Code postal co-souscripteur' },
      { tag: '{{co_ville}}', label: 'Ville co-souscripteur' },
      { tag: '{{co_nationalite}}', label: 'Nationalité co-souscripteur' },
    ],
  },
  {
    group: 'Système',
    fields: [
      { tag: '{{reference_contrat}}', label: 'Référence du contrat' },
      { tag: '{{date_du_jour}}', label: 'Date du jour' },
      { tag: '{{date_signature}}', label: 'Date de signature' },
      { tag: '{{date_fin_contrat}}', label: 'Date de fin de contrat' },
    ],
  },
];

interface ContractTemplateEditorProps {
  templateName: string;
  onNameChange: (name: string) => void;
  content: string;
  onContentChange: (content: string) => void;
}

function parseBlocks(html: string): { label: string; html: string }[] {
  return parseContractTemplateBlocks(html).map((block) => ({
    label: block.label,
    html: block.html,
  }));
}

function getBlockLabel(html: string, fallback = 'Bloc') {
  const parsed = parseContractTemplateBlocks(html);
  return parsed[0]?.label || fallback;
}

function rebuildHtml(originalHtml: string, blocks: { label: string; html: string }[]): string {
  return rebuildContractTemplateFromBlocks(
    originalHtml,
    blocks.map((block, index) => ({
      id: `block-${index}`,
      label: block.label,
      html: block.html,
      excerpt: '',
    })),
  );
}

const ContractTemplateEditor = ({ templateName, onNameChange, content, onContentChange }: ContractTemplateEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isSelfEdit = useRef(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'blocks'>('editor');

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    syncFromEditor();
  }, []);

  const syncFromEditor = () => {
    if (editorRef.current) {
      isSelfEdit.current = true;
      const raw = editorRef.current.innerHTML;
      onContentChange(stripLabels(raw));
    }
  };

  const insertField = (tag: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'inline-block bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono border border-primary/20 mx-0.5';
      span.contentEditable = 'false';
      span.setAttribute('data-field', tag);
      span.textContent = tag;
      range.deleteContents();
      range.insertNode(span);
      range.setStartAfter(span);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    syncFromEditor();
    setFieldsOpen(false);
  };

  const insertCoSubscriberBlock = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const coHtml = `<div style="margin-bottom:30px;"><div style="display:flex;align-items:center;margin-bottom:15px;border-bottom:2px solid #e8f0fe;padding-bottom:8px;"><div style="background:#2d6a9f;color:#fff;border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px;font-size:14px;margin-right:10px;">▪</div><h2 style="color:#0a1628;font-size:16px;margin:0;">IDENTITÉ DU CO-SOUSCRIPTEUR</h2></div><table style="width:100%;border-collapse:collapse;font-size:13px;"><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;width:30%;font-weight:600;color:#4a5568;">Civilité</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{co_civilite}}</td><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;width:20%;font-weight:600;color:#4a5568;">Nationalité</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{co_nationalite}}</td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Nom</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{co_nom}}</td><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Prénom</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{co_prenom}}</td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Email</td><td style="padding:10px 12px;border:1px solid #e2e8f0;" colspan="3">{{co_email}}</td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Téléphone</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{co_telephone}}</td><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Adresse</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{co_adresse}}, {{co_code_postal}} {{co_ville}}</td></tr></table></div>`;
    document.execCommand('insertHTML', false, coHtml);
    syncFromEditor();
  };

  const insertIdentityBlock = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const identityHtml = `<div style="margin-bottom:30px;"><div style="display:flex;align-items:center;margin-bottom:15px;border-bottom:2px solid #e8f0fe;padding-bottom:8px;"><div style="background:#2d6a9f;color:#fff;border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px;font-size:14px;margin-right:10px;">1</div><h2 style="color:#0a1628;font-size:16px;margin:0;">IDENTITÉ DU SOUSCRIPTEUR</h2></div><table style="width:100%;border-collapse:collapse;font-size:13px;"><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;width:30%;font-weight:600;color:#4a5568;">Civilité</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{civilite}}</td><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;width:20%;font-weight:600;color:#4a5568;">Nationalité</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{nationalite}}</td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Nom</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{nom}}</td><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Prénom</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{prenom}}</td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Email</td><td style="padding:10px 12px;border:1px solid #e2e8f0;" colspan="3">{{email}}</td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Téléphone</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{telephone}}</td><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Adresse</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{adresse}}, {{code_postal}} {{ville}}</td></tr></table></div>`;
    document.execCommand('insertHTML', false, identityHtml);
    syncFromEditor();
  };

  const insertCompanyBlock = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const companyHtml = `<div style="margin-bottom:30px;"><div style="display:flex;align-items:center;margin-bottom:15px;border-bottom:2px solid #e8f0fe;padding-bottom:8px;"><div style="background:#2d6a9f;color:#fff;border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px;font-size:14px;margin-right:10px;">▪</div><h2 style="color:#0a1628;font-size:16px;margin:0;">IDENTITÉ DE LA SOCIÉTÉ</h2></div><table style="width:100%;border-collapse:collapse;font-size:13px;"><tr><td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;" colspan="4"><strong>{{societe_logo}}</strong></td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;width:30%;font-weight:600;color:#4a5568;">Raison sociale</td><td style="padding:10px 12px;border:1px solid #e2e8f0;" colspan="3">{{societe_nom}}</td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">SIRET</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{societe_siret}}</td><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;width:20%;font-weight:600;color:#4a5568;">Téléphone</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{societe_telephone}}</td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Adresse</td><td style="padding:10px 12px;border:1px solid #e2e8f0;" colspan="3">{{societe_adresse}}, {{societe_code_postal}} {{societe_ville}}</td></tr><tr><td style="padding:10px 12px;background:#f8fafd;border:1px solid #e2e8f0;font-weight:600;color:#4a5568;">Email</td><td style="padding:10px 12px;border:1px solid #e2e8f0;" colspan="3">{{societe_email}}</td></tr></table></div>`;
    document.execCommand('insertHTML', false, companyHtml);
    syncFromEditor();
  };

  // Block management
  const blocks = useMemo(() => {
    if (!content) return [];
    return parseBlocks(content);
  }, [content]);

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];

    const renumbered = newBlocks.map((block, i) => {
      let html = block.html;
      const circleMatch = html.match(/(border-radius:\s*50%[^>]*>)\s*\d+\s*<\/div>/);
      if (circleMatch) {
        html = html.replace(/(border-radius:\s*50%[^>]*>)\s*\d+\s*(<\/div>)/, `$1${i + 1}$2`);
      }
      return { ...block, html };
    });

    const newHtml = rebuildHtml(content, renumbered);
    onContentChange(newHtml);
  };

  const deleteBlock = (index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    if (newBlocks.length === 0) {
      onContentChange('');
      return;
    }
    const renumbered = newBlocks.map((block, i) => {
      let html = block.html;
      const circleMatch = html.match(/(border-radius:\s*50%[^>]*>)\s*\d+\s*<\/div>/);
      if (circleMatch) {
        html = html.replace(/(border-radius:\s*50%[^>]*>)\s*\d+\s*(<\/div>)/, `$1${i + 1}$2`);
      }
      return { ...block, html };
    });
    const newHtml = rebuildHtml(content, renumbered);
    onContentChange(newHtml);
  };

  const getBlockPreview = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || '').trim().substring(0, 60);
  };

  // Inject visual block labels into editor HTML for display only
  const contentWithLabels = useMemo(() => {
    if (!content) return content;
    const parsed = parseBlocks(content);
    if (parsed.length <= 1 && parsed[0]?.label === 'Contenu') return content;

    const container = document.createElement('div');
    container.innerHTML = content;
    const wrapper = container.querySelector('div[style*="max-width"]') || container;
    const wrapperChildren = Array.from(wrapper.children);

    let sectionsParent: Element = wrapper;
    for (const child of wrapperChildren) {
      const style = (child as HTMLElement).getAttribute('style') || '';
      if (style.includes('padding') && !style.includes('background') && !style.includes('border-radius') && !style.includes('linear-gradient')) {
        sectionsParent = child;
        break;
      }
    }

    // Tag all children with data-block-label
    let blockIdx = 0;
    const tagChildren = (parent: Element) => {
      for (const child of Array.from(parent.children)) {
        const el = child as HTMLElement;
        if (!el.outerHTML.trim()) continue;
        blockIdx++;
        const label = getBlockLabel(el.outerHTML);
        el.setAttribute('data-block-label', `Bloc ${blockIdx}: ${label}`);
        el.style.position = 'relative';
      }
    };

    if (sectionsParent !== wrapper) {
      for (const child of wrapperChildren) {
        const el = child as HTMLElement;
        if (child === sectionsParent) {
          tagChildren(sectionsParent);
          continue;
        }
        if (!el.outerHTML.trim()) continue;
        blockIdx++;
        const label = getBlockLabel(el.outerHTML, blockIdx === 1 ? 'En-tête' : 'Pied de page');
        el.setAttribute('data-block-label', `Bloc ${blockIdx}: ${label}`);
        el.style.position = 'relative';
      }
    } else {
      tagChildren(wrapper);
    }

    return container.innerHTML;
  }, [content]);

  // Sync editor innerHTML only on external content changes (not self-edits)
  useEffect(() => {
    if (isSelfEdit.current) {
      isSelfEdit.current = false;
      return;
    }
    if (editorRef.current) {
      editorRef.current.innerHTML = contentWithLabels;
    }
  }, [contentWithLabels]);

  // Strip data-block-label attributes from saved content
  const stripLabels = (html: string): string => {
    return html.replace(/\s*data-block-label="[^"]*"/g, '');
  };

  const toolbarButtons = [
    { icon: Bold, command: 'bold', tooltip: 'Gras' },
    { icon: Italic, command: 'italic', tooltip: 'Italique' },
    { icon: Underline, command: 'underline', tooltip: 'Souligné' },
    null,
    { icon: AlignLeft, command: 'justifyLeft', tooltip: 'Aligner à gauche' },
    { icon: AlignCenter, command: 'justifyCenter', tooltip: 'Centrer' },
    { icon: AlignRight, command: 'justifyRight', tooltip: 'Aligner à droite' },
    null,
    { icon: List, command: 'insertUnorderedList', tooltip: 'Liste à puces' },
    { icon: ListOrdered, command: 'insertOrderedList', tooltip: 'Liste numérotée' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-foreground">Nom du modèle *</label>
        <Input
          value={templateName}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Ex: Contrat Livret Épargne"
          className="mt-1"
        />
      </div>

      {/* Editor area with optional block reorder overlay */}
      <div className="border rounded-lg overflow-hidden bg-background relative">
        {/* Toolbar */}
        <div className="flex items-center flex-wrap gap-0.5 p-2 border-b bg-muted/30">
          <select
            className="h-8 px-2 text-xs rounded border border-input bg-background text-foreground"
            onChange={e => execCommand('fontSize', e.target.value)}
            defaultValue="3"
          >
            <option value="1">Très petit</option>
            <option value="2">Petit</option>
            <option value="3">Normal</option>
            <option value="4">Grand</option>
            <option value="5">Très grand</option>
            <option value="6">Titre</option>
            <option value="7">Grand titre</option>
          </select>

          <div className="w-px h-6 bg-border mx-1" />

          {toolbarButtons.map((btn, i) =>
            btn === null ? (
              <div key={`sep-${i}`} className="w-px h-6 bg-border mx-1" />
            ) : (
              <Button
                key={btn.command}
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={btn.tooltip}
                onClick={() => execCommand(btn.command)}
              >
                <btn.icon className="w-4 h-4" />
              </Button>
            )
          )}

          <div className="w-px h-6 bg-border mx-1" />

          <Popover open={fieldsOpen} onOpenChange={setFieldsOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs">
                <Tag className="w-3.5 h-3.5" />
                Champ dynamique
                <ChevronDown className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <ScrollArea className="h-80">
                <div className="p-2 space-y-3">
                  {DYNAMIC_FIELDS.map(group => (
                    <div key={group.group}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                        {group.group}
                      </p>
                      <div className="space-y-0.5">
                        {group.fields.map(field => (
                          <button
                            key={field.tag}
                            type="button"
                            onClick={() => insertField(field.tag)}
                            className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors flex items-center justify-between"
                          >
                            <span className="text-foreground">{field.label}</span>
                            <code className="text-[10px] text-muted-foreground font-mono">{field.tag}</code>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={insertIdentityBlock}>
            <TableProperties className="w-3.5 h-3.5" />
            Bloc souscripteur
          </Button>

          <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={insertCompanyBlock}>
            <Building2 className="w-3.5 h-3.5" />
            Bloc société
          </Button>

          <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={insertCoSubscriberBlock}>
            <TableProperties className="w-3.5 h-3.5" />
            Bloc co-souscripteur
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            type="button"
            variant={viewMode === 'blocks' ? 'default' : 'outline'}
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setViewMode(viewMode === 'blocks' ? 'editor' : 'blocks')}
          >
            <Layers className="w-3.5 h-3.5" />
            {viewMode === 'blocks' ? 'Fermer blocs' : 'Réorganiser'}
          </Button>
        </div>

        {/* Editor area */}
        <style>{`
          .contract-editor [data-block-label] {
            outline: 1px dashed hsl(var(--primary) / 0.3);
            outline-offset: 2px;
          }
          .contract-editor [data-block-label]::before {
            content: attr(data-block-label);
            position: absolute;
            top: -10px;
            left: 4px;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            font-size: 9px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 3px;
            z-index: 5;
            pointer-events: none;
            white-space: nowrap;
            line-height: 14px;
            letter-spacing: 0.3px;
          }
        `}</style>
        <div
          ref={editorRef}
          contentEditable
          className="contract-editor min-h-[400px] p-4 pt-6 text-sm text-foreground focus:outline-none prose prose-sm max-w-none"
          onInput={syncFromEditor}
          suppressContentEditableWarning
        />

        {/* Block reorder overlay */}
        {viewMode === 'blocks' && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-10 flex flex-col">
            <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Réorganiser les blocs
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Déplacez les sections avec les flèches ↑↓, puis cliquez Enregistrer.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setViewMode('editor')}
              >
                Enregistrer & Fermer
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {blocks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Aucun bloc détecté. Ajoutez du contenu dans l'éditeur d'abord.
                </div>
              ) : (
                <div className="divide-y">
                  {blocks.map((block, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col gap-0.5">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveBlock(index, 'up')}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 'down')}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <Badge variant="secondary" className="text-xs font-mono shrink-0">{index + 1}</Badge>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{block.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{getBlockPreview(block.html)}</p>
                      </div>

                      <div className="w-48 h-20 rounded border border-border overflow-hidden bg-white shrink-0">
                        <div
                          className="origin-top-left pointer-events-none"
                          style={{ transform: 'scale(0.22)', transformOrigin: 'top left', width: '454%' }}
                          dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(block.html) }}
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        title="Supprimer ce bloc"
                        onClick={() => deleteBlock(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Utilisez « Champ dynamique » pour insérer des données automatiques. Cliquez « Réorganiser » pour changer l'ordre des sections.
      </p>
    </div>
  );
};

export default ContractTemplateEditor;
