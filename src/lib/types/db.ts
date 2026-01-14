export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string | null
          created_by: string | null
          ends_at: string | null
          id: string
          role_targets: string[] | null
          starts_at: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          id?: string
          role_targets?: string[] | null
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          id?: string
          role_targets?: string[] | null
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      module_data: {
        Row: {
          created_at: string | null
          module_id: string
          payload: Json
          updated_at: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string | null
          module_id: string
          payload: Json
          updated_at?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string | null
          module_id?: string
          payload?: Json
          updated_at?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      module_keys: {
        Row: {
          created_at: string | null
          key_hash: string
          module_id: string
        }
        Insert: {
          created_at?: string | null
          key_hash: string
          module_id: string
        }
        Update: {
          created_at?: string | null
          key_hash?: string
          module_id?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          description: string | null
          id: string
          lane: string | null
          owner: Json | null
          requires_auth: boolean | null
          status: string | null
          surfaces: string[] | null
          tags: string[] | null
          title: string
          type: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          description?: string | null
          id: string
          lane?: string | null
          owner?: Json | null
          requires_auth?: boolean | null
          status?: string | null
          surfaces?: string[] | null
          tags?: string[] | null
          title: string
          type?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          lane?: string | null
          owner?: Json | null
          requires_auth?: boolean | null
          status?: string | null
          surfaces?: string[] | null
          tags?: string[] | null
          title?: string
          type?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cohorts: Json | null
          contact: Json | null
          created_at: string | null
          display_name: string
          email: string | null
          handle: string
          links: Json | null
          location: string | null
          roles: string[] | null
          skills: string[] | null
          updated_at: string | null
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cohorts?: Json | null
          contact?: Json | null
          created_at?: string | null
          display_name: string
          email?: string | null
          handle: string
          links?: Json | null
          location?: string | null
          roles?: string[] | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cohorts?: Json | null
          contact?: Json | null
          created_at?: string | null
          display_name?: string
          email?: string | null
          handle?: string
          links?: Json | null
          location?: string | null
          roles?: string[] | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      role_catalog: {
        Row: {
          category: string | null
          description: string | null
          role: string
          type: string | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          role: string
          type?: string | null
        }
        Update: {
          category?: string | null
          description?: string | null
          role?: string
          type?: string | null
        }
        Relationships: []
      }
      skill_catalog: {
        Row: {
          category: string | null
          skill: string
        }
        Insert: {
          category?: string | null
          skill: string
        }
        Update: {
          category?: string | null
          skill?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: string
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

