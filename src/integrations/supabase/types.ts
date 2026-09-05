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
      ai_interactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          language: string
          query: string
          response: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          language?: string
          query: string
          response: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          language?: string
          query?: string
          response?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_payments: {
        Row: {
          amount: number
          checkout_request_id: string | null
          created_at: string
          date: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          note: string | null
          phone_number: string | null
          result_code: number | null
          result_description: string | null
          sale_id: string
          status: string
          transaction_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_request_id?: string | null
          created_at?: string
          date?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          note?: string | null
          phone_number?: string | null
          result_code?: number | null
          result_description?: string | null
          sale_id: string
          status?: string
          transaction_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_request_id?: string | null
          created_at?: string
          date?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          note?: string | null
          phone_number?: string | null
          result_code?: number | null
          result_description?: string | null
          sale_id?: string
          status?: string
          transaction_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          date: string
          description: string | null
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          date?: string
          description?: string | null
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          date?: string
          description?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          credit_payment_id: string | null
          customer_id: string | null
          failure_reason: string | null
          id: string
          message: string
          provider_message_id: string | null
          reminder_date: string | null
          sale_id: string | null
          sent_at: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          credit_payment_id?: string | null
          customer_id?: string | null
          failure_reason?: string | null
          id?: string
          message: string
          provider_message_id?: string | null
          reminder_date?: string | null
          sale_id?: string | null
          sent_at?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          credit_payment_id?: string | null
          customer_id?: string | null
          failure_reason?: string | null
          id?: string
          message?: string
          provider_message_id?: string | null
          reminder_date?: string | null
          sale_id?: string | null
          sent_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_credit_payment_id_fkey"
            columns: ["credit_payment_id"]
            isOneToOne: false
            referencedRelation: "credit_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          current_stock: number
          id: string
          is_active: boolean
          low_stock_threshold: number
          name: string
          selling_price: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          selling_price?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          selling_price?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string
          created_at: string
          email: string | null
          full_name: string
          has_seen_welcome: boolean
          id: string
          phone: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          business_name: string
          created_at?: string
          email?: string | null
          full_name: string
          has_seen_welcome?: boolean
          id: string
          phone: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          created_at?: string
          email?: string | null
          full_name?: string
          has_seen_welcome?: boolean
          id?: string
          phone?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          credit_paid: boolean
          customer_id: string | null
          date: string
          due_date: string | null
          id: string
          is_credit: boolean
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          total: number
          unit_price: number
          user_id: string
        }
        Insert: {
          credit_paid?: boolean
          customer_id?: string | null
          date?: string
          due_date?: string | null
          id?: string
          is_credit?: boolean
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          total: number
          unit_price: number
          user_id: string
        }
        Update: {
          credit_paid?: boolean
          customer_id?: string | null
          date?: string
          due_date?: string | null
          id?: string
          is_credit?: boolean
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          total?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_history: {
        Row: {
          change_type: string
          date: string
          id: string
          note: string | null
          product_id: string
          quantity: number
          reason: string | null
          user_id: string
          value: number
        }
        Insert: {
          change_type: string
          date?: string
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          user_id: string
          value?: number
        }
        Update: {
          change_type?: string
          date?: string
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      system_prompts: {
        Row: {
          content: string
          created_at: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      admin_platform_stats: { Args: never; Returns: Json }
      admin_vendor_overview: {
        Args: never
        Returns: {
          business_name: string
          created_at: string
          full_name: string
          phone: string
          sales_count: number
          total_sales: number
          user_id: string
        }[]
      }
      create_pending_mpesa_payment: {
        Args: { _amount: number; _phone_number: string; _sale_id: string }
        Returns: {
          amount: number
          checkout_request_id: string | null
          created_at: string
          date: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          note: string | null
          phone_number: string | null
          result_code: number | null
          result_description: string | null
          sale_id: string
          status: string
          transaction_date: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "credit_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_kenyan_phone: { Args: { _phone: string }; Returns: string }
      process_failed_mpesa_payment: {
        Args: {
          _checkout_request_id: string
          _merchant_request_id: string
          _result_code: number
          _result_description: string
        }
        Returns: {
          amount: number
          checkout_request_id: string | null
          created_at: string
          date: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          note: string | null
          phone_number: string | null
          result_code: number | null
          result_description: string | null
          sale_id: string
          status: string
          transaction_date: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "credit_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_successful_mpesa_payment: {
        Args: {
          _amount: number
          _checkout_request_id: string
          _merchant_request_id: string
          _mpesa_receipt_number: string
          _phone_number: string
          _result_code?: number
          _result_description?: string
          _transaction_date: string
        }
        Returns: {
          amount_paid: number
          balance: number
          debt_status: string
          payment_id: string
          sale_id: string
        }[]
      }
      record_restock: {
        Args: { _note: string; _product_id: string; _quantity: number }
        Returns: undefined
      }
      record_sale: {
        Args: {
          _customer_id: string
          _is_credit: boolean
          _product_id: string
          _quantity: number
          _unit_price: number
        }
        Returns: string
      }
      record_stock_loss: {
        Args: {
          _note: string
          _product_id: string
          _quantity: number
          _reason: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "vendor"
      expense_category:
        | "transport"
        | "rent"
        | "stock_purchase"
        | "utilities"
        | "other"
        | "wages"
        | "market_fee"
        | "misc"
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
      app_role: ["admin", "vendor"],
      expense_category: [
        "transport",
        "rent",
        "stock_purchase",
        "utilities",
        "other",
        "wages",
        "market_fee",
        "misc",
      ],
    },
  },
} as const
