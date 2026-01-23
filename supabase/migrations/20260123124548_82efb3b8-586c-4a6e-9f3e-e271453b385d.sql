-- Create transactions table for tracking all wager-related transactions
CREATE TABLE public.wager_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id uuid REFERENCES public.wagers(id) ON DELETE CASCADE NOT NULL,
  tx_type text NOT NULL CHECK (tx_type IN ('escrow_deposit', 'escrow_release', 'winner_payout', 'draw_refund', 'platform_fee')),
  wallet_address text NOT NULL,
  amount_lamports bigint NOT NULL,
  tx_signature text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wager_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Transactions are viewable by participants"
ON public.wager_transactions
FOR SELECT
USING (
  wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
  OR EXISTS (
    SELECT 1 FROM public.wagers w 
    WHERE w.id = wager_id 
    AND w.is_public = true
  )
);

CREATE POLICY "Service role can manage transactions"
ON public.wager_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX idx_wager_transactions_wager_id ON public.wager_transactions(wager_id);
CREATE INDEX idx_wager_transactions_wallet ON public.wager_transactions(wallet_address);

-- Enable realtime for transaction updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.wager_transactions;