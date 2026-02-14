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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string
          address_city: string
          address_complement: string
          address_neighborhood: string
          address_number: string
          address_state: string
          address_street: string
          address_zip: string
          cpf: string
          created_at: string
          email: string
          id: string
          name: string
          notes: string
          phone: string
          user_id: string
        }
        Insert: {
          address?: string
          address_city?: string
          address_complement?: string
          address_neighborhood?: string
          address_number?: string
          address_state?: string
          address_street?: string
          address_zip?: string
          cpf?: string
          created_at?: string
          email?: string
          id?: string
          name: string
          notes?: string
          phone?: string
          user_id: string
        }
        Update: {
          address?: string
          address_city?: string
          address_complement?: string
          address_neighborhood?: string
          address_number?: string
          address_state?: string
          address_street?: string
          address_zip?: string
          cpf?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_signatures: {
        Row: {
          client_address: string | null
          client_cpf: string | null
          client_name: string
          client_phone: string | null
          contract_id: string
          created_at: string
          deposit_percent: number
          event_date: string
          event_type: string
          id: string
          sent_at: string | null
          sent_to_phone: string | null
          signed_at: string | null
          signed_ip: string | null
          status: string
          token: string
          total_value: number
          user_id: string
        }
        Insert: {
          client_address?: string | null
          client_cpf?: string | null
          client_name: string
          client_phone?: string | null
          contract_id: string
          created_at?: string
          deposit_percent?: number
          event_date: string
          event_type: string
          id?: string
          sent_at?: string | null
          sent_to_phone?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          status?: string
          token?: string
          total_value?: number
          user_id: string
        }
        Update: {
          client_address?: string | null
          client_cpf?: string | null
          client_name?: string
          client_phone?: string | null
          contract_id?: string
          created_at?: string
          deposit_percent?: number
          event_date?: string
          event_type?: string
          id?: string
          sent_at?: string | null
          sent_to_phone?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          status?: string
          token?: string
          total_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string
          created_at: string
          deposit_percent: number
          deposit_value: number
          event_date: string
          event_time: string
          event_type: string
          guest_count: number
          id: string
          payment_status: string
          remaining_value: number
          status: string
          total_value: number
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id: string
          created_at?: string
          deposit_percent?: number
          deposit_value?: number
          event_date: string
          event_time?: string
          event_type: string
          guest_count?: number
          id?: string
          payment_status?: string
          remaining_value?: number
          status?: string
          total_value?: number
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          created_at?: string
          deposit_percent?: number
          deposit_value?: number
          event_date?: string
          event_time?: string
          event_type?: string
          guest_count?: number
          id?: string
          payment_status?: string
          remaining_value?: number
          status?: string
          total_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          contract_id: string
          created_at: string
          file_name: string
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          file_name?: string
          id?: string
          name: string
          type?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          file_name?: string
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date: string
          description: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      manual_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          notes: string
          payment_method: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date: string
          description: string
          id?: string
          notes?: string
          payment_method?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string
          payment_method?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          date: string
          description: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          contract_id: string
          created_at?: string
          date: string
          description?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_audit_logs: {
        Row: {
          browser: string | null
          client_cpf: string | null
          client_name: string
          contract_id: string
          contract_version: number
          created_at: string
          device_type: string | null
          id: string
          operating_system: string | null
          pdf_hash: string | null
          read_confirmed: boolean
          signature_type: string
          signed_at: string
          signed_file_name: string
          signer_ip: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          client_cpf?: string | null
          client_name: string
          contract_id: string
          contract_version?: number
          created_at?: string
          device_type?: string | null
          id?: string
          operating_system?: string | null
          pdf_hash?: string | null
          read_confirmed?: boolean
          signature_type?: string
          signed_at: string
          signed_file_name: string
          signer_ip?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          client_cpf?: string | null
          client_name?: string
          contract_id?: string
          contract_version?: number
          created_at?: string
          device_type?: string | null
          id?: string
          operating_system?: string | null
          pdf_hash?: string | null
          read_confirmed?: boolean
          signature_type?: string
          signed_at?: string
          signed_file_name?: string
          signer_ip?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_audit_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
