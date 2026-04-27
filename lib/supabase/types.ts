export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string
          user_id: string
          tenant_id: string | null
          first_name: string
          last_name: string | null
          email: string[] | null
          phone: string[] | null
          company: string | null
          job_title: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string | null
          tags: string[] | null
          notes: string | null
          photo_url: string | null
          linkedin_url: string | null
          twitter_url: string | null
          website: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id?: string | null
          first_name: string
          last_name?: string | null
          email?: string[] | null
          phone?: string[] | null
          company?: string | null
          job_title?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          tags?: string[] | null
          notes?: string | null
          photo_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          website?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string | null
          first_name?: string
          last_name?: string | null
          email?: string[] | null
          phone?: string[] | null
          company?: string | null
          job_title?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          tags?: string[] | null
          notes?: string | null
          photo_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          website?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      pipelines: {
        Row: {
          id: string
          user_id: string
          tenant_id: string | null
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id?: string | null
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string | null
          name?: string
          description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pipelines_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      pipeline_stages: {
        Row: {
          id: string
          pipeline_id: string
          tenant_id: string | null
          name: string
          color: string
          position: number
          is_lost: boolean
          is_referral: boolean
          is_won: boolean
          count_by_company: boolean
          created_at: string
        }
        Insert: {
          id?: string
          pipeline_id: string
          tenant_id?: string | null
          name: string
          color?: string
          position: number
          is_lost?: boolean
          is_referral?: boolean
          is_won?: boolean
          count_by_company?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          pipeline_id?: string
          tenant_id?: string | null
          name?: string
          color?: string
          position?: number
          is_lost?: boolean
          is_referral?: boolean
          is_won?: boolean
          count_by_company?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'pipeline_stages_pipeline_id_fkey'
            columns: ['pipeline_id']
            isOneToOne: false
            referencedRelation: 'pipelines'
            referencedColumns: ['id']
          }
        ]
      }
      contact_pipeline: {
        Row: {
          id: string
          contact_id: string
          pipeline_id: string
          tenant_id: string | null
          stage_id: string | null
          value: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          pipeline_id: string
          tenant_id?: string | null
          stage_id?: string | null
          value?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          pipeline_id?: string
          tenant_id?: string | null
          stage_id?: string | null
          value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contact_pipeline_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contact_pipeline_pipeline_id_fkey'
            columns: ['pipeline_id']
            isOneToOne: false
            referencedRelation: 'pipelines'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contact_pipeline_stage_id_fkey'
            columns: ['stage_id']
            isOneToOne: false
            referencedRelation: 'pipeline_stages'
            referencedColumns: ['id']
          }
        ]
      }
      pipeline_history: {
        Row: {
          id: string
          contact_id: string
          pipeline_id: string
          tenant_id: string | null
          from_stage_id: string | null
          to_stage_id: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          pipeline_id: string
          tenant_id?: string | null
          from_stage_id?: string | null
          to_stage_id?: string | null
          changed_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          pipeline_id?: string
          tenant_id?: string | null
          from_stage_id?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pipeline_history_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pipeline_history_pipeline_id_fkey'
            columns: ['pipeline_id']
            isOneToOne: false
            referencedRelation: 'pipelines'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pipeline_history_from_stage_id_fkey'
            columns: ['from_stage_id']
            isOneToOne: false
            referencedRelation: 'pipeline_stages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pipeline_history_to_stage_id_fkey'
            columns: ['to_stage_id']
            isOneToOne: false
            referencedRelation: 'pipeline_stages'
            referencedColumns: ['id']
          }
        ]
      }
      ai_enrichments: {
        Row: {
          id: string
          contact_id: string
          tenant_id: string | null
          type: 'contact_profile' | 'company_news'
          content: string
          model: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          tenant_id?: string | null
          type: 'contact_profile' | 'company_news'
          content: string
          model?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          tenant_id?: string | null
          type?: 'contact_profile' | 'company_news'
          content?: string
          model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ai_enrichments_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          }
        ]
      }
      contact_files: {
        Row: {
          id: string
          contact_id: string
          tenant_id: string | null
          name: string
          file_name: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          description: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          tenant_id?: string | null
          name: string
          file_name: string
          file_path: string
          file_size?: number | null
          mime_type?: string | null
          description?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          tenant_id?: string | null
          name?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          mime_type?: string | null
          description?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'contact_files_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          }
        ]
      }
      tenant_users: {
        Row: {
          id: string
          user_id: string
          tenant_id: string | null
          role: 'manager' | 'member'
          invited_by: string | null
          carddav_password: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id?: string | null
          role: 'manager' | 'member'
          invited_by?: string | null
          carddav_password?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string | null
          role?: 'manager' | 'member'
          invited_by?: string | null
          carddav_password?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          timezone: string
          daily_digest_enabled: boolean
          ical_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          timezone?: string
          daily_digest_enabled?: boolean
          ical_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          timezone?: string
          daily_digest_enabled?: boolean
          ical_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      interactions: {
        Row: {
          id: string
          tenant_id: string
          contact_id: string
          type: 'note' | 'reminder'
          date: string
          content: string
          action_template: 'email_followup' | 'call' | 'linkedin_message' | 'propose_meeting' | 'send_document' | 'other' | null
          status: 'pending' | 'done' | null
          completed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          contact_id: string
          type: 'note' | 'reminder'
          date: string
          content: string
          action_template?: 'email_followup' | 'call' | 'linkedin_message' | 'propose_meeting' | 'send_document' | 'other' | null
          status?: 'pending' | 'done' | null
          completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          contact_id?: string
          type?: 'note' | 'reminder'
          date?: string
          content?: string
          action_template?: 'email_followup' | 'call' | 'linkedin_message' | 'propose_meeting' | 'send_document' | 'other' | null
          status?: 'pending' | 'done' | null
          completed_at?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'interactions_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'interactions_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'interactions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      digest_sent: {
        Row: {
          id: string
          user_id: string
          local_date: string
          sent_at: string
        }
        Insert: {
          id?: string
          user_id: string
          local_date: string
          sent_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          local_date?: string
          sent_at?: string
        }
        Relationships: []
      }
      notion_config: {
        Row: {
          id: string
          user_id: string
          database_id: string
          encrypted_token: string | null
          field_mapping: Json
          last_sync_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          database_id: string
          encrypted_token?: string | null
          field_mapping?: Json
          last_sync_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          database_id?: string
          encrypted_token?: string | null
          field_mapping?: Json
          last_sync_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notion_config_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      set_updated_at: {
        Args: Record<string, never>
        Returns: unknown
      }
      current_tenant_id: {
        Args: Record<string, never>
        Returns: string | null
      }
      set_config: {
        Args: { setting: string; value: string; is_local: boolean }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ---------------------------------------------------------------------------
// Helpers — raccourcis pour extraire les types depuis Database
// ---------------------------------------------------------------------------

type PublicTables = Database['public']['Tables']

export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type InsertDto<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type UpdateDto<T extends keyof PublicTables> = PublicTables[T]['Update']
