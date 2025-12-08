-- SECURITY FIX: Protect sensitive player fields from client-side modification
-- Only the service role (backend functions) can modify these fields

-- Create a function to protect sensitive player fields
CREATE OR REPLACE FUNCTION public.protect_player_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the request is coming from service role (backend)
  -- Service role requests have the role claim set to 'service_role'
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    -- Block modification of sensitive fields for non-service-role requests
    IF OLD.total_wins IS DISTINCT FROM NEW.total_wins THEN
      RAISE EXCEPTION 'Cannot modify total_wins from client';
    END IF;
    IF OLD.total_losses IS DISTINCT FROM NEW.total_losses THEN
      RAISE EXCEPTION 'Cannot modify total_losses from client';
    END IF;
    IF OLD.total_earnings IS DISTINCT FROM NEW.total_earnings THEN
      RAISE EXCEPTION 'Cannot modify total_earnings from client';
    END IF;
    IF OLD.total_wagered IS DISTINCT FROM NEW.total_wagered THEN
      RAISE EXCEPTION 'Cannot modify total_wagered from client';
    END IF;
    IF OLD.current_streak IS DISTINCT FROM NEW.current_streak THEN
      RAISE EXCEPTION 'Cannot modify current_streak from client';
    END IF;
    IF OLD.best_streak IS DISTINCT FROM NEW.best_streak THEN
      RAISE EXCEPTION 'Cannot modify best_streak from client';
    END IF;
    IF OLD.is_banned IS DISTINCT FROM NEW.is_banned THEN
      RAISE EXCEPTION 'Cannot modify is_banned from client';
    END IF;
    IF OLD.ban_expires_at IS DISTINCT FROM NEW.ban_expires_at THEN
      RAISE EXCEPTION 'Cannot modify ban_expires_at from client';
    END IF;
    -- Also prevent changing wallet_address
    IF OLD.wallet_address IS DISTINCT FROM NEW.wallet_address THEN
      RAISE EXCEPTION 'Cannot modify wallet_address';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS protect_player_fields ON public.players;
CREATE TRIGGER protect_player_fields
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_player_sensitive_fields();

-- SECURITY FIX: Protect sensitive wager fields from client-side modification
CREATE OR REPLACE FUNCTION public.protect_wager_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the request is coming from service role (backend)
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    -- Block modification of critical fields
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
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS protect_wager_fields ON public.wagers;
CREATE TRIGGER protect_wager_fields
  BEFORE UPDATE ON public.wagers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_wager_sensitive_fields();

-- SECURITY FIX: Validate player creation
CREATE OR REPLACE FUNCTION public.validate_player_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure sensitive fields start at safe defaults
  NEW.total_wins := COALESCE(NEW.total_wins, 0);
  NEW.total_losses := COALESCE(NEW.total_losses, 0);
  NEW.total_earnings := COALESCE(NEW.total_earnings, 0);
  NEW.total_wagered := COALESCE(NEW.total_wagered, 0);
  NEW.current_streak := COALESCE(NEW.current_streak, 0);
  NEW.best_streak := COALESCE(NEW.best_streak, 0);
  NEW.is_banned := false;
  NEW.ban_expires_at := NULL;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_player_insert ON public.players;
CREATE TRIGGER validate_player_insert
  BEFORE INSERT ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_player_insert();

-- SECURITY FIX: Validate wager creation
CREATE OR REPLACE FUNCTION public.validate_wager_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure wagers start with safe defaults
  NEW.status := 'created';
  NEW.winner_wallet := NULL;
  NEW.resolved_at := NULL;
  NEW.vote_player_a := NULL;
  NEW.vote_player_b := NULL;
  NEW.vote_timestamp := NULL;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_wager_insert ON public.wagers;
CREATE TRIGGER validate_wager_insert
  BEFORE INSERT ON public.wagers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wager_insert();