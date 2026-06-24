export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          id: string
          libelle: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          libelle: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          libelle?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_accounts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_online: boolean
          last_login_at: string | null
          lead_id: string
          stored_password: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_online?: boolean
          last_login_at?: string | null
          lead_id: string
          stored_password?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_online?: boolean
          last_login_at?: string | null
          lead_id?: string
          stored_password?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accounts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_bank_accounts: {
        Row: {
          bic: string
          created_at: string
          iban: string
          id: string
          is_default: boolean
          lead_id: string
          nom_banque: string
          titulaire: string
          updated_at: string
        }
        Insert: {
          bic?: string
          created_at?: string
          iban?: string
          id?: string
          is_default?: boolean
          lead_id: string
          nom_banque?: string
          titulaire?: string
          updated_at?: string
        }
        Update: {
          bic?: string
          created_at?: string
          iban?: string
          id?: string
          is_default?: boolean
          lead_id?: string
          nom_banque?: string
          titulaire?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_beneficiaries: {
        Row: {
          adresse: string | null
          civilite: string | null
          code_postal: string | null
          created_at: string
          date_naissance: string | null
          email: string | null
          id: string
          lead_id: string
          lien_parente: string | null
          nom: string
          part_pourcentage: number
          pays: string | null
          prenom: string | null
          raison_sociale: string | null
          siret: string | null
          telephone: string | null
          type: string
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          civilite?: string | null
          code_postal?: string | null
          created_at?: string
          date_naissance?: string | null
          email?: string | null
          id?: string
          lead_id: string
          lien_parente?: string | null
          nom?: string
          part_pourcentage?: number
          pays?: string | null
          prenom?: string | null
          raison_sociale?: string | null
          siret?: string | null
          telephone?: string | null
          type?: string
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          civilite?: string | null
          code_postal?: string | null
          created_at?: string
          date_naissance?: string | null
          email?: string | null
          id?: string
          lead_id?: string
          lien_parente?: string | null
          nom?: string
          part_pourcentage?: number
          pays?: string | null
          prenom?: string | null
          raison_sociale?: string | null
          siret?: string | null
          telephone?: string | null
          type?: string
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      client_connection_logs: {
        Row: {
          action: string
          client_account_id: string
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action?: string
          client_account_id: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          client_account_id?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_connection_logs_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contracts: {
        Row: {
          amount: number
          co_adresse: string | null
          co_civilite: string | null
          co_code_postal: string | null
          co_email: string | null
          co_nationalite: string | null
          co_nom: string | null
          co_prenom: string | null
          co_telephone: string | null
          co_ville: string | null
          contract_pdf_url: string | null
          created_at: string
          duration_months: number
          id: string
          interest_rate: number
          is_joint_account: boolean
          lead_id: string
          product_id: string
          reference: string | null
          signature_data: string | null
          signed_at: string
          signer_ip: string | null
          subscription_id: string
        }
        Insert: {
          amount: number
          co_adresse?: string | null
          co_civilite?: string | null
          co_code_postal?: string | null
          co_email?: string | null
          co_nationalite?: string | null
          co_nom?: string | null
          co_prenom?: string | null
          co_telephone?: string | null
          co_ville?: string | null
          contract_pdf_url?: string | null
          created_at?: string
          duration_months: number
          id?: string
          interest_rate: number
          is_joint_account?: boolean
          lead_id: string
          product_id: string
          reference?: string | null
          signature_data?: string | null
          signed_at?: string
          signer_ip?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number
          co_adresse?: string | null
          co_civilite?: string | null
          co_code_postal?: string | null
          co_email?: string | null
          co_nationalite?: string | null
          co_nom?: string | null
          co_prenom?: string | null
          co_telephone?: string | null
          co_ville?: string | null
          contract_pdf_url?: string | null
          created_at?: string
          duration_months?: number
          id?: string
          interest_rate?: number
          is_joint_account?: boolean
          lead_id?: string
          product_id?: string
          reference?: string | null
          signature_data?: string | null
          signed_at?: string
          signer_ip?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "client_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_events: {
        Row: {
          client_account_id: string | null
          created_at: string
          event_name: string
          id: string
          lead_id: string
          page: string | null
          properties: Json
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          client_account_id?: string | null
          created_at?: string
          event_name: string
          id?: string
          lead_id: string
          page?: string | null
          properties?: Json
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          client_account_id?: string | null
          created_at?: string
          event_name?: string
          id?: string
          lead_id?: string
          page?: string | null
          properties?: Json
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      client_legal_entities: {
        Row: {
          adresse_siege: string | null
          code_postal: string | null
          created_at: string
          email: string | null
          forme_juridique: string | null
          id: string
          lead_id: string
          numero_rcs: string | null
          pays: string | null
          raison_sociale: string
          representant_fonction: string | null
          representant_nom: string | null
          representant_prenom: string | null
          siret: string | null
          telephone: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse_siege?: string | null
          code_postal?: string | null
          created_at?: string
          email?: string | null
          forme_juridique?: string | null
          id?: string
          lead_id: string
          numero_rcs?: string | null
          pays?: string | null
          raison_sociale?: string
          representant_fonction?: string | null
          representant_nom?: string | null
          representant_prenom?: string | null
          siret?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse_siege?: string | null
          code_postal?: string | null
          created_at?: string
          email?: string | null
          forme_juridique?: string | null
          id?: string
          lead_id?: string
          numero_rcs?: string | null
          pays?: string | null
          raison_sociale?: string
          representant_fonction?: string | null
          representant_nom?: string | null
          representant_prenom?: string | null
          siret?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      client_portal_settings: {
        Row: {
          accent_color: string
          background_color: string
          company_address: string
          company_city: string
          company_country: string
          company_email: string
          company_name: string
          company_phone: string
          company_postal_code: string
          company_signature_url: string | null
          company_siret: string
          company_stamp_url: string | null
          contract_logo_url: string | null
          created_at: string
          id: string
          is_active: boolean
          is_standard: boolean
          logo_url: string | null
          menu_config: Json
          name: string
          portal_title: string
          primary_color: string
          secondary_color: string
          sidebar_color: string
          text_color: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string
          background_color?: string
          company_address?: string
          company_city?: string
          company_country?: string
          company_email?: string
          company_name?: string
          company_phone?: string
          company_postal_code?: string
          company_signature_url?: string | null
          company_siret?: string
          company_stamp_url?: string | null
          contract_logo_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_standard?: boolean
          logo_url?: string | null
          menu_config?: Json
          name?: string
          portal_title?: string
          primary_color?: string
          secondary_color?: string
          sidebar_color?: string
          text_color?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string
          background_color?: string
          company_address?: string
          company_city?: string
          company_country?: string
          company_email?: string
          company_name?: string
          company_phone?: string
          company_postal_code?: string
          company_signature_url?: string | null
          company_siret?: string
          company_stamp_url?: string | null
          contract_logo_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_standard?: boolean
          logo_url?: string | null
          menu_config?: Json
          name?: string
          portal_title?: string
          primary_color?: string
          secondary_color?: string
          sidebar_color?: string
          text_color?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      client_subscriptions: {
        Row: {
          activated_at: string | null
          amount: number
          client_account_id: string
          closed_at: string | null
          created_at: string
          id: string
          lead_id: string
          product_id: string
          signed_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          amount: number
          client_account_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_id: string
          product_id: string
          signed_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          amount?: number
          client_account_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          product_id?: string
          signed_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_transactions: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          description: string | null
          id: string
          lead_id: string
          status: Database["public"]["Enums"]["transaction_status"]
          subscription_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          status?: Database["public"]["Enums"]["transaction_status"]
          subscription_id: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          subscription_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "client_transactions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_transactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "client_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string
          file_url: string | null
          id: string
          nom: string
          statut: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          file_url?: string | null
          id?: string
          nom: string
          statut?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          file_url?: string | null
          id?: string
          nom?: string
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string
          profile_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string
          profile_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_group: boolean
          name: string | null
          team_leader_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_group?: boolean
          name?: string | null
          team_leader_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_group?: boolean
          name?: string | null
          team_leader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_title_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nom: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          nom: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_title_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          nom: string
          type: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          nom: string
          type?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          nom?: string
          type?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_auto_stats: boolean
          stats_data: Json | null
        }
        Insert: {
          author_id: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_auto_stats?: boolean
          stats_data?: Json | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_auto_stats?: boolean
          stats_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reactions: {
        Row: {
          author_id: string
          created_at: string
          emoji: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          emoji?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reactions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      historique: {
        Row: {
          ancien_statut_id: string | null
          commentaire: string | null
          created_at: string | null
          id: string
          lead_id: string
          nouveau_statut_id: string | null
          rdv_date: string | null
          type_action: string
          utilisateur_id: string
        }
        Insert: {
          ancien_statut_id?: string | null
          commentaire?: string | null
          created_at?: string | null
          id?: string
          lead_id: string
          nouveau_statut_id?: string | null
          rdv_date?: string | null
          type_action?: string
          utilisateur_id: string
        }
        Update: {
          ancien_statut_id?: string | null
          commentaire?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string
          nouveau_statut_id?: string | null
          rdv_date?: string | null
          type_action?: string
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historique_ancien_statut_id_fkey"
            columns: ["ancien_statut_id"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_nouveau_statut_id_fkey"
            columns: ["nouveau_statut_id"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          contenu: string
          created_at: string
          id: string
          lead_id: string
          utilisateur_id: string
        }
        Insert: {
          contenu: string
          created_at?: string
          id?: string
          lead_id: string
          utilisateur_id: string
        }
        Update: {
          contenu?: string
          created_at?: string
          id?: string
          lead_id?: string
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_products: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_products_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_shares: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          shared_by: string
          shared_with: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          shared_by: string
          shared_with: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          shared_by?: string
          shared_with?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_shares_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_shares_shared_with_fkey"
            columns: ["shared_with"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_statuses: {
        Row: {
          couleur_fond: string | null
          couleur_texte: string | null
          created_at: string | null
          icone: string | null
          id: string
          libelle: string
          ordre: number
          status_type: string
        }
        Insert: {
          couleur_fond?: string | null
          couleur_texte?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          libelle: string
          ordre?: number
          status_type?: string
        }
        Update: {
          couleur_fond?: string | null
          couleur_texte?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          libelle?: string
          ordre?: number
          status_type?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          adresse: string | null
          assigne_a: string | null
          campaign_id: string | null
          champ1: string | null
          champ10: string | null
          champ2: string | null
          champ3: string | null
          champ4: string | null
          champ5: string | null
          champ6: string | null
          champ7: string | null
          champ8: string | null
          champ9: string | null
          civilite: string | null
          code_postal: string | null
          created_at: string | null
          email: string | null
          id: string
          importe_par: string
          nationalite: string | null
          nom: string
          prenom: string
          statut_id: string
          telephone: string | null
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          assigne_a?: string | null
          campaign_id?: string | null
          champ1?: string | null
          champ10?: string | null
          champ2?: string | null
          champ3?: string | null
          champ4?: string | null
          champ5?: string | null
          champ6?: string | null
          champ7?: string | null
          champ8?: string | null
          champ9?: string | null
          civilite?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          importe_par: string
          nationalite?: string | null
          nom?: string
          prenom?: string
          statut_id: string
          telephone?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          assigne_a?: string | null
          campaign_id?: string | null
          champ1?: string | null
          champ10?: string | null
          champ2?: string | null
          champ3?: string | null
          champ4?: string | null
          champ5?: string | null
          champ6?: string | null
          champ7?: string | null
          champ8?: string | null
          champ9?: string | null
          civilite?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          importe_par?: string
          nationalite?: string | null
          nom?: string
          prenom?: string
          statut_id?: string
          telephone?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigne_a_fkey"
            columns: ["assigne_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_importe_par_fkey"
            columns: ["importe_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_statut_id_fkey"
            columns: ["statut_id"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_templates: {
        Row: {
          contenu: string | null
          created_at: string | null
          id: string
          nom: string
          sujet: string | null
        }
        Insert: {
          contenu?: string | null
          created_at?: string | null
          id?: string
          nom: string
          sujet?: string | null
        }
        Update: {
          contenu?: string | null
          created_at?: string | null
          id?: string
          nom?: string
          sujet?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          message: string
          profile_id: string
          rdv_id: string
          read: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          message: string
          profile_id: string
          rdv_id: string
          read?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          message?: string
          profile_id?: string
          rdv_id?: string
          read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_rdv_id_fkey"
            columns: ["rdv_id"]
            isOneToOne: false
            referencedRelation: "rdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_permissions: {
        Row: {
          can_create: boolean
          created_at: string
          granted_by: string
          id: string
          profile_id: string
          updated_at: string
          visibility_level: Database["public"]["Enums"]["product_visibility"]
        }
        Insert: {
          can_create?: boolean
          created_at?: string
          granted_by: string
          id?: string
          profile_id: string
          updated_at?: string
          visibility_level?: Database["public"]["Enums"]["product_visibility"]
        }
        Update: {
          can_create?: boolean
          created_at?: string
          granted_by?: string
          id?: string
          profile_id?: string
          updated_at?: string
          visibility_level?: Database["public"]["Enums"]["product_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "product_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          categorie: Database["public"]["Enums"]["product_category"]
          conditions_url: string | null
          contract_template: string
          created_at: string
          created_by: string
          description: string
          duree: string
          id: string
          image_url: string | null
          interets: string
          nom: string
          periode_disponibilite: string
          prix_maximum: number
          prix_minimum: number
          risque: string
          statut: Database["public"]["Enums"]["product_status"]
          team_leader_id: string | null
          updated_at: string
          visibilite: Database["public"]["Enums"]["product_visibility"]
        }
        Insert: {
          categorie: Database["public"]["Enums"]["product_category"]
          conditions_url?: string | null
          contract_template?: string
          created_at?: string
          created_by: string
          description?: string
          duree?: string
          id?: string
          image_url?: string | null
          interets?: string
          nom: string
          periode_disponibilite?: string
          prix_maximum?: number
          prix_minimum?: number
          risque?: string
          statut?: Database["public"]["Enums"]["product_status"]
          team_leader_id?: string | null
          updated_at?: string
          visibilite?: Database["public"]["Enums"]["product_visibility"]
        }
        Update: {
          categorie?: Database["public"]["Enums"]["product_category"]
          conditions_url?: string | null
          contract_template?: string
          created_at?: string
          created_by?: string
          description?: string
          duree?: string
          id?: string
          image_url?: string | null
          interets?: string
          nom?: string
          periode_disponibilite?: string
          prix_maximum?: number
          prix_minimum?: number
          risque?: string
          statut?: Database["public"]["Enums"]["product_status"]
          team_leader_id?: string | null
          updated_at?: string
          visibilite?: Database["public"]["Enums"]["product_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          actif: boolean | null
          avatar_url: string | null
          created_at: string | null
          email: string
          fonction: string | null
          id: string
          ip_autorisees: string[] | null
          login: string
          niveau_selle: string
          team_leader_id: string | null
          telephone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actif?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          fonction?: string | null
          id?: string
          ip_autorisees?: string[] | null
          login: string
          niveau_selle?: string
          team_leader_id?: string | null
          telephone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actif?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          fonction?: string | null
          id?: string
          ip_autorisees?: string[] | null
          login?: string
          niveau_selle?: string
          team_leader_id?: string | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rdvs: {
        Row: {
          commentaire: string | null
          created_at: string | null
          date_debut: string
          date_fin: string
          id: string
          lead_id: string
          titre: string | null
          utilisateur_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          date_debut: string
          date_fin: string
          id?: string
          lead_id: string
          titre?: string | null
          utilisateur_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          date_debut?: string
          date_fin?: string
          id?: string
          lead_id?: string
          titre?: string | null
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdvs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdvs_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_mails: {
        Row: {
          contenu: string | null
          created_at: string | null
          id: string
          lead_id: string
          sujet: string | null
          template_id: string | null
        }
        Insert: {
          contenu?: string | null
          created_at?: string | null
          id?: string
          lead_id: string
          sujet?: string | null
          template_id?: string | null
        }
        Update: {
          contenu?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string
          sujet?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sent_mails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_mails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mail_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_sms: {
        Row: {
          canal: string | null
          contenu: string | null
          created_at: string | null
          id: string
          lead_id: string
          template_id: string | null
        }
        Insert: {
          canal?: string | null
          contenu?: string | null
          created_at?: string | null
          id?: string
          lead_id: string
          template_id?: string | null
        }
        Update: {
          canal?: string | null
          contenu?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sent_sms_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_sms_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_settings: {
        Row: {
          api_key: string
          created_at: string
          id: string
          sender: string
          strategy: string
          updated_at: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          id?: string
          sender?: string
          strategy?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          sender?: string
          strategy?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          contenu: string | null
          created_at: string | null
          id: string
          nom: string
        }
        Insert: {
          contenu?: string | null
          created_at?: string | null
          id?: string
          nom: string
        }
        Update: {
          contenu?: string | null
          created_at?: string | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      smtp_settings: {
        Row: {
          created_at: string
          from_email: string
          from_name: string
          host: string
          id: string
          password: string
          port: number
          secure: boolean
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          password?: string
          port?: number
          secure?: boolean
          updated_at?: string
          username?: string
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          password?: string
          port?: number
          secure?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      trading_orders: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["trading_direction"]
          filled_at: string | null
          id: string
          lead_id: string
          leverage: number
          order_type: Database["public"]["Enums"]["trading_order_type"]
          portfolio_id: string
          quantity: number
          status: Database["public"]["Enums"]["trading_order_status"]
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          target_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["trading_direction"]
          filled_at?: string | null
          id?: string
          lead_id: string
          leverage?: number
          order_type?: Database["public"]["Enums"]["trading_order_type"]
          portfolio_id: string
          quantity: number
          status?: Database["public"]["Enums"]["trading_order_status"]
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          target_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["trading_direction"]
          filled_at?: string | null
          id?: string
          lead_id?: string
          leverage?: number
          order_type?: Database["public"]["Enums"]["trading_order_type"]
          portfolio_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["trading_order_status"]
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          target_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "trading_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_portfolios: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          initial_balance: number
          lead_id: string
          spreads_config: Json
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          initial_balance?: number
          lead_id: string
          spreads_config?: Json
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          initial_balance?: number
          lead_id?: string
          spreads_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_portfolios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_positions: {
        Row: {
          closed_at: string | null
          created_at: string
          direction: Database["public"]["Enums"]["trading_direction"]
          entry_price: number
          exit_price: number | null
          id: string
          lead_id: string
          leverage: number
          pnl: number | null
          portfolio_id: string
          quantity: number
          status: Database["public"]["Enums"]["trading_position_status"]
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["trading_direction"]
          entry_price: number
          exit_price?: number | null
          id?: string
          lead_id: string
          leverage?: number
          pnl?: number | null
          portfolio_id: string
          quantity: number
          status?: Database["public"]["Enums"]["trading_position_status"]
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["trading_direction"]
          entry_price?: number
          exit_price?: number | null
          id?: string
          lead_id?: string
          leverage?: number
          pnl?: number | null
          portfolio_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["trading_position_status"]
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_positions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_positions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "trading_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          id: string
          lead_id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          source: string
          source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          bank_account_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          source: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          source?: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_products: { Args: { _user_id: string }; Returns: boolean }
      can_see_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
      get_client_lead_id: { Args: { _user_id: string }; Returns: string }
      get_profile_id: { Args: { _user_id: string }; Returns: string }
      get_team_leader_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_account_owner: {
        Args: { _client_account_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _profile_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "responsable_regie" | "telepro" | "client"
      product_category: "livret" | "compte_a_theme" | "assurance_vie" | "crypto"
      product_status: "pending" | "approved" | "rejected"
      product_visibility: "personal" | "team"
      subscription_status:
        | "pending_signature"
        | "signed"
        | "pending_payment"
        | "active"
        | "closed"
      trading_direction: "long" | "short"
      trading_order_status: "pending" | "filled" | "cancelled"
      trading_order_type: "market" | "limit" | "stop"
      trading_position_status: "open" | "closed" | "cancelled"
      transaction_status: "pending" | "confirmed" | "rejected"
      transaction_type: "deposit" | "withdrawal" | "interest"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "responsable_regie", "telepro", "client"],
      product_category: ["livret", "compte_a_theme", "assurance_vie", "crypto"],
      product_status: ["pending", "approved", "rejected"],
      product_visibility: ["personal", "team"],
      subscription_status: [
        "pending_signature",
        "signed",
        "pending_payment",
        "active",
        "closed",
      ],
      trading_direction: ["long", "short"],
      trading_order_status: ["pending", "filled", "cancelled"],
      trading_order_type: ["market", "limit", "stop"],
      trading_position_status: ["open", "closed", "cancelled"],
      transaction_status: ["pending", "confirmed", "rejected"],
      transaction_type: ["deposit", "withdrawal", "interest"],
    },
  },
} as const
