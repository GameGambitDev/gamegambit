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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      players: {
        Row: {
          ban_expires_at: string | null
          best_streak: number | null
          codm_username: string | null
          created_at: string
          current_streak: number | null
          id: string
          is_banned: boolean | null
          last_active: string | null
          lichess_username: string | null
          pubg_username: string | null
          total_earnings: number | null
          total_losses: number | null
          total_wagered: number | null
          total_wins: number | null
          updated_at: string
          username: string | null
          wallet_address: string
        }
        Insert: {
          ban_expires_at?: string | null
          best_streak?: number | null
          codm_username?: string | null
          created_at?: string
          current_streak?: number | null
          id?: string
          is_banned?: boolean | null
          last_active?: string | null
          lichess_username?: string | null
          pubg_username?: string | null
          total_earnings?: number | null
          total_losses?: number | null
          total_wagered?: number | null
          total_wins?: number | null
          updated_at?: string
          username?: string | null
          wallet_address: string
        }
        Update: {
          ban_expires_at?: string | null
          best_streak?: number | null
          codm_username?: string | null
          created_at?: string
          current_streak?: number | null
          id?: string
          is_banned?: boolean | null
          last_active?: string | null
          lichess_username?: string | null
          pubg_username?: string | null
          total_earnings?: number | null
          total_losses?: number | null
          total_wagered?: number | null
          total_wins?: number | null
          updated_at?: string
          username?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      wagers: {
        Row: {
          countdown_started_at: string | null
          created_at: string
          game: Database["public"]["Enums"]["game_type"]
          id: string
          is_public: boolean | null
          lichess_game_id: string | null
          match_id: number
          player_a_wallet: string
          player_b_wallet: string | null
          ready_player_a: boolean | null
          ready_player_b: boolean | null
          requires_moderator: boolean | null
          resolved_at: string | null
          retract_deadline: string | null
          stake_lamports: number
          status: Database["public"]["Enums"]["wager_status"]
          stream_url: string | null
          updated_at: string
          vote_player_a: string | null
          vote_player_b: string | null
          vote_timestamp: string | null
          winner_wallet: string | null
        }
        Insert: {
          countdown_started_at?: string | null
          created_at?: string
          game: Database["public"]["Enums"]["game_type"]
          id?: string
          is_public?: boolean | null
          lichess_game_id?: string | null
          match_id: number
          player_a_wallet: string
          player_b_wallet?: string | null
          ready_player_a?: boolean | null
          ready_player_b?: boolean | null
          requires_moderator?: boolean | null
          resolved_at?: string | null
          retract_deadline?: string | null
          stake_lamports: number
          status?: Database["public"]["Enums"]["wager_status"]
          stream_url?: string | null
          updated_at?: string
          vote_player_a?: string | null
          vote_player_b?: string | null
          vote_timestamp?: string | null
          winner_wallet?: string | null
        }
        Update: {
          countdown_started_at?: string | null
          created_at?: string
          game?: Database["public"]["Enums"]["game_type"]
          id?: string
          is_public?: boolean | null
          lichess_game_id?: string | null
          match_id?: number
          player_a_wallet?: string
          player_b_wallet?: string | null
          ready_player_a?: boolean | null
          ready_player_b?: boolean | null
          requires_moderator?: boolean | null
          resolved_at?: string | null
          retract_deadline?: string | null
          stake_lamports?: number
          status?: Database["public"]["Enums"]["wager_status"]
          stream_url?: string | null
          updated_at?: string
          vote_player_a?: string | null
          vote_player_b?: string | null
          vote_timestamp?: string | null
          winner_wallet?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      game_type: "chess" | "codm" | "pubg"
      wager_status:
        | "created"
        | "joined"
        | "voting"
        | "retractable"
        | "disputed"
        | "resolved"
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
      game_type: ["chess", "codm", "pubg"],
      wager_status: [
        "created",
        "joined",
        "voting",
        "retractable",
        "disputed",
        "resolved",
      ],
    },
  },
} as const
