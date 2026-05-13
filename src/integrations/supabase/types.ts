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
      answer_templates: {
        Row: {
          category: string
          created_at: string
          id: string
          intent: string
          pattern: string
          template: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          intent: string
          pattern: string
          template: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          intent?: string
          pattern?: string
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          category: string | null
          created_at: string | null
          feedback: string | null
          feedback_comment: string | null
          id: string
          query: string
          response: string | null
          retrieved_chunks: Json | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          feedback?: string | null
          feedback_comment?: string | null
          id?: string
          query: string
          response?: string | null
          retrieved_chunks?: Json | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          feedback?: string | null
          feedback_comment?: string | null
          id?: string
          query?: string
          response?: string | null
          retrieved_chunks?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          document_id: string
          embedding: string | null
          fts: unknown
          id: string
          section_title: string | null
        }
        Insert: {
          chunk_index: number
          content: string
          document_id: string
          embedding?: string | null
          fts?: unknown
          id?: string
          section_title?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          document_id?: string
          embedding?: string | null
          fts?: unknown
          id?: string
          section_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          content: string | null
          created_at: string | null
          file_type: string
          id: string
          is_latest: boolean
          name: string
          parent_document_id: string | null
          uploaded_by: string | null
          version: number
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string | null
          file_type: string
          id?: string
          is_latest?: boolean
          name: string
          parent_document_id?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string | null
          file_type?: string
          id?: string
          is_latest?: boolean
          name?: string
          parent_document_id?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error: string | null
          gmail_message_id: string | null
          id: string
          purpose: string
          status: string
          subject: string
          ticket_id: string | null
          to_email: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          gmail_message_id?: string | null
          id?: string
          purpose: string
          status: string
          subject: string
          ticket_id?: string | null
          to_email: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          gmail_message_id?: string | null
          id?: string
          purpose?: string
          status?: string
          subject?: string
          ticket_id?: string | null
          to_email?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          category: string | null
          citations: Json | null
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          category?: string | null
          citations?: Json | null
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          category?: string | null
          citations?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_qa: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          qa_type: string
          rating: number | null
          reviewer_email: string | null
          reviewer_id: string
          ticket_id: string
          verdict: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          qa_type: string
          rating?: number | null
          reviewer_email?: string | null
          reviewer_id: string
          ticket_id: string
          verdict?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          qa_type?: string
          rating?: number | null
          reviewer_email?: string | null
          reviewer_id?: string
          ticket_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_qa_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["ticket_status"] | null
          id: string
          note: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["ticket_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          note?: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["ticket_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          note?: string | null
          ticket_id?: string
          to_status?: Database["public"]["Enums"]["ticket_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          assigned_to_email: string | null
          audit_log_id: string | null
          category: string
          closed_at: string | null
          context: string | null
          conversation_id: string | null
          created_at: string
          guest_name: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          query: string
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          updated_at: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          assigned_to_email?: string | null
          audit_log_id?: string | null
          category?: string
          closed_at?: string | null
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          guest_name?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          query: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          assigned_to_email?: string | null
          audit_log_id?: string | null
          category?: string
          closed_at?: string | null
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          guest_name?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          query?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      match_chunks: {
        Args: {
          category_filter?: string
          match_limit?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          chunk_content: string
          chunk_document_id: string
          chunk_id: string
          chunk_section_title: string
          doc_category: string
          doc_name: string
          similarity: number
        }[]
      }
      search_chunks: {
        Args: {
          category_filter?: string
          match_limit?: number
          query_text: string
        }
        Returns: {
          chunk_content: string
          chunk_document_id: string
          chunk_id: string
          chunk_section_title: string
          doc_category: string
          doc_name: string
          rank: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "sme"
        | "process_manager"
        | "process_analyst"
        | "senior_manager"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "closed"
        | "reopened"
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
      app_role: [
        "admin",
        "user",
        "sme",
        "process_manager",
        "process_analyst",
        "senior_manager",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "assigned",
        "in_progress",
        "resolved",
        "closed",
        "reopened",
      ],
    },
  },
} as const
