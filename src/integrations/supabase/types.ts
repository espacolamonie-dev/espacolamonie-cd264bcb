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
      booking_schedule_settings: {
        Row: {
          allowed_days: number[]
          blocked_hours: number[]
          created_at: string
          end_hour: number
          id: string
          start_hour: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_days?: number[]
          blocked_hours?: number[]
          created_at?: string
          end_hour?: number
          id?: string
          start_hour?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_days?: number[]
          blocked_hours?: number[]
          created_at?: string
          end_hour?: number
          id?: string
          start_hour?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          additional_value: number
          budget_id: string
          catalog_item_id: string | null
          category: string
          created_at: string
          final_value: number
          id: string
          line_total: number
          name: string
          percentage_applied: number
          quantity: number
          sort_order: number
          supplier: string
          unit_label: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_value?: number
          budget_id: string
          catalog_item_id?: string | null
          category?: string
          created_at?: string
          final_value?: number
          id?: string
          line_total?: number
          name: string
          percentage_applied?: number
          quantity?: number
          sort_order?: number
          supplier?: string
          unit_label?: string
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_value?: number
          budget_id?: string
          catalog_item_id?: string | null
          category?: string
          created_at?: string
          final_value?: number
          id?: string
          line_total?: number
          name?: string
          percentage_applied?: number
          quantity?: number
          sort_order?: number
          supplier?: string
          unit_label?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items_catalog: {
        Row: {
          category: string
          created_at: string
          default_percentage: number
          default_unit_price: number
          id: string
          is_active: boolean
          name: string
          supplier: string
          unit_label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_percentage?: number
          default_unit_price?: number
          id?: string
          is_active?: boolean
          name: string
          supplier?: string
          unit_label?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          default_percentage?: number
          default_unit_price?: number
          id?: string
          is_active?: boolean
          name?: string
          supplier?: string
          unit_label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_logs: {
        Row: {
          action: string
          budget_id: string
          created_at: string
          id: string
          new_status: string | null
          notes: string
          old_status: string | null
          user_id: string
        }
        Insert: {
          action: string
          budget_id: string
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string
          old_status?: string | null
          user_id: string
        }
        Update: {
          action?: string
          budget_id?: string
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string
          old_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_logs_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          additional_total: number
          client_id: string | null
          client_name: string
          client_phone: string
          contract_id: string | null
          created_at: string
          deposit_value: number
          event_date: string | null
          event_type: string
          final_total: number
          global_percentage: number
          guest_count: number
          id: string
          notes: string
          pdf_url: string | null
          public_token: string
          status: string
          subtotal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_total?: number
          client_id?: string | null
          client_name: string
          client_phone?: string
          contract_id?: string | null
          created_at?: string
          deposit_value?: number
          event_date?: string | null
          event_type?: string
          final_total?: number
          global_percentage?: number
          guest_count?: number
          id?: string
          notes?: string
          pdf_url?: string | null
          public_token?: string
          status?: string
          subtotal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_total?: number
          client_id?: string | null
          client_name?: string
          client_phone?: string
          contract_id?: string | null
          created_at?: string
          deposit_value?: number
          event_date?: string | null
          event_type?: string
          final_total?: number
          global_percentage?: number
          guest_count?: number
          id?: string
          notes?: string
          pdf_url?: string | null
          public_token?: string
          status?: string
          subtotal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
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
          fbclid: string
          id: string
          meta_ad_id: string
          meta_adset_id: string
          meta_campaign_id: string
          name: string
          notes: string
          phone: string
          user_id: string
          utm_campaign: string
          utm_content: string
          utm_medium: string
          utm_source: string
          utm_term: string
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
          fbclid?: string
          id?: string
          meta_ad_id?: string
          meta_adset_id?: string
          meta_campaign_id?: string
          name: string
          notes?: string
          phone?: string
          user_id: string
          utm_campaign?: string
          utm_content?: string
          utm_medium?: string
          utm_source?: string
          utm_term?: string
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
          fbclid?: string
          id?: string
          meta_ad_id?: string
          meta_adset_id?: string
          meta_campaign_id?: string
          name?: string
          notes?: string
          phone?: string
          user_id?: string
          utm_campaign?: string
          utm_content?: string
          utm_medium?: string
          utm_source?: string
          utm_term?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string
          auto_confirm_payment: boolean
          auto_receipt: boolean
          cnpj: string
          company_name: string
          created_at: string
          default_bank: string
          default_entry_category: string
          default_expense_category: string
          default_pix_key: string
          email: string
          id: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          auto_confirm_payment?: boolean
          auto_receipt?: boolean
          cnpj?: string
          company_name?: string
          created_at?: string
          default_bank?: string
          default_entry_category?: string
          default_expense_category?: string
          default_pix_key?: string
          email?: string
          id?: string
          phone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          auto_confirm_payment?: boolean
          auto_receipt?: boolean
          cnpj?: string
          company_name?: string
          created_at?: string
          default_bank?: string
          default_entry_category?: string
          default_expense_category?: string
          default_pix_key?: string
          email?: string
          id?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_signatures: {
        Row: {
          budget_id: string | null
          client_address: string | null
          client_cpf: string | null
          client_name: string
          client_phone: string | null
          contract_id: string | null
          created_at: string
          deposit_percent: number
          event_date: string
          event_date_end: string | null
          event_type: string
          id: string
          payment_choice: string
          payment_due_date: string | null
          payment_method_selected: string
          rental_type: string | null
          sent_at: string | null
          sent_to_phone: string | null
          signed_at: string | null
          signed_ip: string | null
          slug: string | null
          status: string
          token: string
          total_value: number
          user_id: string
        }
        Insert: {
          budget_id?: string | null
          client_address?: string | null
          client_cpf?: string | null
          client_name: string
          client_phone?: string | null
          contract_id?: string | null
          created_at?: string
          deposit_percent?: number
          event_date: string
          event_date_end?: string | null
          event_type: string
          id?: string
          payment_choice?: string
          payment_due_date?: string | null
          payment_method_selected?: string
          rental_type?: string | null
          sent_at?: string | null
          sent_to_phone?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          slug?: string | null
          status?: string
          token?: string
          total_value?: number
          user_id: string
        }
        Update: {
          budget_id?: string | null
          client_address?: string | null
          client_cpf?: string | null
          client_name?: string
          client_phone?: string | null
          contract_id?: string | null
          created_at?: string
          deposit_percent?: number
          event_date?: string
          event_date_end?: string | null
          event_type?: string
          id?: string
          payment_choice?: string
          payment_due_date?: string | null
          payment_method_selected?: string
          rental_type?: string | null
          sent_at?: string | null
          sent_to_phone?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          slug?: string | null
          status?: string
          token?: string
          total_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
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
          event_date_end: string | null
          event_time: string
          event_type: string
          fbclid: string
          google_event_id: string | null
          guest_count: number
          id: string
          meta_ad_id: string
          meta_adset_id: string
          meta_campaign_id: string
          mp_external_reference: string
          mp_payment_id: string
          mp_payment_status: string
          mp_preference_id: string
          payment_choice: string
          payment_due_date: string | null
          payment_followup_required: boolean
          payment_method_selected: string
          payment_status: string
          remaining_value: number
          rental_type: string
          reserved_until: string | null
          source: string
          status: string
          total_value: number
          user_id: string
          utm_campaign: string
          utm_content: string
          utm_medium: string
          utm_source: string
          utm_term: string
          visit_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id: string
          created_at?: string
          deposit_percent?: number
          deposit_value?: number
          event_date: string
          event_date_end?: string | null
          event_time?: string
          event_type: string
          fbclid?: string
          google_event_id?: string | null
          guest_count?: number
          id?: string
          meta_ad_id?: string
          meta_adset_id?: string
          meta_campaign_id?: string
          mp_external_reference?: string
          mp_payment_id?: string
          mp_payment_status?: string
          mp_preference_id?: string
          payment_choice?: string
          payment_due_date?: string | null
          payment_followup_required?: boolean
          payment_method_selected?: string
          payment_status?: string
          remaining_value?: number
          rental_type?: string
          reserved_until?: string | null
          source?: string
          status?: string
          total_value?: number
          user_id: string
          utm_campaign?: string
          utm_content?: string
          utm_medium?: string
          utm_source?: string
          utm_term?: string
          visit_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          created_at?: string
          deposit_percent?: number
          deposit_value?: number
          event_date?: string
          event_date_end?: string | null
          event_time?: string
          event_type?: string
          fbclid?: string
          google_event_id?: string | null
          guest_count?: number
          id?: string
          meta_ad_id?: string
          meta_adset_id?: string
          meta_campaign_id?: string
          mp_external_reference?: string
          mp_payment_id?: string
          mp_payment_status?: string
          mp_preference_id?: string
          payment_choice?: string
          payment_due_date?: string | null
          payment_followup_required?: boolean
          payment_method_selected?: string
          payment_status?: string
          remaining_value?: number
          rental_type?: string
          reserved_until?: string | null
          source?: string
          status?: string
          total_value?: number
          user_id?: string
          utm_campaign?: string
          utm_content?: string
          utm_medium?: string
          utm_source?: string
          utm_term?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_whatsapp_contacts: {
        Row: {
          contact_count: number
          contact_date: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_count?: number
          contact_date: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_count?: number
          contact_date?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      employee_payments: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          employee_id: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date: string
          description?: string
          employee_id: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          employee_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          payment_type: string
          payment_value: number
          phone: string
          roles: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          payment_type?: string
          payment_value?: number
          phone?: string
          roles?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          payment_type?: string
          payment_value?: number
          phone?: string
          roles?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      google_settings: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          calendar_name: string | null
          connected_at: string | null
          connected_email: string | null
          created_at: string
          id: string
          is_connected: boolean
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          calendar_name?: string | null
          connected_at?: string | null
          connected_email?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          calendar_name?: string | null
          connected_at?: string | null
          connected_email?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_sync_logs: {
        Row: {
          action: string
          contract_id: string | null
          created_at: string
          google_event_id: string | null
          id: string
          message: string | null
          status: string
          user_id: string
        }
        Insert: {
          action: string
          contract_id?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          message?: string | null
          status?: string
          user_id: string
        }
        Update: {
          action?: string
          contract_id?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          message?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_status_history: {
        Row: {
          changed_at: string
          from_stage: string | null
          id: string
          lead_id: string
          to_stage: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          from_stage?: string | null
          id?: string
          lead_id: string
          to_stage: string
          user_id: string
        }
        Update: {
          changed_at?: string
          from_stage?: string | null
          id?: string
          lead_id?: string
          to_stage?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          contract_id: string | null
          created_at: string
          human_mode: boolean
          id: string
          interest_date: string | null
          last_interaction: string | null
          name: string
          notes: string | null
          origin: string
          phone: string
          stage: string
          tags: string[] | null
          updated_at: string
          user_id: string
          visit_id: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          human_mode?: boolean
          id?: string
          interest_date?: string | null
          last_interaction?: string | null
          name: string
          notes?: string | null
          origin?: string
          phone?: string
          stage?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          visit_id?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          human_mode?: boolean
          id?: string
          interest_date?: string | null
          last_interaction?: string | null
          name?: string
          notes?: string | null
          origin?: string
          phone?: string
          stage?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
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
      mercado_pago_settings: {
        Row: {
          access_token: string
          created_at: string
          failure_url: string
          id: string
          is_active: boolean
          pending_url: string
          public_key: string
          success_url: string
          updated_at: string
          user_id: string
          webhook_url: string
        }
        Insert: {
          access_token?: string
          created_at?: string
          failure_url?: string
          id?: string
          is_active?: boolean
          pending_url?: string
          public_key?: string
          success_url?: string
          updated_at?: string
          user_id: string
          webhook_url?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          failure_url?: string
          id?: string
          is_active?: boolean
          pending_url?: string
          public_key?: string
          success_url?: string
          updated_at?: string
          user_id?: string
          webhook_url?: string
        }
        Relationships: []
      }
      meta_event_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_name: string
          id: string
          payload: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_name?: string
          id?: string
          payload?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_name?: string
          id?: string
          payload?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_pixel_settings: {
        Row: {
          access_token: string
          capi_enabled: boolean
          conversion_event: string
          created_at: string
          id: string
          pixel_enabled: boolean
          pixel_id: string
          send_value: boolean
          updated_at: string
          user_id: string
          value_source: string
          whatsapp_number: string
        }
        Insert: {
          access_token?: string
          capi_enabled?: boolean
          conversion_event?: string
          created_at?: string
          id?: string
          pixel_enabled?: boolean
          pixel_id?: string
          send_value?: boolean
          updated_at?: string
          user_id: string
          value_source?: string
          whatsapp_number?: string
        }
        Update: {
          access_token?: string
          capi_enabled?: boolean
          conversion_event?: string
          created_at?: string
          id?: string
          pixel_enabled?: boolean
          pixel_id?: string
          send_value?: boolean
          updated_at?: string
          user_id?: string
          value_source?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      mp_payment_logs: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          id: string
          mp_payment_id: string
          raw_payload: Json | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          contract_id: string
          created_at?: string
          id?: string
          mp_payment_id?: string
          raw_payload?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          id?: string
          mp_payment_id?: string
          raw_payload?: Json | null
          status?: string
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
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          default_template_key: string | null
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          sort_order: number
          stage_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          default_template_key?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          sort_order?: number
          stage_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          default_template_key?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          sort_order?: number
          stage_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pix_settings: {
        Row: {
          bank: string
          beneficiary_name: string
          created_at: string
          id: string
          pix_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank?: string
          beneficiary_name?: string
          created_at?: string
          id?: string
          pix_key?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank?: string
          beneficiary_name?: string
          created_at?: string
          id?: string
          pix_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_config: {
        Row: {
          created_at: string | null
          id: string
          vapid_private_key_jwk: string
          vapid_public_key: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          vapid_private_key_jwk: string
          vapid_public_key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          vapid_private_key_jwk?: string
          vapid_public_key?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
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
      stage_automation_rules: {
        Row: {
          auto_message_template_key: string | null
          auto_send: boolean
          created_at: string
          enabled: boolean
          followup_after_hours: number | null
          followup_template_key: string | null
          id: string
          stage_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_message_template_key?: string | null
          auto_send?: boolean
          created_at?: string
          enabled?: boolean
          followup_after_hours?: number | null
          followup_template_key?: string | null
          id?: string
          stage_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_message_template_key?: string | null
          auto_send?: boolean
          created_at?: string
          enabled?: boolean
          followup_after_hours?: number | null
          followup_template_key?: string | null
          id?: string
          stage_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_automation_rules_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          deposit_percent: number
          event_type_desired: string
          event_value: number
          fbclid: string
          google_event_id: string | null
          guest_count: number
          id: string
          interest_event_date: string | null
          lead_source: string
          meta_ad_id: string
          meta_adset_id: string
          meta_campaign_id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
          utm_campaign: string
          utm_content: string
          utm_medium: string
          utm_source: string
          utm_term: string
          visit_date: string
          visit_time: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          deposit_percent?: number
          event_type_desired?: string
          event_value?: number
          fbclid?: string
          google_event_id?: string | null
          guest_count?: number
          id?: string
          interest_event_date?: string | null
          lead_source?: string
          meta_ad_id?: string
          meta_adset_id?: string
          meta_campaign_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          utm_campaign?: string
          utm_content?: string
          utm_medium?: string
          utm_source?: string
          utm_term?: string
          visit_date: string
          visit_time: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          deposit_percent?: number
          event_type_desired?: string
          event_value?: number
          fbclid?: string
          google_event_id?: string | null
          guest_count?: number
          id?: string
          interest_event_date?: string | null
          lead_source?: string
          meta_ad_id?: string
          meta_adset_id?: string
          meta_campaign_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          utm_campaign?: string
          utm_content?: string
          utm_medium?: string
          utm_source?: string
          utm_term?: string
          visit_date?: string
          visit_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connection: {
        Row: {
          connected_at: string | null
          connected_phone: string | null
          created_at: string
          disconnected_at: string | null
          id: string
          session_name: string
          status: string
          updated_at: string
          user_id: string
          waha_api_key: string
          waha_url: string
        }
        Insert: {
          connected_at?: string | null
          connected_phone?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          session_name?: string
          status?: string
          updated_at?: string
          user_id: string
          waha_api_key?: string
          waha_url?: string
        }
        Update: {
          connected_at?: string | null
          connected_phone?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          session_name?: string
          status?: string
          updated_at?: string
          user_id?: string
          waha_api_key?: string
          waha_url?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          message?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          id: string
          lead_id: string
          raw_payload: Json | null
          status: string
          timestamp: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          direction?: string
          id?: string
          lead_id: string
          raw_payload?: Json | null
          status?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string
          raw_payload?: Json | null
          status?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          created_at: string
          id: string
          template_key: string
          template_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          template_key: string
          template_text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          template_key?: string
          template_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
