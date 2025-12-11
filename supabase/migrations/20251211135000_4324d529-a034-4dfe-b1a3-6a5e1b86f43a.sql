-- Fix the trigger to properly detect service role connections
-- Service role connections don't have JWT claims, so we need a different check

CREATE OR REPLACE FUNCTION public.protect_wager_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text;
BEGIN
  -- Get the role from JWT claims, default to empty string if not set
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;
  
  -- Service role has jwt_role = 'service_role' OR the session is using service key (no JWT)
  -- When using service role key directly, there are no JWT claims at all
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    -- Allow all changes for service role
    RETURN NEW;
  END IF;
  
  -- For non-service-role requests, block modification of critical fields
  IF OLD.stake_lamports IS DISTINCT FROM NEW.stake_lamports THEN
    RAISE EXCEPTION 'Cannot modify stake_lamports from client';
  END IF;
  IF OLD.winner_wallet IS DISTINCT FROM NEW.winner_wallet THEN
    RAISE EXCEPTION 'Cannot modify winner_wallet from client';
  END IF;
  IF OLD.resolved_at IS DISTINCT FROM NEW.resolved_at THEN
    RAISE EXCEPTION 'Cannot modify resolved_at from client';
  END IF;
  IF OLD.player_a_wallet IS DISTINCT FROM NEW.player_a_wallet THEN
    RAISE EXCEPTION 'Cannot modify player_a_wallet from client';
  END IF;
  -- Prevent changing status to 'resolved' directly
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'resolved' THEN
    RAISE EXCEPTION 'Cannot set status to resolved from client';
  END IF;
  -- Prevent changing match_id
  IF OLD.match_id IS DISTINCT FROM NEW.match_id THEN
    RAISE EXCEPTION 'Cannot modify match_id from client';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create functions to update player stats (called from edge function)
CREATE OR REPLACE FUNCTION public.update_winner_stats(
  p_wallet text,
  p_earnings bigint,
  p_stake bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE players
  SET 
    total_wins = COALESCE(total_wins, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + p_earnings,
    total_wagered = COALESCE(total_wagered, 0) + p_stake,
    current_streak = COALESCE(current_streak, 0) + 1,
    best_streak = GREATEST(COALESCE(best_streak, 0), COALESCE(current_streak, 0) + 1)
  WHERE wallet_address = p_wallet;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_loser_stats(
  p_wallet text,
  p_stake bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE players
  SET 
    total_losses = COALESCE(total_losses, 0) + 1,
    total_wagered = COALESCE(total_wagered, 0) + p_stake,
    current_streak = 0
  WHERE wallet_address = p_wallet;
END;
$function$;