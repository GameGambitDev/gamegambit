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
      achievements: {
        Row: {
          achievement_type: string
          achievement_value: number | null
          created_at: string | null
          id: string
          nft_mint_address: string | null
          player_wallet: string
          unlocked_at: string | null
        }
        Insert: {
          achievement_type: string
          achievement_value?: number | null
          created_at?: string | null
          id?: string
          nft_mint_address?: string | null
          player_wallet: string
          unlocked_at?: string | null
        }
        Update: {
          achievement_type?: string
          achievement_value?: number | null
          created_at?: string | null
          id?: string
          nft_mint_address?: string | null
          player_wallet?: string
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achievements_nft_mint_address_fkey"
            columns: ["nft_mint_address"]
            isOneToOne: false
            referencedRelation: "nfts"
            referencedColumns: ["mint_address"]
          },
          {
            foreignKeyName: "achievements_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          performed_by: string
          wager_id: string | null
          wallet_address: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          performed_by: string
          wager_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          performed_by?: string
          wager_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notes: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          note: string
          player_wallet: string | null
          wager_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          note: string
          player_wallet?: string | null
          wager_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          note?: string
          player_wallet?: string | null
          wager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "admin_notes_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_sessions: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_activity: string
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          bio: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          is_banned: boolean
          last_login: string | null
          password_hash: string
          permissions: Json
          role: Database["public"]["Enums"]["admin_role"]
          two_factor_enabled: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_banned?: boolean
          last_login?: string | null
          password_hash: string
          permissions?: Json
          role?: Database["public"]["Enums"]["admin_role"]
          two_factor_enabled?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_banned?: boolean
          last_login?: string | null
          password_hash?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["admin_role"]
          two_factor_enabled?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      admin_wallet_bindings: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          is_primary: boolean
          last_verified: string | null
          updated_at: string
          verification_signature: string | null
          verified: boolean
          verified_at: string | null
          wallet_address: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          last_verified?: string | null
          updated_at?: string
          verification_signature?: string | null
          verified?: boolean
          verified_at?: string | null
          wallet_address: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          last_verified?: string | null
          updated_at?: string
          verification_signature?: string | null
          verified?: boolean
          verified_at?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_wallet_bindings_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      nfts: {
        Row: {
          attributes: Json | null
          created_at: string | null
          id: string
          image_uri: string | null
          lichess_game_id: string | null
          match_id: number | null
          metadata_uri: string | null
          mint_address: string
          minted_at: string | null
          name: string
          owner_wallet: string
          stake_amount: number | null
          tier: Database["public"]["Enums"]["nft_tier"]
          wager_id: string | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          id?: string
          image_uri?: string | null
          lichess_game_id?: string | null
          match_id?: number | null
          metadata_uri?: string | null
          mint_address: string
          minted_at?: string | null
          name: string
          owner_wallet: string
          stake_amount?: number | null
          tier: Database["public"]["Enums"]["nft_tier"]
          wager_id?: string | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          id?: string
          image_uri?: string | null
          lichess_game_id?: string | null
          match_id?: number | null
          metadata_uri?: string | null
          mint_address?: string
          minted_at?: string | null
          name?: string
          owner_wallet?: string
          stake_amount?: number | null
          tier?: Database["public"]["Enums"]["nft_tier"]
          wager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfts_owner_wallet_fkey"
            columns: ["owner_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "nfts_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          best_streak: number | null
          bio: string | null
          codm_username: string | null
          created_at: string | null
          current_streak: number | null
          flag_reason: string | null
          flagged_at: string | null
          flagged_by: string | null
          flagged_for_review: boolean | null
          id: number
          is_banned: boolean | null
          last_active: string | null
          lichess_access_token: string | null
          lichess_token_expires_at: string | null
          lichess_user_id: string | null
          lichess_username: string | null
          preferred_game: string | null
          pubg_username: string | null
          skill_rating: number | null
          total_earnings: number | null
          total_losses: number | null
          total_spent: number | null
          total_wins: number | null
          updated_at: string | null
          username: string | null
          verified: boolean | null
          wallet_address: string
          win_rate: number | null
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          best_streak?: number | null
          bio?: string | null
          codm_username?: string | null
          created_at?: string | null
          current_streak?: number | null
          flag_reason?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_for_review?: boolean | null
          id?: number
          is_banned?: boolean | null
          last_active?: string | null
          lichess_access_token?: string | null
          lichess_token_expires_at?: string | null
          lichess_user_id?: string | null
          lichess_username?: string | null
          preferred_game?: string | null
          pubg_username?: string | null
          skill_rating?: number | null
          total_earnings?: number | null
          total_losses?: number | null
          total_spent?: number | null
          total_wins?: number | null
          updated_at?: string | null
          username?: string | null
          verified?: boolean | null
          wallet_address: string
          win_rate?: number | null
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          best_streak?: number | null
          bio?: string | null
          codm_username?: string | null
          created_at?: string | null
          current_streak?: number | null
          flag_reason?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_for_review?: boolean | null
          id?: number
          is_banned?: boolean | null
          last_active?: string | null
          lichess_access_token?: string | null
          lichess_token_expires_at?: string | null
          lichess_user_id?: string | null
          lichess_username?: string | null
          preferred_game?: string | null
          pubg_username?: string | null
          skill_rating?: number | null
          total_earnings?: number | null
          total_losses?: number | null
          total_spent?: number | null
          total_wins?: number | null
          updated_at?: string | null
          username?: string | null
          verified?: boolean | null
          wallet_address?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      rate_limit_logs: {
        Row: {
          created_at: string | null
          endpoint: string
          id: number
          request_count: number | null
          wallet_address: string
          window_reset_at: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: number
          request_count?: number | null
          wallet_address: string
          window_reset_at: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: number
          request_count?: number | null
          wallet_address?: string
          window_reset_at?: string
        }
        Relationships: []
      }
      wager_transactions: {
        Row: {
          amount_lamports: number
          created_at: string | null
          error_message: string | null
          id: string
          status: Database["public"]["Enums"]["transaction_status"] | null
          tx_signature: string | null
          tx_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
          wager_id: string
          wallet_address: string
        }
        Insert: {
          amount_lamports: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          tx_signature?: string | null
          tx_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
          wager_id: string
          wallet_address: string
        }
        Update: {
          amount_lamports?: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          tx_signature?: string | null
          tx_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
          wager_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "wager_transactions_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wager_transactions_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      wagers: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          chess_clock_increment: number | null
          chess_clock_limit: number | null
          chess_rated: boolean | null
          countdown_started_at: string | null
          created_at: string | null
          deposit_player_a: boolean
          deposit_player_b: boolean
          game: Database["public"]["Enums"]["game_type"]
          id: string
          is_public: boolean | null
          lichess_game_id: string | null
          lichess_url_black: string | null
          lichess_url_white: string | null
          match_id: number
          player_a_wallet: string
          player_b_wallet: string | null
          ready_player_a: boolean | null
          ready_player_b: boolean | null
          requires_moderator: boolean | null
          resolved_at: string | null
          retract_deadline: string | null
          stake_lamports: number
          status: Database["public"]["Enums"]["wager_status"] | null
          stream_url: string | null
          tx_signature_a: string | null
          tx_signature_b: string | null
          updated_at: string | null
          vote_player_a: string | null
          vote_player_b: string | null
          vote_timestamp: string | null
          winner_wallet: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          chess_clock_increment?: number | null
          chess_clock_limit?: number | null
          chess_rated?: boolean | null
          countdown_started_at?: string | null
          created_at?: string | null
          deposit_player_a?: boolean
          deposit_player_b?: boolean
          game: Database["public"]["Enums"]["game_type"]
          id?: string
          is_public?: boolean | null
          lichess_game_id?: string | null
          lichess_url_black?: string | null
          lichess_url_white?: string | null
          match_id?: number
          player_a_wallet: string
          player_b_wallet?: string | null
          ready_player_a?: boolean | null
          ready_player_b?: boolean | null
          requires_moderator?: boolean | null
          resolved_at?: string | null
          retract_deadline?: string | null
          stake_lamports: number
          status?: Database["public"]["Enums"]["wager_status"] | null
          stream_url?: string | null
          tx_signature_a?: string | null
          tx_signature_b?: string | null
          updated_at?: string | null
          vote_player_a?: string | null
          vote_player_b?: string | null
          vote_timestamp?: string | null
          winner_wallet?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          chess_clock_increment?: number | null
          chess_clock_limit?: number | null
          chess_rated?: boolean | null
          countdown_started_at?: string | null
          created_at?: string | null
          deposit_player_a?: boolean
          deposit_player_b?: boolean
          game?: Database["public"]["Enums"]["game_type"]
          id?: string
          is_public?: boolean | null
          lichess_game_id?: string | null
          lichess_url_black?: string | null
          lichess_url_white?: string | null
          match_id?: number
          player_a_wallet?: string
          player_b_wallet?: string | null
          ready_player_a?: boolean | null
          ready_player_b?: boolean | null
          requires_moderator?: boolean | null
          resolved_at?: string | null
          retract_deadline?: string | null
          stake_lamports?: number
          status?: Database["public"]["Enums"]["wager_status"] | null
          stream_url?: string | null
          tx_signature_a?: string | null
          tx_signature_b?: string | null
          updated_at?: string | null
          vote_player_a?: string | null
          vote_player_b?: string | null
          vote_timestamp?: string | null
          winner_wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wagers_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "wagers_player_a_wallet_fkey"
            columns: ["player_a_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "wagers_player_b_wallet_fkey"
            columns: ["player_b_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "wagers_winner_wallet_fkey"
            columns: ["winner_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_player_ready: {
        Args: { p_is_player_a: boolean; p_ready: boolean; p_wager_id: string }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          chess_clock_increment: number | null
          chess_clock_limit: number | null
          chess_rated: boolean | null
          countdown_started_at: string | null
          created_at: string | null
          deposit_player_a: boolean
          deposit_player_b: boolean
          game: Database["public"]["Enums"]["game_type"]
          id: string
          is_public: boolean | null
          lichess_game_id: string | null
          lichess_url_black: string | null
          lichess_url_white: string | null
          match_id: number
          player_a_wallet: string
          player_b_wallet: string | null
          ready_player_a: boolean | null
          ready_player_b: boolean | null
          requires_moderator: boolean | null
          resolved_at: string | null
          retract_deadline: string | null
          stake_lamports: number
          status: Database["public"]["Enums"]["wager_status"] | null
          stream_url: string | null
          tx_signature_a: string | null
          tx_signature_b: string | null
          updated_at: string | null
          vote_player_a: string | null
          vote_player_b: string | null
          vote_timestamp: string | null
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "wagers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_loser_stats: {
        Args: { p_stake: number; p_wallet: string }
        Returns: undefined
      }
      update_winner_stats: {
        Args: { p_earnings: number; p_stake: number; p_wallet: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_role: "moderator" | "admin" | "superadmin"
      game_type: "chess" | "codm" | "pubg"
      nft_tier: "bronze" | "silver" | "gold" | "diamond"
      transaction_status: "pending" | "confirmed" | "failed"
      transaction_type:
        | "escrow_deposit"
        | "escrow_release"
        | "winner_payout"
        | "draw_refund"
        | "platform_fee"
        | "cancelled"
        | "cancel_refund"
        | "error_on_chain_resolve"
        | "error_resolution_call"
        | "error_on_chain_draw_refund"
        | "error_on_chain_cancel_refund"
        | "moderator_fee"
        | "error_cancel_refund"
      wager_status:
        | "created"
        | "joined"
        | "voting"
        | "retractable"
        | "disputed"
        | "resolved"
        | "cancelled"
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
      admin_role: ["moderator", "admin", "superadmin"],
      game_type: ["chess", "codm", "pubg"],
      nft_tier: ["bronze", "silver", "gold", "diamond"],
      transaction_status: ["pending", "confirmed", "failed"],
      transaction_type: [
        "escrow_deposit",
        "escrow_release",
        "winner_payout",
        "draw_refund",
        "platform_fee",
        "cancelled",
        "cancel_refund",
        "error_on_chain_resolve",
        "error_resolution_call",
        "error_on_chain_draw_refund",
        "error_on_chain_cancel_refund",
        "moderator_fee",
        "error_cancel_refund",
      ],
      wager_status: [
        "created",
        "joined",
        "voting",
        "retractable",
        "disputed",
        "resolved",
        "cancelled",
      ],
    },
  },
} as const
