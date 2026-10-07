// Tipos do schema Supabase (exportados do projeto Lovable) + event_finish (migration 20261007000000) adicionado à mão.
// Regerar com `supabase gen types typescript` depois de aplicar as migrations.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          accuracy_m: number | null
          address: string | null
          company_id: string
          distance_m: number | null
          id: string
          inside_radius: boolean | null
          kind: string
          latitude: number | null
          longitude: number | null
          participant_id: string
          photo_path: string | null
          recorded_at: string
        }
        Insert: {
          accuracy_m?: number | null
          address?: string | null
          company_id: string
          distance_m?: number | null
          id?: string
          inside_radius?: boolean | null
          kind: string
          latitude?: number | null
          longitude?: number | null
          participant_id: string
          photo_path?: string | null
          recorded_at?: string
        }
        Update: {
          accuracy_m?: number | null
          address?: string | null
          company_id?: string
          distance_m?: number | null
          id?: string
          inside_radius?: boolean | null
          kind?: string
          latitude?: number | null
          longitude?: number | null
          participant_id?: string
          photo_path?: string | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_participant_id_company_id_fkey"
            columns: ["participant_id", "company_id"]
            isOneToOne: false
            referencedRelation: "event_participants"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          group_id: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string
          account_type: string
          active: boolean
          agency: string
          bank_code: string | null
          bank_name: string
          company_id: string
          created_at: string
          created_by: string | null
          holder_document: string
          holder_mismatch: boolean
          holder_name: string
          id: string
          mismatch_accepted_at: string | null
          mismatch_accepted_by: string | null
          mismatch_justification: string | null
          pix_key: string | null
        }
        Insert: {
          account_number: string
          account_type?: string
          active?: boolean
          agency: string
          bank_code?: string | null
          bank_name: string
          company_id: string
          created_at?: string
          created_by?: string | null
          holder_document: string
          holder_mismatch?: boolean
          holder_name: string
          id?: string
          mismatch_accepted_at?: string | null
          mismatch_accepted_by?: string | null
          mismatch_justification?: string | null
          pix_key?: string | null
        }
        Update: {
          account_number?: string
          account_type?: string
          active?: boolean
          agency?: string
          bank_code?: string | null
          bank_name?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          holder_document?: string
          holder_mismatch?: boolean
          holder_name?: string
          id?: string
          mismatch_accepted_at?: string | null
          mismatch_accepted_by?: string | null
          mismatch_justification?: string | null
          pix_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_groups: {
        Row: {
          active: boolean
          created_at: string
          domains: string[]
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          domains?: string[]
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          domains?: string[]
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean
          block_bank_holder_mismatch: boolean
          cnpj: string | null
          color: string | null
          created_at: string
          group_id: string
          id: string
          legal_name: string | null
          name: string
        }
        Insert: {
          active?: boolean
          block_bank_holder_mismatch?: boolean
          cnpj?: string | null
          color?: string | null
          created_at?: string
          group_id: string
          id?: string
          legal_name?: string | null
          name: string
        }
        Update: {
          active?: boolean
          block_bank_holder_mismatch?: boolean
          cnpj?: string | null
          color?: string | null
          created_at?: string
          group_id?: string
          id?: string
          legal_name?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      company_user_permissions: {
        Row: {
          company_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          company_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          company_id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_user_permissions_company_id_user_id_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "company_users"
            referencedColumns: ["company_id", "user_id"]
          },
        ]
      }
      company_users: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          addition: number
          company_id: string
          created_at: string
          days: number
          discount: number
          event_id: string
          final_amount: number | null
          id: string
          person_id: string
          rate: number
          status: string
          team_id: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          worked: boolean | null
        }
        Insert: {
          addition?: number
          company_id: string
          created_at?: string
          days?: number
          discount?: number
          event_id: string
          final_amount?: number | null
          id?: string
          person_id: string
          rate?: number
          status?: string
          team_id: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          worked?: boolean | null
        }
        Update: {
          addition?: number
          company_id?: string
          created_at?: string
          days?: number
          discount?: number
          event_id?: string
          final_amount?: number | null
          id?: string
          person_id?: string
          rate?: number
          status?: string
          team_id?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          worked?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_company_id_fkey"
            columns: ["event_id", "company_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "event_participants_person_id_company_id_fkey"
            columns: ["person_id", "company_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "event_participants_team_id_company_id_fkey"
            columns: ["team_id", "company_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      event_teams: {
        Row: {
          company_id: string
          coordinator_name: string | null
          created_at: string
          end_time: string | null
          event_id: string
          id: string
          invite_token: string
          name: string
          quantity: number
          rate: number
          registrations_open: boolean
          start_time: string | null
        }
        Insert: {
          company_id: string
          coordinator_name?: string | null
          created_at?: string
          end_time?: string | null
          event_id: string
          id?: string
          invite_token?: string
          name: string
          quantity: number
          rate?: number
          registrations_open?: boolean
          start_time?: string | null
        }
        Update: {
          company_id?: string
          coordinator_name?: string | null
          created_at?: string
          end_time?: string | null
          event_id?: string
          id?: string
          invite_token?: string
          name?: string
          quantity?: number
          rate?: number
          registrations_open?: boolean
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_teams_event_id_company_id_fkey"
            columns: ["event_id", "company_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          checkin_token: string
          checkout_token: string
          client_name: string | null
          closed_at: string | null
          closed_by: string | null
          code: string
          company_id: string
          cost_center: string | null
          created_at: string
          created_by: string | null
          end_time: string | null
          event_date: string
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          manager_name: string | null
          name: string
          notes: string | null
          radius_m: number
          show_rate: boolean
          start_time: string | null
          status: string
        }
        Insert: {
          address?: string | null
          checkin_token?: string
          checkout_token?: string
          client_name?: string | null
          closed_at?: string | null
          closed_by?: string | null
          code: string
          company_id: string
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date: string
          id: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          manager_name?: string | null
          name: string
          notes?: string | null
          radius_m?: number
          show_rate?: boolean
          start_time?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          checkin_token?: string
          checkout_token?: string
          client_name?: string | null
          closed_at?: string | null
          closed_by?: string | null
          code?: string
          company_id?: string
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          manager_name?: string | null
          name?: string
          notes?: string | null
          radius_m?: number
          show_rate?: boolean
          start_time?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_id_company_id_fkey"
            columns: ["id", "company_id"]
            isOneToOne: true
            referencedRelation: "operations"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      fixed_post_members: {
        Row: {
          company_id: string
          created_at: string
          end_date: string | null
          fixed_post_id: string
          id: string
          monthly_rate: number
          person_id: string
          role: string | null
          start_date: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date?: string | null
          fixed_post_id: string
          id?: string
          monthly_rate: number
          person_id: string
          role?: string | null
          start_date?: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string | null
          fixed_post_id?: string
          id?: string
          monthly_rate?: number
          person_id?: string
          role?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_post_members_fixed_post_id_company_id_fkey"
            columns: ["fixed_post_id", "company_id"]
            isOneToOne: false
            referencedRelation: "fixed_posts"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "fixed_post_members_person_id_company_id_fkey"
            columns: ["person_id", "company_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      fixed_post_period_items: {
        Row: {
          absences: number
          addition: number
          base_amount: number
          company_id: string
          discount: number
          final_amount: number | null
          id: string
          member_id: string
          notes: string | null
          period_id: string
          person_id: string
        }
        Insert: {
          absences?: number
          addition?: number
          base_amount?: number
          company_id: string
          discount?: number
          final_amount?: number | null
          id?: string
          member_id: string
          notes?: string | null
          period_id: string
          person_id: string
        }
        Update: {
          absences?: number
          addition?: number
          base_amount?: number
          company_id?: string
          discount?: number
          final_amount?: number | null
          id?: string
          member_id?: string
          notes?: string | null
          period_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_post_period_items_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "fixed_post_members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "fixed_post_period_items_period_id_company_id_fkey"
            columns: ["period_id", "company_id"]
            isOneToOne: false
            referencedRelation: "fixed_post_periods"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "fixed_post_period_items_person_id_company_id_fkey"
            columns: ["person_id", "company_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      fixed_post_periods: {
        Row: {
          company_id: string
          competence: string
          created_at: string
          fixed_post_id: string
          id: string
          sent_at: string | null
          status: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          company_id: string
          competence: string
          created_at?: string
          fixed_post_id: string
          id?: string
          sent_at?: string | null
          status?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          company_id?: string
          competence?: string
          created_at?: string
          fixed_post_id?: string
          id?: string
          sent_at?: string | null
          status?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_post_periods_fixed_post_id_company_id_fkey"
            columns: ["fixed_post_id", "company_id"]
            isOneToOne: false
            referencedRelation: "fixed_posts"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      fixed_posts: {
        Row: {
          category: string | null
          client_name: string | null
          code: string
          company_id: string
          cost_center: string | null
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          manager_name: string | null
          name: string
          planned_headcount: number
          status: string
        }
        Insert: {
          category?: string | null
          client_name?: string | null
          code: string
          company_id: string
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          id: string
          location?: string | null
          manager_name?: string | null
          name: string
          planned_headcount?: number
          status?: string
        }
        Update: {
          category?: string | null
          client_name?: string | null
          code?: string
          company_id?: string
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          manager_name?: string | null
          name?: string
          planned_headcount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_posts_id_company_id_fkey"
            columns: ["id", "company_id"]
            isOneToOne: true
            referencedRelation: "operations"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          created_at: string
          group_id: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          type: Database["public"]["Enums"]["operation_type"]
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          type: Database["public"]["Enums"]["operation_type"]
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          type?: Database["public"]["Enums"]["operation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          amount: number
          bank_account_id: string | null
          company_id: string
          competence: string | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          event_participant_id: string | null
          id: string
          op_code: string | null
          op_name: string | null
          operation_id: string | null
          origin: string
          paid_at: string | null
          payee_document: string | null
          payee_name: string | null
          period_item_id: string | null
          person_id: string | null
          pix_key: string | null
          pix_type: string | null
          ref_date: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["payable_status"]
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          company_id: string
          competence?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          event_participant_id?: string | null
          id?: string
          op_code?: string | null
          op_name?: string | null
          operation_id?: string | null
          origin?: string
          paid_at?: string | null
          payee_document?: string | null
          payee_name?: string | null
          period_item_id?: string | null
          person_id?: string | null
          pix_key?: string | null
          pix_type?: string | null
          ref_date?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          company_id?: string
          competence?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          event_participant_id?: string | null
          id?: string
          op_code?: string | null
          op_name?: string | null
          operation_id?: string | null
          origin?: string
          paid_at?: string | null
          payee_document?: string | null
          payee_name?: string | null
          period_item_id?: string | null
          person_id?: string | null
          pix_key?: string | null
          pix_type?: string | null
          ref_date?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payables_bank_account_id_company_id_fkey"
            columns: ["bank_account_id", "company_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_operation_id_company_id_fkey"
            columns: ["operation_id", "company_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "payables_participant_fk"
            columns: ["event_participant_id", "company_id"]
            isOneToOne: false
            referencedRelation: "event_participants"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "payables_period_item_fk"
            columns: ["period_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "fixed_post_period_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "payables_person_fk"
            columns: ["person_id", "company_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      people: {
        Row: {
          company_id: string
          cpf: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          main_role: string | null
          phone: string | null
          pix_key: string | null
          pix_type: string | null
          pix_updated_publicly_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          cpf: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          main_role?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_type?: string | null
          pix_updated_publicly_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          cpf?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          main_role?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_type?: string | null
          pix_updated_publicly_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_company_user: {
        Args: {
          _company_id: string
          _email: string
          _permissions: Database["public"]["Enums"]["app_permission"][]
        }
        Returns: string
      }
      can_manage_company_users: {
        Args: { _company_id: string }
        Returns: boolean
      }
      can_view_consolidated: { Args: { _group_id: string }; Returns: boolean }
      event_send_to_finance: { Args: { _event_id: string }; Returns: number }
      event_finish: { Args: { _event_id: string }; Returns: undefined }
      event_create: { Args: { _company_id: string; _event: Json; _teams: Json }; Returns: string }
      fixed_post_open_period: {
        Args: { _competence: string; _fixed_post_id: string }
        Returns: string
      }
      fixed_post_send_period: { Args: { _period_id: string }; Returns: number }
      has_company_access: { Args: { _company_id: string }; Returns: boolean }
      has_company_permission: {
        Args: {
          _company_id: string
          _perm: Database["public"]["Enums"]["app_permission"]
        }
        Returns: boolean
      }
      has_group_access: { Args: { _group_id: string }; Returns: boolean }
      is_group_admin: { Args: { _group_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      my_company_context: {
        Args: { _group_id: string }
        Returns: {
          color: string
          company_id: string
          name: string
          permissions: Database["public"]["Enums"]["app_permission"][]
        }[]
      }
      my_tenants: {
        Args: never
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      presence_photo_company: { Args: { _token: string }; Returns: string }
      public_invite_info: { Args: { _token: string }; Returns: Json }
      public_invite_lookup: {
        Args: { _cpf: string; _token: string }
        Returns: Json
      }
      public_invite_register: {
        Args: { _data: Json; _token: string }
        Returns: Json
      }
      public_presence_info: { Args: { _token: string }; Returns: Json }
      public_presence_lookup: {
        Args: { _cpf: string; _token: string }
        Returns: Json
      }
      record_presence: {
        Args: {
          _accuracy: number
          _address: string
          _cpf: string
          _lat: number
          _lng: number
          _photo_path: string
          _token: string
        }
        Returns: Json
      }
      resolve_tenant: {
        Args: { _host: string; _slug?: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      shares_scope_with: { Args: { _user: string }; Returns: boolean }
    }
    Enums: {
      app_permission:
        | "empresa.admin"
        | "usuarios.gerenciar"
        | "bancos.ver"
        | "bancos.gerenciar"
        | "bancos.aceitar_divergencia"
        | "financeiro.ver"
        | "financeiro.gerenciar"
        | "operacao.ver"
        | "operacao.gerenciar"
        | "consolidado.ver"
        | "auditoria.ver"
      group_role: "owner" | "admin"
      operation_type: "EVENTO" | "PONTO_FIXO"
      payable_status:
        | "pendente_validacao"
        | "a_pagar"
        | "aprovado"
        | "agendado"
        | "pago"
        | "cancelado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_permission: [
        "empresa.admin",
        "usuarios.gerenciar",
        "bancos.ver",
        "bancos.gerenciar",
        "bancos.aceitar_divergencia",
        "financeiro.ver",
        "financeiro.gerenciar",
        "operacao.ver",
        "operacao.gerenciar",
        "consolidado.ver",
        "auditoria.ver",
      ],
      group_role: ["owner", "admin"],
      operation_type: ["EVENTO", "PONTO_FIXO"],
      payable_status: [
        "pendente_validacao",
        "a_pagar",
        "aprovado",
        "agendado",
        "pago",
        "cancelado",
      ],
    },
  },
} as const
