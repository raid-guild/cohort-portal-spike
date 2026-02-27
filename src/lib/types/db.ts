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
          header_image_url: string | null
          id: string
          name: string
          slug: string | null
          start_at: string | null
          status: string
          theme_long: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          header_image_url?: string | null
          id?: string
          name: string
          slug?: string | null
          start_at?: string | null
          status?: string
          theme_long?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_at?: string | null
          header_image_url?: string | null
          id?: string
          name?: string
          slug?: string | null
          start_at?: string | null
          status?: string
          theme_long?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dao_memberships: {
        Row: {
          chain_id: string
          claimed_at: string | null
          created_at: string
          dao_id: string
          first_seen_at: string
          id: string
          last_synced_at: string
          loot: string
          profile_handle: string | null
          raw: Json | null
          shares: string
          source: Json
          status: string
          updated_at: string
          user_id: string | null
          verification: Json
          voting_power: string
          wallet_address: string
        }
        Insert: {
          chain_id: string
          claimed_at?: string | null
          created_at?: string
          dao_id: string
          first_seen_at?: string
          id?: string
          last_synced_at?: string
          loot?: string
          profile_handle?: string | null
          raw?: Json | null
          shares?: string
          source?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
          verification?: Json
          voting_power?: string
          wallet_address: string
        }
        Update: {
          chain_id?: string
          claimed_at?: string | null
          created_at?: string
          dao_id?: string
          first_seen_at?: string
          id?: string
          last_synced_at?: string
          loot?: string
          profile_handle?: string | null
          raw?: Json | null
          shares?: string
          source?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
          verification?: Json
          voting_power?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "dao_memberships_profile_handle_fkey"
            columns: ["profile_handle"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["handle"]
          },
        ]
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
      integration_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          event_type: string
          id: number
          last_error: string | null
          next_attempt_at: string
          payload: Json
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_type: string
          id?: never
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_type?: string
          id?: never
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
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
      guild_grimoire_notes: {
        Row: {
          id: string
          user_id: string
          content_type: string
          text_content: string | null
          image_url: string | null
          audio_url: string | null
          audio_duration_sec: number | null
          audio_transcript: string | null
          audio_transcription_status: string | null
          visibility: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          content_type: string
          text_content?: string | null
          image_url?: string | null
          audio_url?: string | null
          audio_duration_sec?: number | null
          audio_transcript?: string | null
          audio_transcription_status?: string | null
          visibility?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          content_type?: string
          text_content?: string | null
          image_url?: string | null
          audio_url?: string | null
          audio_duration_sec?: number | null
          audio_transcript?: string | null
          audio_transcription_status?: string | null
          visibility?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      guild_grimoire_tags: {
        Row: {
          id: string
          slug: string
          label: string
          created_by: string
          created_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          slug: string
          label: string
          created_by: string
          created_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          slug?: string
          label?: string
          created_by?: string
          created_at?: string
          is_active?: boolean
        }
        Relationships: []
      }
      guild_grimoire_note_tags: {
        Row: {
          note_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          note_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          note_id?: string
          tag_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_grimoire_note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "guild_grimoire_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_grimoire_note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "guild_grimoire_tags"
            referencedColumns: ["id"]
          },
        ]
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
      feedback_items: {
        Row: {
          actual_result_md: string | null
          assignee_user_id: string | null
          browser_meta: Json | null
          closed_at: string | null
          created_at: string
          description_md: string
          expected_result_md: string | null
          id: string
          module_id: string | null
          priority: string
          problem_md: string | null
          proposed_outcome_md: string | null
          reporter_user_id: string
          route_path: string | null
          status: string
          steps_to_reproduce_md: string | null
          title: string
          triage_notes: string | null
          type: string
          updated_at: string
        }
        Insert: {
          actual_result_md?: string | null
          assignee_user_id?: string | null
          browser_meta?: Json | null
          closed_at?: string | null
          created_at?: string
          description_md: string
          expected_result_md?: string | null
          id?: string
          module_id?: string | null
          priority?: string
          problem_md?: string | null
          proposed_outcome_md?: string | null
          reporter_user_id: string
          route_path?: string | null
          status?: string
          steps_to_reproduce_md?: string | null
          title: string
          triage_notes?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          actual_result_md?: string | null
          assignee_user_id?: string | null
          browser_meta?: Json | null
          closed_at?: string | null
          created_at?: string
          description_md?: string
          expected_result_md?: string | null
          id?: string
          module_id?: string | null
          priority?: string
          problem_md?: string | null
          proposed_outcome_md?: string | null
          reporter_user_id?: string
          route_path?: string | null
          status?: string
          steps_to_reproduce_md?: string | null
          title?: string
          triage_notes?: string | null
          type?: string
          updated_at?: string
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
      module_requests: {
        Row: {
          id: string
          created_by: string
          module_id: string
          title: string
          owner_contact: string | null
          status: string
          spec: Json
          votes_count: number
          promotion_threshold: number
          github_issue_url: string | null
          submitted_to_github_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          created_by: string
          module_id: string
          title: string
          owner_contact?: string | null
          status?: string
          spec?: Json
          votes_count?: number
          promotion_threshold?: number
          github_issue_url?: string | null
          submitted_to_github_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          created_by?: string
          module_id?: string
          title?: string
          owner_contact?: string | null
          status?: string
          spec?: Json
          votes_count?: number
          promotion_threshold?: number
          github_issue_url?: string | null
          submitted_to_github_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      module_request_votes: {
        Row: {
          request_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          request_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          request_id?: string
          user_id?: string
          created_at?: string
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
      relationship_crm_accounts: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          next_follow_up_at: string | null
          notes: string | null
          owner_user_id: string
          relationship_type: string
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          name: string
          next_follow_up_at?: string | null
          notes?: string | null
          owner_user_id: string
          relationship_type: string
          stage: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          owner_user_id?: string
          relationship_type?: string
          stage?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      relationship_crm_contacts: {
        Row: {
          account_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          phone: string | null
          preferred_channel: string | null
          role_title: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          preferred_channel?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          preferred_channel?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_crm_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "relationship_crm_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_crm_interactions: {
        Row: {
          account_id: string
          contact_id: string | null
          created_at: string
          created_by: string
          id: string
          interaction_at: string
          interaction_type: string
          summary: string
        }
        Insert: {
          account_id: string
          contact_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          interaction_at: string
          interaction_type: string
          summary: string
        }
        Update: {
          account_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          interaction_at?: string
          interaction_type?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_crm_interactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "relationship_crm_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_crm_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "relationship_crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_crm_tasks: {
        Row: {
          account_id: string
          assignee_user_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assignee_user_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assignee_user_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_crm_tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "relationship_crm_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      backfill_email_referral_outbox: {
        Args: {
          p_limit?: number
        }
        Returns: number
      }
      signup_referrals_list: {
        Args: {
          p_limit: number
          p_offset: number
          p_q?: string
          p_status?: string
        }
        Returns: Array<{
          id: string
          email: string
          referral: string | null
          created_at: string | null
          has_account: boolean
        }>
      }
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
