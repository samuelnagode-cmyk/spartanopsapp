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
      event_cancellations: {
        Row: {
          cancelled_at: string
          event_id: string
        }
        Insert: {
          cancelled_at?: string
          event_id: string
        }
        Update: {
          cancelled_at?: string
          event_id?: string
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          avatar_id: string
          created_at: string
          email_or_phone: string
          event_id: string
          full_name: string
          id: string
          loadout_role: string
          public_callsign: string
          wants_food: boolean
        }
        Insert: {
          avatar_id: string
          created_at?: string
          email_or_phone: string
          event_id: string
          full_name: string
          id?: string
          loadout_role: string
          public_callsign: string
          wants_food?: boolean
        }
        Update: {
          avatar_id?: string
          created_at?: string
          email_or_phone?: string
          event_id?: string
          full_name?: string
          id?: string
          loadout_role?: string
          public_callsign?: string
          wants_food?: boolean
        }
        Relationships: []
      }
      events: {
        Row: {
          category: string
          created_at: string
          date: string
          description_en: string
          description_sl: string
          details_en: string | null
          details_sl: string | null
          icon: string
          id: string
          image_url: string | null
          location: string | null
          note_en: string | null
          note_sl: string | null
          registration_en: string | null
          registration_sl: string | null
          title_en: string
          title_sl: string
          tone: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          date: string
          description_en: string
          description_sl: string
          details_en?: string | null
          details_sl?: string | null
          icon?: string
          id?: string
          image_url?: string | null
          location?: string | null
          note_en?: string | null
          note_sl?: string | null
          registration_en?: string | null
          registration_sl?: string | null
          title_en: string
          title_sl: string
          tone?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          description_en?: string
          description_sl?: string
          details_en?: string | null
          details_sl?: string | null
          icon?: string
          id?: string
          image_url?: string | null
          location?: string | null
          note_en?: string | null
          note_sl?: string | null
          registration_en?: string | null
          registration_sl?: string | null
          title_en?: string
          title_sl?: string
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      registrations: {
        Row: {
          avatar: string
          callsign: string | null
          cancel_token: string
          confirmation_token: string
          confirmed_at: string | null
          created_at: string
          email: string | null
          email_phone: string | null
          event_end: string | null
          event_id: string | null
          event_title: string
          experience_level: string
          first_name: string | null
          full_name: string | null
          gear_type: string
          id: string
          is_confirmed: boolean
          last_initial: string | null
          marketing_opt_in: boolean
          meal: string
          team_club: string | null
        }
        Insert: {
          avatar: string
          callsign?: string | null
          cancel_token?: string
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          email?: string | null
          email_phone?: string | null
          event_end?: string | null
          event_id?: string | null
          event_title: string
          experience_level?: string
          first_name?: string | null
          full_name?: string | null
          gear_type: string
          id?: string
          is_confirmed?: boolean
          last_initial?: string | null
          marketing_opt_in?: boolean
          meal: string
          team_club?: string | null
        }
        Update: {
          avatar?: string
          callsign?: string | null
          cancel_token?: string
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          email?: string | null
          email_phone?: string | null
          event_end?: string | null
          event_id?: string | null
          event_title?: string
          experience_level?: string
          first_name?: string | null
          full_name?: string | null
          gear_type?: string
          id?: string
          is_confirmed?: boolean
          last_initial?: string | null
          marketing_opt_in?: boolean
          meal?: string
          team_club?: string | null
        }
        Relationships: []
      }
      spartanops_archived_missions: {
        Row: {
          capture_count: number
          city: string | null
          countdown_seconds: number | null
          country: string | null
          decommissioned_at: string
          event_name: string | null
          field_name: string
          final_scores: Json
          gamemode: string | null
          id: string
          lobby_created_at: string | null
          lobby_id: string
          location: string | null
          map_url: string | null
          match_duration_minutes: number | null
          mission_state: string | null
          node_positions: Json
          player_count: number
          point_target: number | null
          settings: Json
          started_at: string | null
          updated_at: string
          winner_team: string | null
        }
        Insert: {
          capture_count?: number
          city?: string | null
          countdown_seconds?: number | null
          country?: string | null
          decommissioned_at?: string
          event_name?: string | null
          field_name: string
          final_scores?: Json
          gamemode?: string | null
          id?: string
          lobby_created_at?: string | null
          lobby_id: string
          location?: string | null
          map_url?: string | null
          match_duration_minutes?: number | null
          mission_state?: string | null
          node_positions?: Json
          player_count?: number
          point_target?: number | null
          settings?: Json
          started_at?: string | null
          updated_at?: string
          winner_team?: string | null
        }
        Update: {
          capture_count?: number
          city?: string | null
          countdown_seconds?: number | null
          country?: string | null
          decommissioned_at?: string
          event_name?: string | null
          field_name?: string
          final_scores?: Json
          gamemode?: string | null
          id?: string
          lobby_created_at?: string | null
          lobby_id?: string
          location?: string | null
          map_url?: string | null
          match_duration_minutes?: number | null
          mission_state?: string | null
          node_positions?: Json
          player_count?: number
          point_target?: number | null
          settings?: Json
          started_at?: string | null
          updated_at?: string
          winner_team?: string | null
        }
        Relationships: []
      }
      spartanops_captures: {
        Row: {
          captured_at: string
          distance_m: number | null
          field_id: string
          id: string
          latitude: number | null
          longitude: number | null
          player_callsign: string | null
          player_checkin_id: string | null
          point_number: number
          spartacus_status: string
          suspicious: boolean
          team: string
        }
        Insert: {
          captured_at?: string
          distance_m?: number | null
          field_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          player_callsign?: string | null
          player_checkin_id?: string | null
          point_number: number
          spartacus_status?: string
          suspicious?: boolean
          team: string
        }
        Update: {
          captured_at?: string
          distance_m?: number | null
          field_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          player_callsign?: string | null
          player_checkin_id?: string | null
          point_number?: number
          spartacus_status?: string
          suspicious?: boolean
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "spartanops_captures_player_checkin_id_fkey"
            columns: ["player_checkin_id"]
            isOneToOne: false
            referencedRelation: "spartanops_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      spartanops_checkin_secrets: {
        Row: {
          checkin_id: string
          club: string | null
          created_at: string
          first_name: string | null
          last_initial: string | null
          phone_number: string | null
          respawn_unlock_at: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          checkin_id: string
          club?: string | null
          created_at?: string
          first_name?: string | null
          last_initial?: string | null
          phone_number?: string | null
          respawn_unlock_at?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          checkin_id?: string
          club?: string | null
          created_at?: string
          first_name?: string | null
          last_initial?: string | null
          phone_number?: string | null
          respawn_unlock_at?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spartanops_checkin_secrets_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: true
            referencedRelation: "spartanops_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      spartanops_checkins: {
        Row: {
          assigned_team: string
          callsign: string
          created_at: string
          death_count: number
          experience_level: string
          field_id: string
          id: string
          operator_type: string | null
          team_changed_flag: boolean
          warning_message: string | null
        }
        Insert: {
          assigned_team?: string
          callsign: string
          created_at?: string
          death_count?: number
          experience_level?: string
          field_id?: string
          id?: string
          operator_type?: string | null
          team_changed_flag?: boolean
          warning_message?: string | null
        }
        Update: {
          assigned_team?: string
          callsign?: string
          created_at?: string
          death_count?: number
          experience_level?: string
          field_id?: string
          id?: string
          operator_type?: string | null
          team_changed_flag?: boolean
          warning_message?: string | null
        }
        Relationships: []
      }
      spartanops_field_secrets: {
        Row: {
          field_id: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          field_id: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          field_id?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      spartanops_game_state: {
        Row: {
          compressed_map_url: string | null
          countdown_seconds: number
          current_polygon_name: string | null
          event_name: string | null
          field_id: string
          field_label: string | null
          gamemode: string
          id: string
          match_duration_minutes: number
          match_started_at: string | null
          node_holders: Json
          node_positions: Json
          point_target: number
          score_ticked_at: string | null
          settings: Json
          status: string
          team_scores: Json
          team_selection_open: boolean
          updated_at: string
          winner_team: string | null
        }
        Insert: {
          compressed_map_url?: string | null
          countdown_seconds?: number
          current_polygon_name?: string | null
          event_name?: string | null
          field_id: string
          field_label?: string | null
          gamemode?: string
          id?: string
          match_duration_minutes?: number
          match_started_at?: string | null
          node_holders?: Json
          node_positions?: Json
          point_target?: number
          score_ticked_at?: string | null
          settings?: Json
          status?: string
          team_scores?: Json
          team_selection_open?: boolean
          updated_at?: string
          winner_team?: string | null
        }
        Update: {
          compressed_map_url?: string | null
          countdown_seconds?: number
          current_polygon_name?: string | null
          event_name?: string | null
          field_id?: string
          field_label?: string | null
          gamemode?: string
          id?: string
          match_duration_minutes?: number
          match_started_at?: string | null
          node_holders?: Json
          node_positions?: Json
          point_target?: number
          score_ticked_at?: string | null
          settings?: Json
          status?: string
          team_scores?: Json
          team_selection_open?: boolean
          updated_at?: string
          winner_team?: string | null
        }
        Relationships: []
      }
      spartanops_lobbies: {
        Row: {
          city: string | null
          countdown_seconds: number
          country: string | null
          created_at: string
          event_name: string | null
          field_name: string
          gamemode: string
          id: string
          location: string
          map_url: string | null
          marshal_password_hash: string | null
          match_duration_minutes: number
          node_positions: Json
          password_hash: string
          point_target: number
          published: boolean
          settings: Json
          started_at: string | null
          state: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          countdown_seconds?: number
          country?: string | null
          created_at?: string
          event_name?: string | null
          field_name: string
          gamemode?: string
          id?: string
          location?: string
          map_url?: string | null
          marshal_password_hash?: string | null
          match_duration_minutes?: number
          node_positions?: Json
          password_hash: string
          point_target?: number
          published?: boolean
          settings?: Json
          started_at?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          countdown_seconds?: number
          country?: string | null
          created_at?: string
          event_name?: string | null
          field_name?: string
          gamemode?: string
          id?: string
          location?: string
          map_url?: string | null
          marshal_password_hash?: string | null
          match_duration_minutes?: number
          node_positions?: Json
          password_hash?: string
          point_target?: number
          published?: boolean
          settings?: Json
          started_at?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      spartanops_qr_anchors: {
        Row: {
          anchor_accuracy_m: number | null
          anchored_at: string
          anchored_by_callsign: string | null
          field_id: string
          latitude: number
          longitude: number
          point_number: number
        }
        Insert: {
          anchor_accuracy_m?: number | null
          anchored_at?: string
          anchored_by_callsign?: string | null
          field_id: string
          latitude: number
          longitude: number
          point_number: number
        }
        Update: {
          anchor_accuracy_m?: number | null
          anchored_at?: string
          anchored_by_callsign?: string | null
          field_id?: string
          latitude?: number
          longitude?: number
          point_number?: number
        }
        Relationships: []
      }
    }
    Views: {
      event_registrations_public: {
        Row: {
          avatar_id: string | null
          created_at: string | null
          event_id: string | null
          id: string | null
          loadout_role: string | null
          public_callsign: string | null
          wants_food: boolean | null
        }
        Insert: {
          avatar_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string | null
          loadout_role?: string | null
          public_callsign?: string | null
          wants_food?: boolean | null
        }
        Update: {
          avatar_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string | null
          loadout_role?: string | null
          public_callsign?: string | null
          wants_food?: boolean | null
        }
        Relationships: []
      }
      registrations_public: {
        Row: {
          avatar: string | null
          callsign: string | null
          created_at: string | null
          event_id: string | null
          experience_level: string | null
          first_name: string | null
          gear_type: string | null
          id: string | null
          last_initial: string | null
          team_club: string | null
        }
        Insert: {
          avatar?: string | null
          callsign?: string | null
          created_at?: string | null
          event_id?: string | null
          experience_level?: string | null
          first_name?: string | null
          gear_type?: string | null
          id?: string | null
          last_initial?: string | null
          team_club?: string | null
        }
        Update: {
          avatar?: string | null
          callsign?: string | null
          created_at?: string | null
          event_id?: string | null
          experience_level?: string | null
          first_name?: string | null
          gear_type?: string | null
          id?: string | null
          last_initial?: string | null
          team_club?: string | null
        }
        Relationships: []
      }
      spartanops_lobbies_public: {
        Row: {
          city: string | null
          countdown_seconds: number | null
          country: string | null
          created_at: string | null
          event_name: string | null
          field_name: string | null
          gamemode: string | null
          id: string | null
          location: string | null
          map_url: string | null
          match_duration_minutes: number | null
          node_positions: Json | null
          point_target: number | null
          published: boolean | null
          settings: Json | null
          started_at: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          countdown_seconds?: number | null
          country?: string | null
          created_at?: string | null
          event_name?: string | null
          field_name?: string | null
          gamemode?: string | null
          id?: string | null
          location?: string | null
          map_url?: string | null
          match_duration_minutes?: number | null
          node_positions?: Json | null
          point_target?: number | null
          published?: boolean | null
          settings?: Json | null
          started_at?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          countdown_seconds?: number | null
          country?: string | null
          created_at?: string | null
          event_name?: string | null
          field_name?: string | null
          gamemode?: string | null
          id?: string | null
          location?: string | null
          map_url?: string | null
          match_duration_minutes?: number | null
          node_positions?: Json | null
          point_target?: number | null
          published?: boolean | null
          settings?: Json | null
          started_at?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      spartanops_acknowledge_team_change: {
        Args: { p_field_id: string; p_session_id: string }
        Returns: undefined
      }
      spartanops_apply_capture: {
        Args: { p_field_id: string; p_point: number; p_session_id: string }
        Returns: Json
      }
      spartanops_delete_lobby: {
        Args: { p_lobby_id: string }
        Returns: undefined
      }
      spartanops_delete_lobby_players: {
        Args: { p_lobby_id: string }
        Returns: undefined
      }
      spartanops_get_field_map: {
        Args: {
          p_field_id: string
          p_marshal_password?: string
          p_session_id?: string
        }
        Returns: string
      }
      spartanops_get_suspicious_captures: {
        Args: { p_field_id: string; p_marshal_password: string }
        Returns: {
          captured_at: string
          distance_m: number
          id: string
          latitude: number
          longitude: number
          player_callsign: string
          point_number: number
          spartacus_status: string
          team: string
        }[]
      }
      spartanops_hash_password: {
        Args: { p_password: string }
        Returns: string
      }
      spartanops_reset_match_runtime: {
        Args: { p_field_id: string }
        Returns: undefined
      }
      spartanops_tick_scores: { Args: { p_field_id: string }; Returns: Json }
      spartanops_verify_lobby_password: {
        Args: { p_kind: string; p_lobby_id: string; p_password: string }
        Returns: boolean
      }
      verify_field_password: {
        Args: { p_field_id: string; p_password: string }
        Returns: boolean
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
