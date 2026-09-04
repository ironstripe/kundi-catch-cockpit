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
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      catch_images: {
        Row: {
          caption: string | null
          catch_id: string
          created_at: string
          id: string
          is_primary: boolean
          optimized_path: string | null
          optimized_source_path: string | null
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          catch_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          optimized_path?: string | null
          optimized_source_path?: string | null
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          catch_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          optimized_path?: string | null
          optimized_source_path?: string | null
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catch_images_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
        ]
      }
      catch_locations: {
        Row: {
          allocated_quantity: number | null
          catch_id: string
          created_at: string
          id: string
          location_id: string
        }
        Insert: {
          allocated_quantity?: number | null
          catch_id: string
          created_at?: string
          id?: string
          location_id: string
        }
        Update: {
          allocated_quantity?: number | null
          catch_id?: string
          created_at?: string
          id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catch_locations_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      catch_number_sequences: {
        Row: {
          last_value: number
          year: number
        }
        Insert: {
          last_value?: number
          year: number
        }
        Update: {
          last_value?: number
          year?: number
        }
        Relationships: []
      }
      catches: {
        Row: {
          actual_sell_through: number | null
          available_from: string | null
          available_until: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          catch_number: string | null
          catch_price: number | null
          category: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          delivery_cost: number
          delivery_included: boolean
          description: string | null
          expected_sell_through: number | null
          expiry_date: string | null
          handicap_reason: string | null
          handicap_story: string | null
          id: string
          internal_note: string | null
          inventory_counted_at: string | null
          learning: string | null
          packaging: string | null
          post_final_text: string | null
          post_generated_at: string | null
          post_generated_text: string | null
          post_outdated_decision: string | null
          post_source_signature: string | null
          product_name: string
          published_at: string | null
          published_by: string | null
          published_image_path: string | null
          published_text: string | null
          purchase_price: number | null
          purchase_quantity: number
          quantity_unit: string
          reconciliation_snapshot: Json | null
          regular_price: number | null
          remaining_quantity: number | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
          supplier_id: string | null
          temperature: string
          updated_at: string
        }
        Insert: {
          actual_sell_through?: number | null
          available_from?: string | null
          available_until?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          catch_number?: string | null
          catch_price?: number | null
          category?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          delivery_cost?: number
          delivery_included?: boolean
          description?: string | null
          expected_sell_through?: number | null
          expiry_date?: string | null
          handicap_reason?: string | null
          handicap_story?: string | null
          id?: string
          internal_note?: string | null
          inventory_counted_at?: string | null
          learning?: string | null
          packaging?: string | null
          post_final_text?: string | null
          post_generated_at?: string | null
          post_generated_text?: string | null
          post_outdated_decision?: string | null
          post_source_signature?: string | null
          product_name: string
          published_at?: string | null
          published_by?: string | null
          published_image_path?: string | null
          published_text?: string | null
          purchase_price?: number | null
          purchase_quantity?: number
          quantity_unit?: string
          reconciliation_snapshot?: Json | null
          regular_price?: number | null
          remaining_quantity?: number | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          supplier_id?: string | null
          temperature?: string
          updated_at?: string
        }
        Update: {
          actual_sell_through?: number | null
          available_from?: string | null
          available_until?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          catch_number?: string | null
          catch_price?: number | null
          category?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          delivery_cost?: number
          delivery_included?: boolean
          description?: string | null
          expected_sell_through?: number | null
          expiry_date?: string | null
          handicap_reason?: string | null
          handicap_story?: string | null
          id?: string
          internal_note?: string | null
          inventory_counted_at?: string | null
          learning?: string | null
          packaging?: string | null
          post_final_text?: string | null
          post_generated_at?: string | null
          post_generated_text?: string | null
          post_outdated_decision?: string | null
          post_source_signature?: string | null
          product_name?: string
          published_at?: string | null
          published_by?: string | null
          published_image_path?: string | null
          published_text?: string | null
          purchase_price?: number | null
          purchase_quantity?: number
          quantity_unit?: string
          reconciliation_snapshot?: Json | null
          regular_price?: number | null
          remaining_quantity?: number | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          supplier_id?: string | null
          temperature?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          pickup_note: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pickup_note?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pickup_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      post_versions: {
        Row: {
          body: string | null
          catch_id: string
          created_at: string
          created_by: string | null
          final_text: string | null
          generated_text: string | null
          id: string
          image_path: string | null
          published_at: string | null
          reason: string | null
          updated_at: string
          used_for_publication: boolean
          version: number
        }
        Insert: {
          body?: string | null
          catch_id: string
          created_at?: string
          created_by?: string | null
          final_text?: string | null
          generated_text?: string | null
          id?: string
          image_path?: string | null
          published_at?: string | null
          reason?: string | null
          updated_at?: string
          used_for_publication?: boolean
          version?: number
        }
        Update: {
          body?: string | null
          catch_id?: string
          created_at?: string
          created_by?: string | null
          final_text?: string | null
          generated_text?: string | null
          id?: string
          image_path?: string | null
          published_at?: string | null
          reason?: string | null
          updated_at?: string
          used_for_publication?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_versions_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_note: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          contact_note?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          contact_note?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
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
      app_role: ["admin", "editor", "viewer"],
    },
  },
} as const
