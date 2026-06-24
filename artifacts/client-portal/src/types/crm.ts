export type UserRole = 'super_admin' | 'responsable_regie' | 'telepro';

export interface CrmUser {
  id: string;
  login: string;
  password: string;
  fonction: string;
  telephone: string;
  email: string;
  role: UserRole;
  actif: boolean;
  ipAutorisees: string[];
  equipeId?: string; // ID du responsable régie pour les télépros
}

export interface LeadStatus {
  id: string;
  libelle: string;
  icone: string;
  couleurFond: string;
  couleurTexte: string;
  ordre: number;
}

export interface Lead {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  statut: string; // status ID
  assigneA?: string; // user ID
  importePar: string; // user ID
  dateCreation: string;
  champ1?: string;
  champ2?: string;
  champ3?: string;
  champ4?: string;
  champ5?: string;
  champ6?: string;
  champ7?: string;
  champ8?: string;
  champ9?: string;
  champ10?: string;
}

export interface Historique {
  id: string;
  leadId: string;
  ancienStatut: string;
  nouveauStatut: string;
  commentaire?: string;
  rdvDate?: string;
  date: string;
  utilisateurId: string;
}

export interface Rdv {
  id: string;
  leadId: string;
  utilisateurId: string;
  dateDebut: string;
  dateFin: string;
  titre: string;
}

export interface Document {
  id: string;
  leadId: string;
  nom: string;
  type: 'facture' | 'devis' | 'contrat' | 'autre';
  dateAjout: string;
  url: string;
}

export interface MailEnvoye {
  id: string;
  leadId: string;
  sujet: string;
  contenu: string;
  dateEnvoi: string;
  modeleId?: string;
}

export interface SmsEnvoye {
  id: string;
  leadId: string;
  contenu: string;
  dateEnvoi: string;
  canal: 'sms' | 'whatsapp';
  modeleId?: string;
}

export interface ModeleMail {
  id: string;
  nom: string;
  sujet: string;
  contenu: string;
}

export interface ModeleSms {
  id: string;
  nom: string;
  contenu: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  responsable_regie: 'Responsable Régie',
  telepro: 'TéléPro',
};
