-- Fix RLS policies to be permissive (USING instead of RESTRICTIVE)
-- Drop and recreate NFTs policies
DROP POLICY IF EXISTS "NFTs are viewable by everyone" ON public.nfts;
DROP POLICY IF EXISTS "Service role can insert NFTs" ON public.nfts;

CREATE POLICY "NFTs are viewable by everyone" 
ON public.nfts 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can insert NFTs" 
ON public.nfts 
FOR INSERT 
WITH CHECK (true);

-- Drop and recreate achievements policies
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON public.achievements;
DROP POLICY IF EXISTS "Service role can insert achievements" ON public.achievements;
DROP POLICY IF EXISTS "Service role can update achievements" ON public.achievements;

CREATE POLICY "Achievements are viewable by everyone" 
ON public.achievements 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can insert achievements" 
ON public.achievements 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can update achievements" 
ON public.achievements 
FOR UPDATE 
USING (true);