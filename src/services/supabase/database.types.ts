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
      destinations: {
        Row: {
          active: boolean
          city_name: string
          country_code: string
          country_name: string
          created_at: string
          hero_image_url: string | null
          id: string
          latitude: number | null
          longitude: number | null
          slug: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          city_name: string
          country_code: string
          country_name: string
          created_at?: string
          hero_image_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          slug: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          city_name?: string
          country_code?: string
          country_name?: string
          created_at?: string
          hero_image_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          slug?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      discovery_gender_preferences: {
        Row: {
          created_at: string
          gender: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gender: string
          user_id?: string
        }
        Update: {
          created_at?: string
          gender?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_gender_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_preferences: {
        Row: {
          created_at: string
          max_age: number
          max_distance_km: number | null
          min_age: number
          minimum_overlap_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          max_age?: number
          max_distance_km?: number | null
          min_age?: number
          minimum_overlap_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          max_age?: number
          max_distance_km?: number | null
          min_age?: number
          minimum_overlap_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interests: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          label: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          label: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          label?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          unmatched_at: string | null
          unmatched_by: string | null
          user_high_id: string
          user_low_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unmatched_at?: string | null
          unmatched_by?: string | null
          user_high_id: string
          user_low_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unmatched_at?: string | null
          unmatched_by?: string | null
          user_high_id?: string
          user_low_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_unmatched_by_fkey"
            columns: ["unmatched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_high_id_fkey"
            columns: ["user_high_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_low_id_fkey"
            columns: ["user_low_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_interests: {
        Row: {
          created_at: string
          interest_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          interest_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          interest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          gender: string | null
          home_city: string | null
          home_country: string | null
          id: string
          is_discoverable: boolean
          is_profile_complete: boolean
          occupation: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          home_city?: string | null
          home_country?: string | null
          id: string
          is_discoverable?: boolean
          is_profile_complete?: boolean
          occupation?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          home_city?: string | null
          home_country?: string | null
          id?: string
          is_discoverable?: boolean
          is_profile_complete?: boolean
          occupation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          created_at: string
          destination_id: string
          end_date: string
          id: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          destination_id: string
          end_date: string
          id?: string
          start_date: string
          status?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          destination_id?: string
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_user_id_fkey"
            columns: ["blocker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_decisions: {
        Row: {
          actor_user_id: string
          created_at: string
          decision: string
          id: string
          source_trip_id: string | null
          target_trip_id: string | null
          target_user_id: string
          updated_at: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          decision: string
          id?: string
          source_trip_id?: string | null
          target_trip_id?: string | null
          target_user_id: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          decision?: string
          id?: string
          source_trip_id?: string | null
          target_trip_id?: string | null
          target_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_decisions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_decisions_source_trip_id_fkey"
            columns: ["source_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_decisions_target_trip_id_fkey"
            columns: ["target_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_decisions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          related_match_id: string | null
          related_trip_id: string | null
          reported_user_id: string
          reporter_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          related_match_id?: string | null
          related_trip_id?: string | null
          reported_user_id: string
          reporter_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          related_match_id?: string | null
          related_trip_id?: string | null
          reported_user_id?: string
          reporter_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_related_match_id_fkey"
            columns: ["related_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_related_trip_id_fkey"
            columns: ["related_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      block_user: {
        Args: { p_target_user_id: string }
        Returns: {
          blocked_user_id: string
          created_at: string
        }[]
      }
      replace_profile_interests: {
        Args: { p_interest_ids: string[] }
        Returns: {
          created_at: string
          interest_id: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profile_interests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_user: {
        Args: {
          p_details?: string
          p_reason: string
          p_related_match_id?: string
          p_related_trip_id?: string
          p_reported_user_id: string
        }
        Returns: {
          created_at: string
          report_id: string
        }[]
      }
      set_discovery_gender_preferences: {
        Args: { p_genders: string[] }
        Returns: {
          created_at: string
          gender: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "discovery_gender_preferences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      submit_decision: {
        Args: {
          p_decision: string
          p_source_trip_id?: string
          p_target_trip_id?: string
          p_target_user_id: string
        }
        Returns: {
          decision: string
          decision_id: string
          match_created: boolean
          match_id: string
          matched: boolean
        }[]
      }
      unblock_user: { Args: { p_target_user_id: string }; Returns: boolean }
      unmatch: {
        Args: { p_match_id: string }
        Returns: {
          created_at: string
          id: string
          unmatched_at: string | null
          unmatched_by: string | null
          user_high_id: string
          user_low_id: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
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
    Enums: {},
  },
} as const
