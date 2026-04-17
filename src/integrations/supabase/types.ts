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
      moderation_requests: {
        Row: {
          assigned_at: string
          created_at: string
          deadline: string
          decided_at: string | null
          decision: string | null
          decision_deadline: string | null
          decision_notes: string | null
          id: string
          moderator_wallet: string
          request_type: string
          responded_at: string | null
          status: string
          wager_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          deadline: string
          decided_at?: string | null
          decision?: string | null
          decision_deadline?: string | null
          decision_notes?: string | null
          id?: string
          moderator_wallet: string
          request_type?: string
          responded_at?: string | null
          status?: string
          wager_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          deadline?: string
          decided_at?: string | null
          decision?: string | null
          decision_deadline?: string | null
          decision_notes?: string | null
          id?: string
          moderator_wallet?: string
          request_type?: string
          responded_at?: string | null
          status?: string
          wager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_requests_moderator_wallet_fkey"
            columns: ["moderator_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "moderation_requests_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
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
      notifications: {
        Row: {
          actor_wallet: string | null
          created_at: string | null
          id: string
          message: string
          player_wallet: string
          read: boolean | null
          title: string
          type: string
          wager_id: string | null
        }
        Insert: {
          actor_wallet?: string | null
          created_at?: string | null
          id?: string
          message: string
          player_wallet: string
          read?: boolean | null
          title: string
          type: string
          wager_id?: string | null
        }
        Update: {
          actor_wallet?: string | null
          created_at?: string | null
          id?: string
          message?: string
          player_wallet?: string
          read?: boolean | null
          title?: string
          type?: string
          wager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
            referencedColumns: ["id"]
          },
        ]
      }
      player_behaviour_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          notes: string | null
          player_wallet: string
          related_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          notes?: string | null
          player_wallet: string
          related_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
          player_wallet?: string
          related_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_behaviour_log_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      players: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          best_streak: number | null
          bio: string | null
          codm_player_id: string | null
          codm_username: string | null
          created_at: string | null
          current_streak: number | null
          false_claim_count: number
          false_vote_count: number
          flag_reason: string | null
          flagged_at: string | null
          flagged_by: string | null
          flagged_for_review: boolean | null
          free_fire_uid: string | null
          free_fire_username: string | null
          game_username_bound_at: Json | null
          id: number
          invite_code: string | null
          is_banned: boolean | null
          is_suspended: boolean
          last_active: string | null
          lichess_access_token: string | null
          lichess_token_expires_at: string | null
          lichess_user_id: string | null
          lichess_username: string | null
          moderation_requests_enabled: boolean
          moderator_abuse_count: number
          preferred_game: string | null
          pubg_player_id: string | null
          pubg_username: string | null
          push_notifications_enabled: boolean
          referral_count: number
          referred_by_wallet: string | null
          skill_rating: number | null
          suspension_ends_at: string | null
          total_earnings: number | null
          total_losses: number | null
          total_spent: number | null
          total_wagered: number
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
          codm_player_id?: string | null
          codm_username?: string | null
          created_at?: string | null
          current_streak?: number | null
          false_claim_count?: number
          false_vote_count?: number
          flag_reason?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_for_review?: boolean | null
          free_fire_uid?: string | null
          free_fire_username?: string | null
          game_username_bound_at?: Json | null
          id?: number
          invite_code?: string | null
          is_banned?: boolean | null
          is_suspended?: boolean
          last_active?: string | null
          lichess_access_token?: string | null
          lichess_token_expires_at?: string | null
          lichess_user_id?: string | null
          lichess_username?: string | null
          moderation_requests_enabled?: boolean
          moderator_abuse_count?: number
          preferred_game?: string | null
          pubg_player_id?: string | null
          pubg_username?: string | null
          push_notifications_enabled?: boolean
          referral_count?: number
          referred_by_wallet?: string | null
          skill_rating?: number | null
          suspension_ends_at?: string | null
          total_earnings?: number | null
          total_losses?: number | null
          total_spent?: number | null
          total_wagered?: number
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
          codm_player_id?: string | null
          codm_username?: string | null
          created_at?: string | null
          current_streak?: number | null
          false_claim_count?: number
          false_vote_count?: number
          flag_reason?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_for_review?: boolean | null
          free_fire_uid?: string | null
          free_fire_username?: string | null
          game_username_bound_at?: Json | null
          id?: number
          invite_code?: string | null
          is_banned?: boolean | null
          is_suspended?: boolean
          last_active?: string | null
          lichess_access_token?: string | null
          lichess_token_expires_at?: string | null
          lichess_user_id?: string | null
          lichess_username?: string | null
          moderation_requests_enabled?: boolean
          moderator_abuse_count?: number
          preferred_game?: string | null
          pubg_player_id?: string | null
          pubg_username?: string | null
          push_notifications_enabled?: boolean
          referral_count?: number
          referred_by_wallet?: string | null
          skill_rating?: number | null
          suspension_ends_at?: string | null
          total_earnings?: number | null
          total_losses?: number | null
          total_spent?: number | null
          total_wagered?: number
          total_wins?: number | null
          updated_at?: string | null
          username?: string | null
          verified?: boolean | null
          wallet_address?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      punishment_log: {
        Row: {
          created_at: string
          id: string
          issued_by: string
          notes: string | null
          offense_count: number
          offense_type: string
          player_wallet: string
          punishment: string
          punishment_ends_at: string | null
          wager_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          issued_by?: string
          notes?: string | null
          offense_count: number
          offense_type: string
          player_wallet: string
          punishment: string
          punishment_ends_at?: string | null
          wager_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          issued_by?: string
          notes?: string | null
          offense_count?: number
          offense_type?: string
          player_wallet?: string
          punishment?: string
          punishment_ends_at?: string | null
          wager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punishment_log_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "punishment_log_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          player_wallet: string
          updated_at: string | null
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          player_wallet: string
          updated_at?: string | null
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          player_wallet?: string
          updated_at?: string | null
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
      username_appeals: {
        Row: {
          admin_notes: string | null
          claimant_evidence_url: string | null
          claimant_wallet: string
          created_at: string
          game: string
          holder_evidence_url: string | null
          holder_responded_at: string | null
          holder_response: string | null
          holder_wallet: string
          id: string
          moderator_verdict: string | null
          moderator_wallet: string | null
          resolved_at: string | null
          response_deadline: string
          status: string
          username: string
        }
        Insert: {
          admin_notes?: string | null
          claimant_evidence_url?: string | null
          claimant_wallet: string
          created_at?: string
          game: string
          holder_evidence_url?: string | null
          holder_responded_at?: string | null
          holder_response?: string | null
          holder_wallet: string
          id?: string
          moderator_verdict?: string | null
          moderator_wallet?: string | null
          resolved_at?: string | null
          response_deadline: string
          status?: string
          username: string
        }
        Update: {
          admin_notes?: string | null
          claimant_evidence_url?: string | null
          claimant_wallet?: string
          created_at?: string
          game?: string
          holder_evidence_url?: string | null
          holder_responded_at?: string | null
          holder_response?: string | null
          holder_wallet?: string
          id?: string
          moderator_verdict?: string | null
          moderator_wallet?: string | null
          resolved_at?: string | null
          response_deadline?: string
          status?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "username_appeals_claimant_wallet_fkey"
            columns: ["claimant_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "username_appeals_holder_wallet_fkey"
            columns: ["holder_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "username_appeals_moderator_wallet_fkey"
            columns: ["moderator_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      username_change_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          game: string
          id: string
          new_username: string
          old_username: string
          player_wallet: string
          reason: string
          reason_category: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          game: string
          id?: string
          new_username: string
          old_username: string
          player_wallet: string
          reason: string
          reason_category: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          game?: string
          id?: string
          new_username?: string
          old_username?: string
          player_wallet?: string
          reason?: string
          reason_category?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "username_change_requests_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      wager_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          message_type: string | null
          proposal_data: Json | null
          proposal_status: string | null
          sender_wallet: string
          wager_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          message_type?: string | null
          proposal_data?: Json | null
          proposal_status?: string | null
          sender_wallet: string
          wager_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          message_type?: string | null
          proposal_data?: Json | null
          proposal_status?: string | null
          sender_wallet?: string
          wager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wager_messages_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
            referencedColumns: ["id"]
          },
        ]
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
          chess_side_preference: string | null
          countdown_started_at: string | null
          created_at: string | null
          deposit_player_a: boolean
          deposit_player_b: boolean
          dispute_created_at: string | null
          game: Database["public"]["Enums"]["game_type"]
          game_complete_a: boolean
          game_complete_a_at: string | null
          game_complete_b: boolean
          game_complete_b_at: string | null
          game_complete_deadline: string | null
          grace_conceded_at: string | null
          grace_conceded_by: string | null
          id: string
          is_public: boolean | null
          lichess_game_id: string | null
          lichess_url_black: string | null
          lichess_url_white: string | null
          match_id: number
          moderation_skipped_count: number
          moderator_assigned_at: string | null
          moderator_deadline: string | null
          moderator_decided_at: string | null
          moderator_decision: string | null
          moderator_wallet: string | null
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
          vote_a_at: string | null
          vote_b_at: string | null
          vote_deadline: string | null
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
          chess_side_preference?: string | null
          countdown_started_at?: string | null
          created_at?: string | null
          deposit_player_a?: boolean
          deposit_player_b?: boolean
          dispute_created_at?: string | null
          game: Database["public"]["Enums"]["game_type"]
          game_complete_a?: boolean
          game_complete_a_at?: string | null
          game_complete_b?: boolean
          game_complete_b_at?: string | null
          game_complete_deadline?: string | null
          grace_conceded_at?: string | null
          grace_conceded_by?: string | null
          id?: string
          is_public?: boolean | null
          lichess_game_id?: string | null
          lichess_url_black?: string | null
          lichess_url_white?: string | null
          match_id?: number
          moderation_skipped_count?: number
          moderator_assigned_at?: string | null
          moderator_deadline?: string | null
          moderator_decided_at?: string | null
          moderator_decision?: string | null
          moderator_wallet?: string | null
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
          vote_a_at?: string | null
          vote_b_at?: string | null
          vote_deadline?: string | null
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
          chess_side_preference?: string | null
          countdown_started_at?: string | null
          created_at?: string | null
          deposit_player_a?: boolean
          deposit_player_b?: boolean
          dispute_created_at?: string | null
          game?: Database["public"]["Enums"]["game_type"]
          game_complete_a?: boolean
          game_complete_a_at?: string | null
          game_complete_b?: boolean
          game_complete_b_at?: string | null
          game_complete_deadline?: string | null
          grace_conceded_at?: string | null
          grace_conceded_by?: string | null
          id?: string
          is_public?: boolean | null
          lichess_game_id?: string | null
          lichess_url_black?: string | null
          lichess_url_white?: string | null
          match_id?: number
          moderation_skipped_count?: number
          moderator_assigned_at?: string | null
          moderator_deadline?: string | null
          moderator_decided_at?: string | null
          moderator_decision?: string | null
          moderator_wallet?: string | null
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
          vote_a_at?: string | null
          vote_b_at?: string | null
          vote_deadline?: string | null
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
            foreignKeyName: "wagers_grace_conceded_by_fkey"
            columns: ["grace_conceded_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "wagers_moderator_wallet_fkey"
            columns: ["moderator_wallet"]
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
      feed_reactions: {
        Row: {
          id: string
          wager_id: string
          wallet: string
          reaction_type: 'fire' | 'skull' | 'goat' | 'eyes'
          created_at: string
        }
        Insert: {
          id?: string
          wager_id: string
          wallet: string
          reaction_type: 'fire' | 'skull' | 'goat' | 'eyes'
          created_at?: string
        }
        Update: {
          id?: string
          wager_id?: string
          wallet?: string
          reaction_type?: 'fire' | 'skull' | 'goat' | 'eyes'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reactions_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          id: string
          requester_wallet: string
          recipient_wallet: string
          status: 'pending' | 'accepted' | 'blocked'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_wallet: string
          recipient_wallet: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requester_wallet?: string
          recipient_wallet?: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          id: string
          channel_id: string
          sender_wallet: string
          message: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          sender_wallet: string
          message: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          channel_id?: string
          sender_wallet?: string
          message?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      spectator_bets: {
        Row: {
          id: string
          wager_id: string
          bettor_wallet: string
          backer_wallet: string | null
          backed_player: 'player_a' | 'player_b'
          amount_lamports: number
          status: 'open' | 'countered' | 'matched' | 'expired' | 'resolved' | 'cancelled'
          counter_amount: number | null
          tx_signature: string | null
          created_at: string
          matched_at: string | null
          expires_at: string | null
          resolved_at: string | null
        }
        Insert: {
          id?: string
          wager_id: string
          bettor_wallet: string
          backer_wallet?: string | null
          backed_player: 'player_a' | 'player_b'
          amount_lamports: number
          status?: 'open' | 'countered' | 'matched' | 'expired' | 'resolved' | 'cancelled'
          counter_amount?: number | null
          tx_signature?: string | null
          created_at?: string
          matched_at?: string | null
          expires_at?: string | null
          resolved_at?: string | null
        }
        Update: {
          id?: string
          wager_id?: string
          bettor_wallet?: string
          backer_wallet?: string | null
          backed_player?: 'player_a' | 'player_b'
          amount_lamports?: number
          status?: 'open' | 'countered' | 'matched' | 'expired' | 'resolved' | 'cancelled'
          counter_amount?: number | null
          tx_signature?: string | null
          created_at?: string
          matched_at?: string | null
          expires_at?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spectator_bets_wager_id_fkey"
            columns: ["wager_id"]
            isOneToOne: false
            referencedRelation: "wagers"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          id: string
          follower_wallet: string
          following_wallet: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_wallet: string
          following_wallet: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_wallet?: string
          following_wallet?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      merge_game_bound_at: {
        Args: { p_game: string; p_ts: string; p_wallet: string }
        Returns: undefined
      }
      set_player_ready: {
        Args: { p_is_player_a: boolean; p_ready: boolean; p_wager_id: string }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          chess_clock_increment: number | null
          chess_clock_limit: number | null
          chess_rated: boolean | null
          chess_side_preference: string | null
          countdown_started_at: string | null
          created_at: string | null
          deposit_player_a: boolean
          deposit_player_b: boolean
          dispute_created_at: string | null
          game: Database["public"]["Enums"]["game_type"]
          game_complete_a: boolean
          game_complete_a_at: string | null
          game_complete_b: boolean
          game_complete_b_at: string | null
          game_complete_deadline: string | null
          grace_conceded_at: string | null
          grace_conceded_by: string | null
          id: string
          is_public: boolean | null
          lichess_game_id: string | null
          lichess_url_black: string | null
          lichess_url_white: string | null
          match_id: number
          moderation_skipped_count: number
          moderator_assigned_at: string | null
          moderator_deadline: string | null
          moderator_decided_at: string | null
          moderator_decision: string | null
          moderator_wallet: string | null
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
          vote_a_at: string | null
          vote_b_at: string | null
          vote_deadline: string | null
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
      game_type: "chess" | "codm" | "pubg" | "free_fire"
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
      game_type: ["chess", "codm", "pubg", "free_fire"],
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