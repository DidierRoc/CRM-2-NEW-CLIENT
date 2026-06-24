import { CrmUser, Lead, LeadStatus, Historique, Rdv, ModeleMail, ModeleSms } from '@/types/crm';

export const defaultStatuses: LeadStatus[] = [
  { id: 's1', libelle: 'Nouveau Lead', icone: 'Star', couleurFond: '#3B82F6', couleurTexte: '#FFFFFF', ordre: 1 },
  { id: 's2', libelle: 'Intéressé', icone: 'ThumbsUp', couleurFond: '#10B981', couleurTexte: '#FFFFFF', ordre: 2 },
  { id: 's3', libelle: 'NRP', icone: 'PhoneMissed', couleurFond: '#F59E0B', couleurTexte: '#FFFFFF', ordre: 3 },
  { id: 's4', libelle: 'Pas intéressé', icone: 'ThumbsDown', couleurFond: '#EF4444', couleurTexte: '#FFFFFF', ordre: 4 },
  { id: 's5', libelle: 'Devis envoyé', icone: 'FileText', couleurFond: '#8B5CF6', couleurTexte: '#FFFFFF', ordre: 5 },
  { id: 's6', libelle: 'Client', icone: 'UserCheck', couleurFond: '#059669', couleurTexte: '#FFFFFF', ordre: 6 },
];

export const defaultUsers: CrmUser[] = [
  { id: 'u1', login: 'admin', password: 'admin123', fonction: 'Directeur', telephone: '0600000001', email: 'admin@crm.fr', role: 'super_admin', actif: true, ipAutorisees: [] },
  { id: 'u2', login: 'resp.regie1', password: 'resp123', fonction: 'Responsable', telephone: '0600000002', email: 'resp@crm.fr', role: 'responsable_regie', actif: true, ipAutorisees: [] },
  { id: 'u3', login: 'telepro1', password: 'tele123', fonction: 'Commercial', telephone: '0600000003', email: 'telepro1@crm.fr', role: 'telepro', actif: true, ipAutorisees: [], equipeId: 'u2' },
  { id: 'u4', login: 'telepro2', password: 'tele123', fonction: 'Commercial', telephone: '0600000004', email: 'telepro2@crm.fr', role: 'telepro', actif: true, ipAutorisees: [], equipeId: 'u2' },
];

const firstNames = ['Jean', 'Marie', 'Pierre', 'Sophie', 'Lucas', 'Emma', 'Hugo', 'Léa', 'Thomas', 'Camille', 'Antoine', 'Julie', 'Nicolas', 'Clara', 'Maxime'];
const lastNames = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia'];

export const defaultLeads: Lead[] = Array.from({ length: 85 }, (_, i) => {
  const prenom = firstNames[i % firstNames.length];
  const nom = lastNames[i % lastNames.length];
  const statusIndex = i % 6;
  const assignee = i < 20 ? undefined : i % 2 === 0 ? 'u3' : 'u4';
  return {
    id: `l${i + 1}`,
    nom,
    prenom,
    telephone: `06${String(10000000 + i).slice(0, 8)}`,
    email: `${prenom.toLowerCase()}.${nom.toLowerCase()}${i}@email.com`,
    statut: `s${statusIndex + 1}`,
    assigneA: assignee,
    importePar: 'u2',
    dateCreation: new Date(2025, 0, 1 + i).toISOString(),
  };
});

export const defaultHistorique: Historique[] = [
  { id: 'h1', leadId: 'l1', ancienStatut: 's1', nouveauStatut: 's2', commentaire: 'Client très intéressé par notre offre', date: '2025-01-15T10:30:00Z', utilisateurId: 'u3' },
  { id: 'h2', leadId: 'l1', ancienStatut: 's2', nouveauStatut: 's5', commentaire: 'Devis envoyé par email', rdvDate: '2025-01-20T14:00:00Z', date: '2025-01-18T09:00:00Z', utilisateurId: 'u3' },
];

export const defaultRdvs: Rdv[] = [
  { id: 'r1', leadId: 'l1', utilisateurId: 'u3', dateDebut: '2025-02-24T09:00:00', dateFin: '2025-02-24T10:00:00', titre: 'RDV Jean Martin' },
  { id: 'r2', leadId: 'l3', utilisateurId: 'u3', dateDebut: '2025-02-24T14:00:00', dateFin: '2025-02-24T15:00:00', titre: 'RDV Pierre Dubois' },
  { id: 'r3', leadId: 'l5', utilisateurId: 'u4', dateDebut: '2025-02-25T10:00:00', dateFin: '2025-02-25T11:30:00', titre: 'RDV Lucas Robert' },
  { id: 'r4', leadId: 'l2', utilisateurId: 'u2', dateDebut: '2025-02-26T11:00:00', dateFin: '2025-02-26T12:00:00', titre: 'RDV Marie Bernard' },
];

export const defaultModelesMail: ModeleMail[] = [
  { id: 'mm1', nom: 'Bienvenue', sujet: 'Bienvenue chez nous !', contenu: 'Bonjour {prenom},\n\nNous sommes ravis de vous compter parmi nos contacts.\n\nCordialement' },
  { id: 'mm2', nom: 'Relance', sujet: 'Suite à notre échange', contenu: 'Bonjour {prenom},\n\nSuite à notre dernier échange, je me permets de revenir vers vous.\n\nCordialement' },
  { id: 'mm3', nom: 'Devis', sujet: 'Votre devis personnalisé', contenu: 'Bonjour {prenom},\n\nVeuillez trouver ci-joint votre devis.\n\nCordialement' },
];

export const defaultModelesSms: ModeleSms[] = [
  { id: 'ms1', nom: 'Rappel RDV', contenu: 'Bonjour {prenom}, rappel de votre RDV le {date}. À bientôt !' },
  { id: 'ms2', nom: 'Relance', contenu: 'Bonjour {prenom}, avez-vous pu consulter notre offre ? N\'hésitez pas à nous recontacter.' },
];
