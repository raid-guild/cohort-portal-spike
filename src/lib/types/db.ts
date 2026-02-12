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
      cohort_applications: {
        Row: {
          applied_at: string
          commitment_path: string | null
          created_at: string
          goals: string
          id: string
          intent: string
          past_work: string | null
          payment_status: string
          signal_check_status: string
          status: string
          time_commitment: string
          updated_at: string
          user_id: string
          work_interest: string
        }
        Insert: {
          applied_at?: string
          commitment_path?: string | null
          created_at?: string
          goals: string
          id?: string
          intent: string
          past_work?: string | null
          payment_status?: string
          signal_check_status?: string
          status?: string
          time_commitment: string
          updated_at?: string
          user_id: string
          work_interest: string
        }
        Update: {
          applied_at?: string
          commitment_path?: string | null
          created_at?: string
          goals?: string
          id?: string
          intent?: string
          past_work?: string | null
          payment_status?: string
          signal_check_status?: string
          status?: string
          time_commitment?: string
          updated_at?: string
          user_id?: string
          work_interest?: string
        }
        Relationships: []
      }
      cohort_content: {
        Row: {
          cohort_id: string
          created_at: string
          notes: Json | null
          projects: Json | null
          resources: Json | null
          schedule: Json | null
          updated_at: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          notes?: Json | null
          projects?: Json | null
          resources?: Json | null
          schedule?: Json | null
          updated_at?: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          notes?: Json | null
          projects?: Json | null
          resources?: Json | null
          schedule?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_content_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: true
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          created_at: string
          end_at: string | null
          id: string
          name: string
          start_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          id?: string
          name: string
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_at?: string | null
          id?: string
          name?: string
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_referrals: {
        Row: {
          created_at: string | null
          email: string
          id: string
          referral: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          referral?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          referral?: string | null
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          created_at: string | null
          entitlement: string
          expires_at: string | null
          metadata: Json | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entitlement: string
          expires_at?: string | null
          metadata?: Json | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entitlement?: string
          expires_at?: string | null
          metadata?: Json | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      badge_definitions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          badge_id: string
          metadata: Json | null
          note: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: string
          metadata?: Json | null
          note?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: string
          metadata?: Json | null
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
        ]
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
      timeline_entries: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          created_via_role: string | null
          deleted_at: string | null
          id: string
          kind: string
          occurred_at: string
          pinned: boolean
          source_kind: string | null
          source_ref: Json | null
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          created_via_role?: string | null
          deleted_at?: string | null
          id?: string
          kind: string
          occurred_at?: string
          pinned?: boolean
          source_kind?: string | null
          source_ref?: Json | null
          title: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          created_via_role?: string | null
          deleted_at?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          pinned?: boolean
          source_kind?: string | null
          source_ref?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
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
      showcase_posts: {
        Row: {
          boost_count: number
          created_at: string
          id: string
          image_url: string
          impact_statement: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          boost_count?: number
          created_at?: string
          id?: string
          image_url: string
          impact_statement: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          boost_count?: number
          created_at?: string
          id?: string
          image_url?: string
          impact_statement?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
      bounties: {
        Row: {
          id: string
          title: string
          description: string
          status: string
          github_url: string | null
          reward_type: string
          reward_amount: number | null
          reward_token: string | null
          badge_id: string | null
          created_by: string
          created_at: string
          updated_at: string
          due_at: string | null
          tags: string[] | null
        }
        Insert: {
          id?: string
          title: string
          description?: string
          status?: string
          github_url?: string | null
          reward_type?: string
          reward_amount?: number | null
          reward_token?: string | null
          badge_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          due_at?: string | null
          tags?: string[] | null
        }
        Update: {
          id?: string
          title?: string
          description?: string
          status?: string
          github_url?: string | null
          reward_type?: string
          reward_amount?: number | null
          reward_token?: string | null
          badge_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          due_at?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      bounty_claims: {
        Row: {
          id: string
          bounty_id: string
          user_id: string
          status: string
          created_at: string
          updated_at: string
          submitted_at: string | null
          resolved_at: string | null
        }
        Insert: {
          id?: string
          bounty_id: string
          user_id: string
          status?: string
          created_at?: string
          updated_at?: string
          submitted_at?: string | null
          resolved_at?: string | null
        }
        Update: {
          id?: string
          bounty_id?: string
          user_id?: string
          status?: string
          created_at?: string
          updated_at?: string
          submitted_at?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bounty_claims_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_comments: {
        Row: {
          id: string
          bounty_id: string
          user_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          bounty_id: string
          user_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          bounty_id?: string
          user_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_comments_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_listings: {
        Row: {
          category: string | null
          contact_method: string
          created_at: string
          created_by: string
          description: string
          external_contact: string | null
          fulfilled_at: string | null
          id: string
          status: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          contact_method?: string
          created_at?: string
          created_by: string
          description?: string
          external_contact?: string | null
          fulfilled_at?: string | null
          id?: string
          status?: string
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          contact_method?: string
          created_at?: string
          created_by?: string
          description?: string
          external_contact?: string | null
          fulfilled_at?: string | null
          id?: string
          status?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
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

