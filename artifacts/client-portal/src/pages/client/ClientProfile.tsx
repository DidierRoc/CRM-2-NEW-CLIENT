import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { logConnection } from '@/lib/connectionLog';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { callCrmApi } from '@/lib/crmApi';
import { supabase as crmSupabase } from '@/lib/crmSupabaseClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Save, Loader2, Shield, Landmark, UserCircle, Users, Building2,
  Plus, Trash2, Eye, EyeOff, CheckCircle2, Lock, Phone, Mail,
  MapPin, Globe, CreditCard, BadgeCheck, AlertCircle, Search,
  UploadCloud, FileText, X as XIcon, ShieldCheck, Pencil, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { ClientRowsSkeleton } from '@/components/client-portal/ClientPageFallback';

type TabId = 'personal' | 'security' | 'bank' | 'beneficiaries' | 'legal';

const TABS: { id: TabId; label: string; short: string; icon: React.ElementType }[] = [
  { id: 'personal', label: 'Informations personnelles', short: 'Infos', icon: UserCircle },
  { id: 'security', label: 'Sécurité', short: 'Sécurité', icon: Shield },
  { id: 'bank', label: 'Comptes bancaires', short: 'Banque', icon: Landmark },
  { id: 'beneficiaries', label: 'Bénéficiaires', short: 'Bénéficiaires', icon: Users },
  { id: 'legal', label: 'Personne morale', short: 'Morale', icon: Building2 },
];

const NATIONALITES = [
  'Afghane', 'Albanaise', 'Algérienne', 'Allemande', 'Américaine', 'Andorrane', 'Angolaise',
  'Antiguaise', 'Argentine', 'Arménienne', 'Australienne', 'Autrichienne', 'Azerbaïdjanaise',
  'Bahamienne', 'Bahreïnienne', 'Bangladaise', 'Barbadienne', 'Bélarusse', 'Belge', 'Belize',
  'Béninoise', 'Bhoutanaise', 'Bolivienne', 'Bosniaque', 'Botswanaise', 'Brésilienne', 'Britannique',
  'Brunéienne', 'Bulgare', 'Burkinabè', 'Burundaise', 'Cambodgienne', 'Camerounaise', 'Canadienne',
  'Cap-verdienne', 'Centrafricaine', 'Chilienne', 'Chinoise', 'Chypriote', 'Colombienne', 'Comorienne',
  'Congolaise', 'Coréenne', 'Costaricaine', 'Croate', 'Cubaine', 'Danoise', 'Djiboutienne',
  'Dominicaine', 'Équatorienne', 'Égyptienne', 'Émiratie', 'Espagnole', 'Estonienne', 'Éthiopienne',
  'Fidjienne', 'Finlandaise', 'Française', 'Gabonaise', 'Gambienne', 'Géorgienne', 'Ghanéenne',
  'Grecque', 'Grenadienne', 'Guatémaltèque', 'Guinéenne', 'Guyanienne', 'Haïtienne', 'Hondurienne',
  'Hongroise', 'Indienne', 'Indonésienne', 'Irakienne', 'Iranienne', 'Irlandaise', 'Islandaise',
  'Israélienne', 'Italienne', 'Ivoirienne', 'Jamaïcaine', 'Japonaise', 'Jordanienne', 'Kazakhe',
  'Kényane', 'Kirghize', 'Laotienne', 'Lettone', 'Libanaise', 'Libérienne', 'Libyenne', 'Liechtensteinoise',
  'Lituanienne', 'Luxembourgeoise', 'Macédonienne', 'Malgache', 'Malaisienne', 'Malawite', 'Maldivienne',
  'Malienne', 'Maltaise', 'Marocaine', 'Mauritanienne', 'Mauricienne', 'Mexicaine', 'Moldave',
  'Monégasque', 'Mongole', 'Monténégrine', 'Mozambicaine', 'Namibienne', 'Népalaise', 'Nicaraguayenne',
  'Nigériane', 'Nigérienne', 'Norvégienne', 'Néo-Zélandaise', 'Omanaise', 'Ougandaise', 'Ouzbèke',
  'Pakistanaise', 'Panaméenne', 'Papouasienne', 'Paraguayenne', 'Péruvienne', 'Philippine', 'Polonaise',
  'Portugaise', 'Qatarienne', 'Roumaine', 'Russe', 'Rwandaise', 'Saint-Lucienne', 'Salvadorienne',
  'Saoudienne', 'Sénégalaise', 'Serbe', 'Sierra-Léonaise', 'Singapourienne', 'Slovaque', 'Slovène',
  'Somalienne', 'Soudanaise', 'Sri Lankaise', 'Suédoise', 'Suisse', 'Surinamaise', 'Syrienne',
  'Tadjike', 'Tanzanienne', 'Tchadienne', 'Thaïlandaise', 'Togolaise', 'Trinidadienne', 'Tunisienne',
  'Turkmène', 'Turque', 'Ukrainienne', 'Uruguayenne', 'Vénézuélienne', 'Vietnamienne', 'Yéménite',
  'Zambienne', 'Zimbabwéenne',
];

// ── Shared input class ──
const inputClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E60000]/30 focus:border-[#E60000] transition-all duration-200 w-full';

// ── Field wrapper ──
const FieldWrapper = ({ icon: Icon, label, children }: { icon?: React.ElementType; label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </label>
    {children}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 mb-5">
    <span className="text-sm font-bold text-[#111111] uppercase tracking-widest">{children}</span>
    <div className="flex-1 h-px bg-gradient-to-r from-[#111111]/20 to-transparent" />
  </div>
);

// ── Nationality autocomplete ──
const NationaliteAutocomplete = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const suggestions = query.length >= 2
    ? NATIONALITES.filter(n => n.toLowerCase().startsWith(query.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (nat: string) => {
    onChange(nat);
    setQuery(nat);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        className={inputClass}
        type="text"
        value={query}
        placeholder={placeholder || 'Française'}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {suggestions.map(nat => (
            <li
              key={nat}
              onMouseDown={() => handleSelect(nat)}
              className="px-3 py-2.5 text-sm text-slate-700 cursor-pointer hover:bg-[#111111]/5 hover:text-[#111111] flex items-center gap-2"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {nat}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Address autocomplete (api-adresse.data.gouv.fr) ──
interface AdresseSuggestion {
  label: string;
  name: string;
  postcode: string;
  city: string;
}

const AddressAutocomplete = ({
  value,
  onSelect,
  placeholder,
}: {
  value: string;
  onSelect: (name: string, postcode: string, city: string) => void;
  placeholder?: string;
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AdresseSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=6&autocomplete=1`
      );
      const json = await res.json();
      const items: AdresseSuggestion[] = (json.features || []).map((f: any) => ({
        label: f.properties.label,
        name: f.properties.name,
        postcode: f.properties.postcode,
        city: f.properties.city,
      }));
      setSuggestions(items);
      setOpen(items.length > 0);
    } catch {
      setSuggestions([]);
    }
    setLoading(false);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    onSelect(val, '', '');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (s: AdresseSuggestion) => {
    setQuery(s.name);
    onSelect(s.name, s.postcode, s.city);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          className={inputClass + ' pr-8'}
          type="text"
          value={query}
          placeholder={placeholder || "Numéro et rue"}
          onChange={e => handleChange(e.target.value)}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          </div>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(s)}
              className="px-3 py-2.5 cursor-pointer hover:bg-[#111111]/5 hover:text-[#111111] border-b border-slate-50 last:border-0"
            >
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-slate-700 font-medium">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.postcode} {s.city}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════
const TAB_LABELS: Record<string, { label: string; short: string; labelEn: string; shortEn: string }> = {
  personal:      { label: 'Informations personnelles', short: 'Infos',        labelEn: 'Personal information', shortEn: 'Info' },
  security:      { label: 'Sécurité',                  short: 'Sécurité',    labelEn: 'Security',             shortEn: 'Security' },
  bank:          { label: 'Comptes bancaires',          short: 'Banque',       labelEn: 'Bank accounts',         shortEn: 'Bank' },
  beneficiaries: { label: 'Bénéficiaires',             short: 'Bénéficiaires', labelEn: 'Beneficiaries',        shortEn: 'Beneficiaries' },
  legal:         { label: 'Personne morale',            short: 'Morale',       labelEn: 'Legal entity',          shortEn: 'Legal' },
};

const ClientProfile = () => {
  const { clientAccount } = useOutletContext<{ clientAccount: any }>();
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [lead, setLead] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankForm, setBankForm] = useState({ titulaire: '', iban: '', bic: '', nom_banque: '' });
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [pendingBankIds, setPendingBankIds] = useState<Set<string>>(new Set());
  const [savingBank, setSavingBank] = useState(false);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankDragOver, setBankDragOver] = useState(false);
  const bankFileInputRef = useRef<HTMLInputElement>(null);

  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [benefForm, setBenefForm] = useState({
    type: 'personne', civilite: '', nom: '', prenom: '', date_naissance: '', lien_parente: '',
    adresse: '', code_postal: '', ville: '', pays: 'France', telephone: '', email: '', part_pourcentage: 0,
    raison_sociale: '', siret: '',
  });
  const [showBenefForm, setShowBenefForm] = useState(false);
  const [savingBenef, setSavingBenef] = useState(false);

  const [legalEntities, setLegalEntities] = useState<any[]>([]);
  const [legalForm, setLegalForm] = useState({
    raison_sociale: '', forme_juridique: '', siret: '', numero_rcs: '',
    adresse_siege: '', code_postal: '', ville: '', pays: 'France',
    representant_nom: '', representant_prenom: '', representant_fonction: '', telephone: '', email: '',
  });
  const [showLegalForm, setShowLegalForm] = useState(false);
  const [savingLegal, setSavingLegal] = useState(false);

  useEffect(() => {
    logConnection(clientAccount?.id, 'page_view', 'Mon Profil');
  }, []);

  useEffect(() => {
    if (!clientAccount?.lead_id) return;
    loadAll();

    // Realtime — écoute les mises à jour sur client_bank_accounts pour ce lead
    const channel = crmSupabase
      .channel(`bank-accounts-${clientAccount.lead_id}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'client_bank_accounts',
          filter: `lead_id=eq.${clientAccount.lead_id}`,
        },
        (payload: any) => {
          const updated = payload.new ?? {};
          const previous = payload.old ?? {};
          // Retirer du Set "en attente" dès que la ligne est mise à jour
          if (updated.id) {
            setPendingBankIds(prev => {
              const next = new Set(prev);
              next.delete(updated.id);
              return next;
            });
          }
          // Toast si is_verified passe à true
          if (updated.is_verified === true && previous.is_verified !== true) {
            toast.success('Votre RIB a été validé !', {
              description: `Le compte bancaire de ${updated.titulaire || 'votre titulaire'} est maintenant vérifié.`,
              duration: 7000,
            });
          }
          loadAll();
        }
      )
      .subscribe();

    return () => {
      crmSupabase.removeChannel(channel);
    };
  }, [clientAccount?.lead_id]);

  const loadAll = async () => {
    try {
      // Show cached data instantly — already prefetched by usePrefetchClientData at login
      const cached = queryClient.getQueryData(['client-profile', clientAccount?.lead_id]) as any;
      if (cached) {
        if (cached?.lead) setLead(cached.lead);
        setBankAccounts(cached?.bankAccounts || []);
        setBeneficiaries(cached?.beneficiaries || []);
        setLegalEntities(cached?.legalEntities || []);
      }
      // Refresh in background
      const data = await callCrmApi('client-self-service', 'get-profile');
      if (data?.lead) setLead(data.lead);
      setBankAccounts(data?.bankAccounts || []);
      setBeneficiaries(data?.beneficiaries || []);
      setLegalEntities(data?.legalEntities || []);
      // Keep the React Query cache in sync
      queryClient.setQueryData(['client-profile', clientAccount?.lead_id], data);
    } catch (err) {
      console.error('Failed to load profile', err);
    }
  };

  const handleChange = (key: string, value: string) => {
    setLead((prev: any) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleAddressSelect = (name: string, postcode: string, city: string) => {
    setLead((prev: any) => ({
      ...prev,
      adresse: name,
      ...(postcode ? { code_postal: postcode } : {}),
      ...(city ? { ville: city } : {}),
    }));
    setDirty(true);
  };

  const handleSavePersonal = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      await callCrmApi('client-self-service', 'update-profile', {
        civilite: lead.civilite, prenom: lead.prenom, nom: lead.nom,
        email: lead.email, telephone: lead.telephone,
        adresse: lead.adresse, code_postal: lead.code_postal,
        ville: lead.ville, nationalite: lead.nationalite,
      });
      setDirty(false);
      toast.success('Profil mis à jour');
      logConnection(clientAccount?.id, 'profile_update');
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPwd.length < 8) { toast.error('Le mot de passe doit contenir au moins 8 caractères'); return; }
    if (newPwd !== confirmPwd) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setChangingPwd(true);
    try {
      await callCrmApi('client-self-service', 'change-password', {
        currentPassword: currentPwd,
        newPassword: newPwd,
      });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      toast.success('Mot de passe modifié avec succès');
      logConnection(clientAccount?.id, 'password_change');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du changement de mot de passe');
    }
    setChangingPwd(false);
  };

  const handleAddBank = async () => {
    if (!bankForm.iban || !bankForm.titulaire) { toast.error("Veuillez remplir le titulaire et l'IBAN"); return; }
    setSavingBank(true);

    if (editingBankId) {
      // UPDATE existing
      const { error } = await crmSupabase
        .from('client_bank_accounts')
        .update({ titulaire: bankForm.titulaire, iban: bankForm.iban, bic: bankForm.bic, nom_banque: bankForm.nom_banque })
        .eq('id', editingBankId);
      setSavingBank(false);
      if (error) { toast.error(error.message); return; }
      setBankForm({ titulaire: '', iban: '', bic: '', nom_banque: '' });
      setBankFile(null);
      setShowBankModal(false);
      setEditingBankId(null);
      loadAll();
      toast.success('Compte bancaire mis à jour. Votre RIB modifié sera revalidé sous 12 à 24h.');
    } else {
      // INSERT new — récupère l'ID inséré pour le tracker comme "en attente"
      let insertedId: string | null = null;
      let { data: insertedRows, error } = await crmSupabase
        .from('client_bank_accounts')
        .insert({ lead_id: clientAccount.lead_id, ...bankForm, is_verified: false })
        .select('id');
      if (error && /column|schéma|schema/i.test(error.message)) {
        // Colonne is_verified absente — insert sans le champ
        const fallback = await crmSupabase
          .from('client_bank_accounts')
          .insert({ lead_id: clientAccount.lead_id, ...bankForm })
          .select('id');
        error = fallback.error;
        insertedRows = fallback.data;
      }
      setSavingBank(false);
      if (error) { toast.error(error.message); return; }
      // Mémoriser cet ID comme "en attente de validation" pour la session
      if (insertedRows?.[0]?.id) {
        insertedId = insertedRows[0].id;
        setPendingBankIds(prev => new Set([...prev, insertedId!]));
      }
      setBankForm({ titulaire: '', iban: '', bic: '', nom_banque: '' });
      setBankFile(null);
      setShowBankModal(false);
      loadAll();
      toast.success('Compte bancaire ajouté. Votre RIB sera validé par nos équipes sous 12 à 24h.');
    }
  };

  const handleEditBank = (ba: any) => {
    setEditingBankId(ba.id);
    setBankForm({ titulaire: ba.titulaire || '', iban: ba.iban || '', bic: ba.bic || '', nom_banque: ba.nom_banque || '' });
    setBankFile(null);
    setShowBankModal(true);
  };

  // A bank account is "pending" if is_verified is explicitly false, or was created within the last 48h
  const isBankPending = (ba: any) => {
    // 1. Compte ajouté dans cette session → toujours en attente jusqu'à validation
    if (pendingBankIds.has(ba.id)) return true;
    // 2. Champ is_verified explicite en DB
    if (typeof ba.is_verified === 'boolean') return !ba.is_verified;
    // 3. Champ status explicite
    if (ba.status && ba.status !== 'verified' && ba.status !== 'active') return true;
    // 4. Fallback temporel si created_at disponible
    const created = ba.created_at ? new Date(ba.created_at).getTime() : NaN;
    if (!isNaN(created)) return (Date.now() - created) < 48 * 60 * 60 * 1000;
    // 5. created_at absent → on ne peut pas déterminer, affiche vérifié par défaut
    return false;
  };

  const maskIban = (iban: string) => {
    if (!iban) return '—';
    const clean = iban.replace(/\s/g, '');
    if (clean.length < 8) return iban;
    const prefix = clean.slice(0, 4);
    const suffix = clean.slice(-4);
    const middleLen = clean.length - 8;
    const masked = '*'.repeat(middleLen).match(/.{1,4}/g)?.join(' ') || '';
    return `${prefix} ${masked} ${suffix}`.replace(/\s+/g, ' ').trim();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleBankFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setBankDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 10 Mo)'); return; }
      setBankFile(file);
    }
  };

  const handleBankFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 10 Mo)'); return; }
      setBankFile(file);
    }
  };

  const handleDeleteBank = async (id: string) => {
    await crmSupabase.from('client_bank_accounts').delete().eq('id', id);
    loadAll();
    toast.success('Compte bancaire supprimé');
  };

  const handleAddBenef = async () => {
    if (!benefForm.nom) { toast.error('Le nom est requis'); return; }
    if (benefForm.part_pourcentage <= 0) { toast.error('La part doit être supérieure à 0%'); return; }
    setSavingBenef(true);
    const { error } = await crmSupabase.from('client_beneficiaries').insert({ lead_id: clientAccount.lead_id, ...benefForm });
    setSavingBenef(false);
    if (error) { toast.error(error.message); return; }
    setBenefForm({ type: 'personne', civilite: '', nom: '', prenom: '', date_naissance: '', lien_parente: '', adresse: '', code_postal: '', ville: '', pays: 'France', telephone: '', email: '', part_pourcentage: 0, raison_sociale: '', siret: '' });
    setShowBenefForm(false);
    loadAll();
    toast.success('Bénéficiaire ajouté');
  };

  const handleDeleteBenef = async (id: string) => {
    await crmSupabase.from('client_beneficiaries').delete().eq('id', id);
    loadAll();
    toast.success('Bénéficiaire supprimé');
  };

  const handleAddLegal = async () => {
    if (!legalForm.raison_sociale) { toast.error('La raison sociale est requise'); return; }
    setSavingLegal(true);
    const { error } = await crmSupabase.from('client_legal_entities').insert({ lead_id: clientAccount.lead_id, ...legalForm });
    setSavingLegal(false);
    if (error) { toast.error(error.message); return; }
    setLegalForm({ raison_sociale: '', forme_juridique: '', siret: '', numero_rcs: '', adresse_siege: '', code_postal: '', ville: '', pays: 'France', representant_nom: '', representant_prenom: '', representant_fonction: '', telephone: '', email: '' });
    setShowLegalForm(false);
    loadAll();
    toast.success('Personne morale ajoutée');
  };

  const handleDeleteLegal = async (id: string) => {
    await crmSupabase.from('client_legal_entities').delete().eq('id', id);
    loadAll();
    toast.success('Personne morale supprimée');
  };

  if (!lead) return <ClientRowsSkeleton rows={6} />;

  const totalParts = beneficiaries.reduce((s, b) => s + Number(b.part_pourcentage || 0), 0);
  const initials = `${(lead.prenom || '')[0] || ''}${(lead.nom || '')[0] || ''}`.toUpperCase();
  const fullName = `${lead.civilite ? lead.civilite + ' ' : ''}${lead.prenom || ''} ${lead.nom || ''}`.trim();
  const clientRef = clientAccount?.id ? String(clientAccount.id).slice(-8).toUpperCase() : '—';

  const profileFields: { key: string; value: string }[] = [
    { key: 'civilite', value: lead.civilite || '' },
    { key: 'prenom', value: lead.prenom || '' },
    { key: 'nom', value: lead.nom || '' },
    { key: 'email', value: lead.email || '' },
    { key: 'telephone', value: lead.telephone || '' },
    { key: 'adresse', value: lead.adresse || '' },
    { key: 'code_postal', value: lead.code_postal || '' },
    { key: 'ville', value: lead.ville || '' },
    { key: 'nationalite', value: lead.nationalite || '' },
  ];
  const filledFields = profileFields.filter(f => f.value).length;
  const completionPct = Math.round((filledFields / profileFields.length) * 100);

  return (
    <div className="space-y-0">

      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a1628] via-[#111111] to-[#cc0000] p-6 sm:p-8 mb-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full bg-[#E60000]/10 blur-2xl" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E60000] to-[#111111] border-2 border-white/20 flex items-center justify-center shadow-xl text-xl font-bold text-white tracking-wide">
              {initials || <UserCircle className="w-8 h-8 text-white/70" />}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-sm font-medium mb-0.5">Bonjour,</p>
            <h1 className="text-2xl font-bold text-white truncate">{fullName || 'Mon compte'}</h1>
            <p className="text-white/50 text-sm mt-0.5">Consultez et mettez à jour vos informations personnelles en toute sécurité.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1.5">
              <BadgeCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300 text-xs font-semibold">Identité vérifiée</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PROFILE SUMMARY CARD ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Titulaire</p>
          <p className="text-sm font-bold text-[#111111] truncate">{fullName || '—'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Référence client</p>
          <p className="text-sm font-bold text-[#111111] font-mono">{clientRef}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Comptes bancaires</p>
          <p className="text-sm font-bold text-[#111111]">{bankAccounts.length} enregistré{bankAccounts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Profil complété</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${completionPct}%`, background: completionPct === 100 ? '#10b981' : '#E60000' }}
              />
            </div>
            <span className="text-sm font-bold text-[#111111] shrink-0">{completionPct}%</span>
          </div>
        </div>
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-none">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${
                active
                  ? 'bg-[#111111] text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-[#111111]/30 hover:text-[#111111]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'en' ? (TAB_LABELS[tab.id]?.labelEn ?? tab.label) : tab.label}</span>
              <span className="sm:hidden">{lang === 'en' ? (TAB_LABELS[tab.id]?.shortEn ?? tab.short) : tab.short}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">

        {/* PERSONAL INFO */}
        {activeTab === 'personal' && (
          <div className="p-6 sm:p-8">
            <SectionTitle>{lang === 'en' ? 'Identity' : 'Identité'}</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <FieldWrapper icon={UserCircle} label="Civilité">
                <Select value={lead.civilite || ''} onValueChange={val => handleChange('civilite', val)}>
                  <SelectTrigger className={inputClass + ' mt-0'}>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monsieur">Monsieur</SelectItem>
                    <SelectItem value="Madame">Madame</SelectItem>
                  </SelectContent>
                </Select>
              </FieldWrapper>
              <FieldWrapper icon={UserCircle} label="Prénom">
                <input className={inputClass} type="text" value={lead.prenom || ''} onChange={e => handleChange('prenom', e.target.value)} placeholder="Votre prénom" />
              </FieldWrapper>
              <FieldWrapper icon={UserCircle} label="Nom de famille">
                <input className={inputClass} type="text" value={lead.nom || ''} onChange={e => handleChange('nom', e.target.value)} placeholder="Votre nom" />
              </FieldWrapper>
            </div>

            <SectionTitle>Coordonnées</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <FieldWrapper icon={Mail} label="Adresse e-mail">
                <input className={inputClass} type="email" value={lead.email || ''} onChange={e => handleChange('email', e.target.value)} placeholder="votre@email.com" />
              </FieldWrapper>
              <FieldWrapper icon={Phone} label="Téléphone">
                <input className={inputClass} type="tel" value={lead.telephone || ''} onChange={e => handleChange('telephone', e.target.value)} placeholder="+33 6 XX XX XX XX" />
              </FieldWrapper>
            </div>

            <SectionTitle>Adresse</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mb-8">
              <div className="sm:col-span-4">
                <FieldWrapper icon={MapPin} label="Adresse">
                  <AddressAutocomplete
                    value={lead.adresse || ''}
                    onSelect={handleAddressSelect}
                    placeholder="Tapez votre adresse..."
                  />
                </FieldWrapper>
              </div>
              <div className="sm:col-span-2">
                <FieldWrapper label="Code postal">
                  <input className={inputClass} type="text" value={lead.code_postal || ''} onChange={e => handleChange('code_postal', e.target.value)} placeholder="75001" />
                </FieldWrapper>
              </div>
              <div className="sm:col-span-3">
                <FieldWrapper label="Ville">
                  <input className={inputClass} type="text" value={lead.ville || ''} onChange={e => handleChange('ville', e.target.value)} placeholder="Paris" />
                </FieldWrapper>
              </div>
            </div>

            <SectionTitle>Informations complémentaires</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <FieldWrapper icon={Globe} label="Nationalité">
                <NationaliteAutocomplete
                  value={lead.nationalite || ''}
                  onChange={val => handleChange('nationalite', val)}
                  placeholder="Ex : Française"
                />
              </FieldWrapper>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4 border-t border-slate-100">
              <div className="flex items-start gap-2.5 flex-1 bg-slate-50 rounded-xl px-4 py-3">
                <Lock className="w-4 h-4 text-[#E60000] mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Vos données personnelles sont protégées et chiffrées conformément aux normes de sécurité bancaire en vigueur.
                </p>
              </div>
              <button
                onClick={handleSavePersonal}
                disabled={!dirty || saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-semibold shadow-md hover:bg-[#cc0000] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shrink-0"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {lang === 'en' ? 'Save changes' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        )}

        {/* SECURITY */}
        {activeTab === 'security' && (
          <div className="p-6 sm:p-8">
            <SectionTitle>{lang === 'en' ? 'Change password' : 'Modifier le mot de passe'}</SectionTitle>
            <div className="max-w-md space-y-4">
              {[
                { label: 'Mot de passe actuel', val: currentPwd, set: setCurrentPwd, show: showCurrentPwd, setShow: setShowCurrentPwd },
                { label: 'Nouveau mot de passe', val: newPwd, set: setNewPwd, show: showPwd, setShow: setShowPwd, hint: 'Minimum 8 caractères' },
                { label: 'Confirmer le nouveau mot de passe', val: confirmPwd, set: setConfirmPwd, show: showConfirmPwd, setShow: setShowConfirmPwd },
              ].map(({ label, val, set, show, setShow, hint }) => (
                <FieldWrapper key={label} icon={Lock} label={label}>
                  <div className="relative">
                    <input
                      className={inputClass + ' pr-10'}
                      type={show ? 'text' : 'password'}
                      value={val}
                      onChange={e => set(e.target.value)}
                      placeholder={hint || '••••••••'}
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FieldWrapper>
              ))}
              <button
                onClick={handleChangePassword}
                disabled={changingPwd || !newPwd}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-semibold shadow-md hover:bg-[#cc0000] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5"
              >
                {changingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Changer le mot de passe
              </button>
            </div>
            <div className="mt-8 flex items-start gap-2.5 bg-slate-50 rounded-xl px-4 py-3 max-w-md">
              <Lock className="w-4 h-4 text-[#E60000] mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Vos données personnelles sont protégées et chiffrées conformément aux normes de sécurité bancaire en vigueur.
              </p>
            </div>
          </div>
        )}

        {/* BANK ACCOUNTS */}
        {activeTab === 'bank' && (
          <div className="p-6 sm:p-8">

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#111111] mb-1">Mes comptes bancaires</h2>
                <p className="text-sm text-slate-500">
                  Gérez les comptes utilisés pour vos versements et remboursements en toute sécurité.
                </p>
              </div>
              <button
                onClick={() => { setShowBankModal(true); setEditingBankId(null); setBankFile(null); setBankForm({ titulaire: '', iban: '', bic: '', nom_banque: '' }); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-semibold shadow-md hover:bg-[#cc0000] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shrink-0 ml-4"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'en' ? 'Add account' : 'Ajouter un compte'}</span>
                <span className="sm:hidden">{lang === 'en' ? 'Add' : 'Ajouter'}</span>
              </button>
            </div>

            {/* Empty state */}
            {bankAccounts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-6 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <Landmark className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600 mb-2">Aucun compte bancaire enregistré</p>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Ajoutez votre RIB afin de faciliter vos futurs versements et remboursements.
                </p>
                <button
                  onClick={() => { setShowBankModal(true); setEditingBankId(null); setBankFile(null); setBankForm({ titulaire: '', iban: '', bic: '', nom_banque: '' }); }}
                  className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#cc0000] transition-all"
                >
                  <Plus className="w-4 h-4" />Ajouter mon RIB
                </button>
              </div>
            )}

            {/* Bank account cards */}
            {bankAccounts.length > 0 && (
              <div className="space-y-3">
                {bankAccounts.map((ba, idx) => (
                  <div
                    key={ba.id}
                    className="relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/50 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200 p-5"
                  >
                    {/* Decorative accent */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b from-[#E60000] to-[#111111]" />
                    <div className="pl-3 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Bank icon */}
                        <div className="w-11 h-11 rounded-xl bg-[#111111] flex items-center justify-center shrink-0 shadow">
                          <Landmark className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-bold text-[#111111] text-sm">{ba.titulaire}</p>
                            {/* Status badge */}
                            {isBankPending(ba) ? (
                              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" />{lang === 'en' ? 'Pending validation' : 'En attente de validation'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />Vérifié
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 font-medium mb-0.5">
                            {ba.nom_banque || 'Banque'}
                          </p>
                          <p className="text-xs font-mono text-slate-600 tracking-wider">{maskIban(ba.iban)}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                            {ba.bic && <p className="text-xs text-slate-400">BIC : <span className="font-mono text-slate-500">{ba.bic}</span></p>}
                          </div>
                          {isBankPending(ba) && (
                            <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              Validation en cours — délai estimé 12 à 24h
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEditBank(ba)}
                          className="text-[#E60000] hover:text-[#111111] p-2 rounded-lg hover:bg-blue-50 transition-all"
                          title="Modifier ce compte"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBank(ba.id)}
                          className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all"
                          title="Supprimer ce compte"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Security notice */}
            <div className="mt-6 flex items-start gap-3 bg-[#111111]/3 border border-[#111111]/10 rounded-xl px-4 py-3">
              <ShieldCheck className="w-4 h-4 text-[#E60000] mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Vos données bancaires sont protégées et chiffrées conformément aux normes de sécurité bancaire en vigueur.
              </p>
            </div>
          </div>
        )}

        {/* BANK MODAL */}
        {showBankModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-[#0a1628]/60 backdrop-blur-sm"
              onClick={() => setShowBankModal(false)}
            />
            {/* Panel */}
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">

              {/* Modal header */}
              <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 pt-6 pb-4 flex items-start justify-between z-10">
                <div>
                  <h3 className="text-lg font-bold text-[#111111]">{editingBankId ? (lang === 'en' ? 'Edit bank account' : 'Modifier le compte bancaire') : (lang === 'en' ? 'Add bank account' : 'Ajouter un compte bancaire')}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{editingBankId ? 'Modifiez les informations de votre RIB' : 'Saisissez les informations de votre RIB'}</p>
                </div>
                <button
                  onClick={() => { setShowBankModal(false); setEditingBankId(null); }}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl p-2 transition-all"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-6">

                {/* Section — Informations du compte */}
                <div>
                  <p className="text-xs font-bold text-[#111111] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5" />Informations du compte
                  </p>
                  <div className="space-y-3">
                    <FieldWrapper icon={UserCircle} label="Nom du titulaire">
                      <input
                        className={inputClass}
                        value={bankForm.titulaire}
                        onChange={e => setBankForm(p => ({ ...p, titulaire: e.target.value }))}
                        placeholder="Prénom Nom (tel qu'indiqué sur votre RIB)"
                      />
                    </FieldWrapper>
                    <FieldWrapper icon={CreditCard} label="IBAN">
                      <input
                        className={inputClass + ' font-mono tracking-wider'}
                        value={bankForm.iban}
                        onChange={e => setBankForm(p => ({ ...p, iban: e.target.value }))}
                        placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                      />
                    </FieldWrapper>
                    <FieldWrapper label="BIC / SWIFT">
                      <input
                        className={inputClass + ' font-mono'}
                        value={bankForm.bic}
                        onChange={e => setBankForm(p => ({ ...p, bic: e.target.value }))}
                        placeholder="BNPAFRPP"
                      />
                    </FieldWrapper>
                    <FieldWrapper icon={Landmark} label="Nom de la banque">
                      <input
                        className={inputClass}
                        value={bankForm.nom_banque}
                        onChange={e => setBankForm(p => ({ ...p, nom_banque: e.target.value }))}
                        placeholder="BNP Paribas, Crédit Agricole, CIC..."
                      />
                    </FieldWrapper>
                  </div>
                </div>

                {/* Section — Justificatif bancaire */}
                <div>
                  <p className="text-xs font-bold text-[#111111] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />Justificatif bancaire
                  </p>

                  {!bankFile ? (
                    <div
                      onDragOver={e => { e.preventDefault(); setBankDragOver(true); }}
                      onDragLeave={() => setBankDragOver(false)}
                      onDrop={handleBankFileDrop}
                      onClick={() => bankFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all duration-200 ${bankDragOver ? 'border-[#E60000] bg-[#E60000]/5 scale-[1.01]' : 'border-slate-200 hover:border-[#E60000]/50 hover:bg-slate-50'}`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors ${bankDragOver ? 'bg-[#E60000]/10' : 'bg-slate-100'}`}>
                        <UploadCloud className={`w-6 h-6 transition-colors ${bankDragOver ? 'text-[#E60000]' : 'text-slate-400'}`} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        {bankDragOver ? 'Déposez le fichier ici' : 'Glissez-déposez votre RIB ici'}
                      </p>
                      <p className="text-xs text-slate-400 mb-3">ou</p>
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111111] text-white text-xs font-semibold hover:bg-[#cc0000] transition-colors">
                        <Plus className="w-3.5 h-3.5" />Sélectionner un fichier
                      </span>
                      <p className="text-xs text-slate-400 mt-3">PDF, JPG, JPEG, PNG — max 10 Mo</p>
                      <input
                        ref={bankFileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={handleBankFileInput}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-2xl p-4">
                      <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{bankFile.name}</p>
                        <p className="text-xs text-slate-400">{formatFileSize(bankFile.size)}</p>
                      </div>
                      <button
                        onClick={() => setBankFile(null)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Security notice */}
                <div className="flex items-start gap-3 bg-[#111111]/4 border border-[#111111]/10 rounded-2xl px-4 py-3.5">
                  <ShieldCheck className="w-4 h-4 text-[#E60000] mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Pour votre sécurité, votre RIB sera vérifié par nos équipes avant son utilisation pour vos opérations bancaires. Les documents transmis sont protégés et chiffrés.
                  </p>
                </div>

              </div>

              {/* Modal footer */}
              <div className="sticky bottom-0 bg-white rounded-b-3xl border-t border-slate-100 px-6 py-4 flex gap-3">
                <button
                  onClick={() => { setShowBankModal(false); setEditingBankId(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddBank}
                  disabled={savingBank || !bankForm.iban || !bankForm.titulaire}
                  className="flex-[2] flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#111111] to-[#cc0000] text-white text-sm font-semibold shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5"
                >
                  {savingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingBankId ? (lang === 'en' ? 'Save changes' : 'Enregistrer les modifications') : (lang === 'en' ? 'Save bank account' : 'Enregistrer le compte bancaire')}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* BENEFICIARIES */}
        {activeTab === 'beneficiaries' && (
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-2">
              <SectionTitle>{lang === 'en' ? 'Designated beneficiaries' : 'Bénéficiaires désignés'}</SectionTitle>
              <button
                onClick={() => setShowBenefForm(!showBenefForm)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-[#111111] hover:bg-slate-50 transition-all -mt-5"
              >
                <Plus className="w-4 h-4" />Ajouter
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Désignez les personnes ou entités qui recevront les fonds issus de vos placements.
            </p>

            {totalParts > 0 && (
              <div className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl mb-4 ${totalParts === 100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : totalParts > 100 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                {totalParts === 100 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                Total des parts : {totalParts}% {totalParts === 100 ? '— Répartition complète' : totalParts > 100 ? '— Dépasse 100%' : `— ${100 - totalParts}% restants à attribuer`}
              </div>
            )}

            {showBenefForm && (
              <div className="border border-[#E60000]/20 rounded-2xl p-5 mb-5 bg-slate-50 space-y-4">
                <div className="flex gap-2">
                  <button onClick={() => setBenefForm(p => ({ ...p, type: 'personne' }))} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${benefForm.type === 'personne' ? 'bg-[#111111] text-white' : 'border border-slate-200 text-slate-600 hover:bg-white'}`}>Personne physique</button>
                  <button onClick={() => setBenefForm(p => ({ ...p, type: 'entite' }))} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${benefForm.type === 'entite' ? 'bg-[#111111] text-white' : 'border border-slate-200 text-slate-600 hover:bg-white'}`}>Entité</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {benefForm.type === 'personne' ? (
                    <>
                      <FieldWrapper label="Civilité">
                        <Select value={benefForm.civilite} onValueChange={v => setBenefForm(p => ({ ...p, civilite: v }))}>
                          <SelectTrigger className={inputClass}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                          <SelectContent><SelectItem value="Monsieur">Monsieur</SelectItem><SelectItem value="Madame">Madame</SelectItem></SelectContent>
                        </Select>
                      </FieldWrapper>
                      <FieldWrapper label="Nom"><input className={inputClass} value={benefForm.nom} onChange={e => setBenefForm(p => ({ ...p, nom: e.target.value }))} /></FieldWrapper>
                      <FieldWrapper label="Prénom"><input className={inputClass} value={benefForm.prenom} onChange={e => setBenefForm(p => ({ ...p, prenom: e.target.value }))} /></FieldWrapper>
                      <FieldWrapper label="Date de naissance"><input className={inputClass} type="date" value={benefForm.date_naissance} onChange={e => setBenefForm(p => ({ ...p, date_naissance: e.target.value }))} /></FieldWrapper>
                      <FieldWrapper label="Lien de parenté"><input className={inputClass} value={benefForm.lien_parente} onChange={e => setBenefForm(p => ({ ...p, lien_parente: e.target.value }))} placeholder="Conjoint, enfant..." /></FieldWrapper>
                      <FieldWrapper label="Téléphone"><input className={inputClass} value={benefForm.telephone} onChange={e => setBenefForm(p => ({ ...p, telephone: e.target.value }))} /></FieldWrapper>
                      <FieldWrapper label="Email"><input className={inputClass} type="email" value={benefForm.email} onChange={e => setBenefForm(p => ({ ...p, email: e.target.value }))} /></FieldWrapper>
                    </>
                  ) : (
                    <>
                      <FieldWrapper label="Raison sociale"><input className={inputClass} value={benefForm.raison_sociale} onChange={e => setBenefForm(p => ({ ...p, raison_sociale: e.target.value, nom: e.target.value }))} /></FieldWrapper>
                      <FieldWrapper label="SIRET"><input className={inputClass} value={benefForm.siret} onChange={e => setBenefForm(p => ({ ...p, siret: e.target.value }))} /></FieldWrapper>
                      <FieldWrapper label="Email"><input className={inputClass} type="email" value={benefForm.email} onChange={e => setBenefForm(p => ({ ...p, email: e.target.value }))} /></FieldWrapper>
                      <FieldWrapper label="Téléphone"><input className={inputClass} value={benefForm.telephone} onChange={e => setBenefForm(p => ({ ...p, telephone: e.target.value }))} /></FieldWrapper>
                    </>
                  )}
                  <FieldWrapper label="Adresse"><input className={inputClass} value={benefForm.adresse} onChange={e => setBenefForm(p => ({ ...p, adresse: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Code postal"><input className={inputClass} value={benefForm.code_postal} onChange={e => setBenefForm(p => ({ ...p, code_postal: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Ville"><input className={inputClass} value={benefForm.ville} onChange={e => setBenefForm(p => ({ ...p, ville: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Pays"><input className={inputClass} value={benefForm.pays} onChange={e => setBenefForm(p => ({ ...p, pays: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Part (%)"><input className={inputClass} type="number" min={0} max={100} value={benefForm.part_pourcentage} onChange={e => setBenefForm(p => ({ ...p, part_pourcentage: Number(e.target.value) }))} /></FieldWrapper>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowBenefForm(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-all">Annuler</button>
                  <button
                    onClick={handleAddBenef}
                    disabled={savingBenef}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#cc0000] disabled:opacity-40 transition-all"
                  >
                    {savingBenef ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Enregistrer
                  </button>
                </div>
              </div>
            )}

            {beneficiaries.length === 0 && !showBenefForm && (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun bénéficiaire désigné</p>
              </div>
            )}
            <div className="space-y-3">
              {beneficiaries.map(b => (
                <div key={b.id} className="flex items-center justify-between border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#111111]/5 flex items-center justify-center">
                      {b.type === 'entite' ? <Building2 className="w-5 h-5 text-[#111111]" /> : <Users className="w-5 h-5 text-[#111111]" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {b.type === 'entite' ? b.raison_sociale : `${b.civilite || ''} ${b.prenom || ''} ${b.nom || ''}`.trim()}
                        <span className="ml-2 text-xs font-normal bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{b.type === 'entite' ? 'Entité' : 'Personne physique'}</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {b.lien_parente ? `${b.lien_parente} — ` : ''}Part : <strong className="text-[#111111]">{b.part_pourcentage}%</strong>
                      </p>
                      {b.email && <p className="text-xs text-slate-400">{b.email}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteBenef(b.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEGAL ENTITIES */}
        {activeTab === 'legal' && (
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-2">
              <SectionTitle>Personne morale</SectionTitle>
              <button
                onClick={() => setShowLegalForm(!showLegalForm)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-[#111111] hover:bg-slate-50 transition-all -mt-5"
              >
                <Plus className="w-4 h-4" />Ajouter
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Renseignez les informations de votre société ou structure juridique.
            </p>

            {showLegalForm && (
              <div className="border border-[#E60000]/20 rounded-2xl p-5 mb-5 bg-slate-50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldWrapper label="Raison sociale"><input className={inputClass} value={legalForm.raison_sociale} onChange={e => setLegalForm(p => ({ ...p, raison_sociale: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Forme juridique">
                    <Select value={legalForm.forme_juridique} onValueChange={v => setLegalForm(p => ({ ...p, forme_juridique: v }))}>
                      <SelectTrigger className={inputClass}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {['SAS', 'SARL', 'SA', 'SCI', 'EURL', 'Auto-entrepreneur', 'Association', 'Autre'].map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldWrapper>
                  <FieldWrapper label="SIRET"><input className={inputClass} value={legalForm.siret} onChange={e => setLegalForm(p => ({ ...p, siret: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="N° RCS"><input className={inputClass} value={legalForm.numero_rcs} onChange={e => setLegalForm(p => ({ ...p, numero_rcs: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper icon={MapPin} label="Adresse du siège"><input className={inputClass} value={legalForm.adresse_siege} onChange={e => setLegalForm(p => ({ ...p, adresse_siege: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Code postal"><input className={inputClass} value={legalForm.code_postal} onChange={e => setLegalForm(p => ({ ...p, code_postal: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Ville"><input className={inputClass} value={legalForm.ville} onChange={e => setLegalForm(p => ({ ...p, ville: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Pays"><input className={inputClass} value={legalForm.pays} onChange={e => setLegalForm(p => ({ ...p, pays: e.target.value }))} /></FieldWrapper>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest border-t border-slate-200 pt-4 mb-3">Représentant légal</p>
                  </div>
                  <FieldWrapper label="Nom"><input className={inputClass} value={legalForm.representant_nom} onChange={e => setLegalForm(p => ({ ...p, representant_nom: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Prénom"><input className={inputClass} value={legalForm.representant_prenom} onChange={e => setLegalForm(p => ({ ...p, representant_prenom: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper label="Fonction"><input className={inputClass} value={legalForm.representant_fonction} onChange={e => setLegalForm(p => ({ ...p, representant_fonction: e.target.value }))} placeholder="Gérant, Président..." /></FieldWrapper>
                  <FieldWrapper icon={Phone} label="Téléphone"><input className={inputClass} value={legalForm.telephone} onChange={e => setLegalForm(p => ({ ...p, telephone: e.target.value }))} /></FieldWrapper>
                  <FieldWrapper icon={Mail} label="Email"><input className={inputClass} type="email" value={legalForm.email} onChange={e => setLegalForm(p => ({ ...p, email: e.target.value }))} /></FieldWrapper>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowLegalForm(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-all">Annuler</button>
                  <button
                    onClick={handleAddLegal}
                    disabled={savingLegal}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#cc0000] disabled:opacity-40 transition-all"
                  >
                    {savingLegal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Enregistrer
                  </button>
                </div>
              </div>
            )}

            {legalEntities.length === 0 && !showLegalForm && (
              <div className="text-center py-12 text-slate-400">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{lang === 'en' ? 'No legal entity registered' : 'Aucune personne morale enregistrée'}</p>
              </div>
            )}
            <div className="space-y-3">
              {legalEntities.map(le => (
                <div key={le.id} className="flex items-center justify-between border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#111111]/5 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-[#111111]" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {le.raison_sociale}
                        <span className="ml-2 text-xs font-normal bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{le.forme_juridique}</span>
                      </p>
                      <p className="text-sm text-slate-500">SIRET : {le.siret || 'N/A'} — RCS : {le.numero_rcs || 'N/A'}</p>
                      <p className="text-xs text-slate-400">Représentant : {le.representant_prenom} {le.representant_nom} ({le.representant_fonction})</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteLegal(le.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ClientProfile;
