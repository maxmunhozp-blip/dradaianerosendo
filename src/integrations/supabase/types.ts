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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      case_timeline: {
        Row: {
          case_id: string
          created_at: string
          description: string
          event_date: string
          file_urls: Json | null
          id: string
          pinned: boolean
          responsible: string | null
          source_email_id: string | null
          status: string
          title: string
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          description?: string
          event_date?: string
          file_urls?: Json | null
          id?: string
          pinned?: boolean
          responsible?: string | null
          source_email_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          description?: string
          event_date?: string
          file_urls?: Json | null
          id?: string
          pinned?: boolean
          responsible?: string | null
          source_email_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_timeline_source_email_id_fkey"
            columns: ["source_email_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_type: string
          client_id: string
          cnj_number: string | null
          court: string | null
          created_at: string
          description: string | null
          id: string
          status: string
        }
        Insert: {
          case_type: string
          client_id: string
          cnj_number?: string | null
          court?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
        }
        Update: {
          case_type?: string
          client_id?: string
          cnj_number?: string | null
          court?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          case_id: string
          created_at: string
          done: boolean
          id: string
          label: string
          required_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          done?: boolean
          id?: string
          label: string
          required_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          required_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          origin: string | null
          phone: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          case_id: string
          category: string
          created_at: string
          file_url: string | null
          id: string
          name: string
          notes: string | null
          status: string
          uploaded_by: string
        }
        Insert: {
          case_id: string
          category?: string
          created_at?: string
          file_url?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          uploaded_by?: string
        }
        Update: {
          case_id?: string
          category?: string
          created_at?: string
          file_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string | null
          created_at: string
          email: string
          gmail_message_id_cursor: string | null
          id: string
          imap_host: string | null
          imap_password: string | null
          imap_port: number | null
          imap_user: string | null
          label: string
          last_sync: string | null
          platform: string
          provider: string
          refresh_token: string | null
          smtp_host: string | null
          smtp_port: number | null
          status: string
          sync_attachments: boolean | null
          sync_attachments_pdf_only: boolean | null
          sync_configured: boolean | null
          sync_error_message: string | null
          sync_extra_senders: string | null
          sync_import_all: boolean | null
          sync_judicial_only: boolean | null
          sync_limit: number | null
          sync_period_days: number | null
          sync_subject_filters: Json | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email: string
          gmail_message_id_cursor?: string | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_user?: string | null
          label: string
          last_sync?: string | null
          platform?: string
          provider?: string
          refresh_token?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          status?: string
          sync_attachments?: boolean | null
          sync_attachments_pdf_only?: boolean | null
          sync_configured?: boolean | null
          sync_error_message?: string | null
          sync_extra_senders?: string | null
          sync_import_all?: boolean | null
          sync_judicial_only?: boolean | null
          sync_limit?: number | null
          sync_period_days?: number | null
          sync_subject_filters?: Json | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email?: string
          gmail_message_id_cursor?: string | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_user?: string | null
          label?: string
          last_sync?: string | null
          platform?: string
          provider?: string
          refresh_token?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          status?: string
          sync_attachments?: boolean | null
          sync_attachments_pdf_only?: boolean | null
          sync_configured?: boolean | null
          sync_error_message?: string | null
          sync_extra_senders?: string | null
          sync_import_all?: boolean | null
          sync_judicial_only?: boolean | null
          sync_limit?: number | null
          sync_period_days?: number | null
          sync_subject_filters?: Json | null
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          body_html: string | null
          body_text: string
          created_at: string
          email_account_id: string
          from_email: string | null
          from_name: string | null
          id: string
          intimacao_id: string | null
          is_judicial: boolean
          is_read: boolean
          message_uid: string
          received_at: string | null
          subject: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string
          created_at?: string
          email_account_id: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          intimacao_id?: string | null
          is_judicial?: boolean
          is_read?: boolean
          message_uid: string
          received_at?: string | null
          subject?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string
          created_at?: string
          email_account_id?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          intimacao_id?: string | null
          is_judicial?: boolean
          is_read?: boolean
          message_uid?: string
          received_at?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_intimacao_id_fkey"
            columns: ["intimacao_id"]
            isOneToOne: false
            referencedRelation: "intimacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      hearings: {
        Row: {
          alert_whatsapp: boolean
          case_id: string
          created_at: string
          date: string
          id: string
          location: string | null
          notes: string | null
          status: string
          title: string
        }
        Insert: {
          alert_whatsapp?: boolean
          case_id: string
          created_at?: string
          date: string
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          title: string
        }
        Update: {
          alert_whatsapp?: boolean
          case_id?: string
          created_at?: string
          date?: string
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hearings_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      intimacoes: {
        Row: {
          ai_summary: string | null
          case_id: string | null
          created_at: string
          deadline_date: string | null
          from_email: string | null
          gmail_message_id: string | null
          id: string
          movement_type: string | null
          notes: string | null
          process_number: string | null
          raw_email_body: string
          raw_email_date: string | null
          raw_email_subject: string
          status: string
          tribunal: string | null
          urgent_alert_sent: boolean
        }
        Insert: {
          ai_summary?: string | null
          case_id?: string | null
          created_at?: string
          deadline_date?: string | null
          from_email?: string | null
          gmail_message_id?: string | null
          id?: string
          movement_type?: string | null
          notes?: string | null
          process_number?: string | null
          raw_email_body?: string
          raw_email_date?: string | null
          raw_email_subject?: string
          status?: string
          tribunal?: string | null
          urgent_alert_sent?: boolean
        }
        Update: {
          ai_summary?: string | null
          case_id?: string | null
          created_at?: string
          deadline_date?: string | null
          from_email?: string | null
          gmail_message_id?: string | null
          id?: string
          movement_type?: string | null
          notes?: string | null
          process_number?: string | null
          raw_email_body?: string
          raw_email_date?: string | null
          raw_email_subject?: string
          status?: string
          tribunal?: string | null
          urgent_alert_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "intimacoes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          case_id: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          attachments?: Json | null
          case_id: string
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          attachments?: Json | null
          case_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_client_by_email: {
        Args: { _email: string; _user_id: string }
        Returns: undefined
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          last_sign_in_at: string
          role: string
          user_id: string
        }[]
      }
      remove_user_role: {
        Args: { _target_user_id: string }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "client"
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
      app_role: ["admin", "client"],
    },
  },
} as const
