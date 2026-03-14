/**
 * useSolanaProgram.ts
 *
 * Mobile fixes:
 *  - PDA derivation uses Uint8Array/TextEncoder — Buffer is Node.js only and
 *    crashes in Phantom/Solflare mobile in-app browser.
 *  - buildInstructionData returns Buffer.from(Uint8Array) for TS compatibility
 *    with TransactionInstruction which expects Buffer type.
 *  - initPlayer sent as separate tx before create_wager (no batching).
 *  - skipPreflight:true for mobile RPC lag.
 *  - normalizeSolanaError logs RAW error before normalizing for debugging.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWalletAuth } from './useWalletAuth';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
} from '@/lib/solana-config';
import { toast } from 'sonner';

// ── PDA derivation — NO Buffer, uses Uint8Array only ─────────────────────────
// Buffer.from() crashes in Phantom/Solflare mobile in-app browser (Node.js only)

export function deriveWagerPda(playerA: PublicKey, matchId: bigint): [PublicKey, number] {
  const matchIdBuffer = new Uint8Array(8);
  new DataView(matchIdBuffer.buffer).setBigUint64(0, matchId, true); // little-endian
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('wager'), playerA.toBytes(), matchIdBuffer],
    new PublicKey(PROGRAM_ID)
  );
}

export function derivePlayerProfilePda(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('player'), player.toBytes()],
    new PublicKey(PROGRAM_ID)
  );
}

// ── Instruction data builder ──────────────────────────────────────────────────
// Builds as Uint8Array internally (mobile safe), wraps in Buffer.from() at the
// end because TransactionInstruction.data expects Buffer type in TypeScript.

function buildInstructionData(
  discriminator: readonly number[],
  ...args: (bigint | boolean | string | PublicKey)[]
): Buffer {
  const parts: Uint8Array[] = [new Uint8Array(discriminator as number[])];

  for (const arg of args) {
    if (typeof arg === 'bigint') {
      const buf = new Uint8Array(8);
      new DataView(buf.buffer).setBigUint64(0, arg, true);
      parts.push(buf);
    } else if (typeof arg === 'boolean') {
      parts.push(new Uint8Array([arg ? 1 : 0]));
    } else if (typeof arg === 'string') {
      const strBytes = new TextEncoder().encode(arg);
      const lenBuf = new Uint8Array(4);
      new DataView(lenBuf.buffer).setUint32(0, strBytes.length, true);
      parts.push(lenBuf, strBytes);
    } else if (arg instanceof PublicKey) {
      parts.push(arg.toBytes());
    }
  }

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return Buffer.from(result);
}

// ── Error normalizer — logs RAW error so you can debug, then shows clean msg ──

export function normalizeSolanaError(err: unknown): string {
  console.error('[SolanaError RAW]', err);

  if (!err) return 'Unknown error';
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes('user rejected') ||
    lower.includes('rejected the request') ||
    lower.includes('transaction cancelled') ||
    lower.includes('cancelled') ||
    lower.includes('denied') ||
    lower.includes('user declined')
  ) return 'Transaction cancelled — you rejected the wallet request.';

  if (lower.includes('insufficient') || lower.includes('not enough sol') || lower.includes('0x1'))
    return 'Insufficient SOL balance. Please top up your wallet and try again.';

  if (lower.includes('blockhash') || lower.includes('block height exceeded'))
    return 'Transaction expired. Please try again.';

  if (lower.includes('missing signature') || lower.includes('signature verification'))
    return 'Wallet signing failed. Please try again or reconnect your wallet.';

  if (lower.includes('already in use') || lower.includes('already deposited'))
    return 'already_deposited';

  return msg;
}

// ── Send tx via wallet adapter ────────────────────────────────────────────────

async function sendAndConfirmViaAdapter(
  instructions: TransactionInstruction | TransactionInstruction[],
  payer: PublicKey,
  sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>,
  connection: any,
): Promise<string> {
  const ixs = Array.isArray(instructions) ? instructions : [instructions];
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction();
  ixs.forEach(ix => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  const signature = await sendTransaction(tx, connection, {
    skipPreflight: true,
    preflightCommitment: 'confirmed',
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  return signature;
}

// ── Init player profile — separate tx, never batched ─────────────────────────

async function ensurePlayerProfileExists(
  player: PublicKey,
  sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>,
  connection: any,
): Promise<void> {
  const [profilePda] = derivePlayerProfilePda(player);

  let existing = null;
  try { existing = await connection.getAccountInfo(profilePda); } catch { /* ok */ }
  if (existing) return;

  toast.info('Creating your on-chain profile (one-time setup)…');

  const ix = new TransactionInstruction({
    programId: new PublicKey(PROGRAM_ID),
    keys: [
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(INSTRUCTION_DISCRIMINATORS.initialize_player as number[]),
  });

  try {
    await sendAndConfirmViaAdapter(ix, player, sendTransaction, connection);
    toast.success('Profile created!');
  } catch (err: unknown) {
    const normalized = normalizeSolanaError(err);
    if (!normalized.includes('already')) throw err;
  }
}

// ── 1. Initialize player profile ──────────────────────────────────────────────

export function useInitializePlayer() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');

      const [playerProfilePda] = derivePlayerProfilePda(publicKey);
      let existing = null;
      try { existing = await connection.getAccountInfo(playerProfilePda); } catch { /* ok */ }
      if (existing) return { alreadyExists: true, pda: playerProfilePda.toBase58() };

      const instruction = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
          { pubkey: playerProfilePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: buildInstructionData(INSTRUCTION_DISCRIMINATORS.initialize_player),
      });

      const signature = await sendAndConfirmViaAdapter(instruction, publicKey, sendTransaction, connection);
      return { alreadyExists: false, signature, pda: playerProfilePda.toBase58() };
    },
    onSuccess: (data) => {
      if (!data.alreadyExists) {
        toast.success('Player profile created on-chain');
        queryClient.invalidateQueries({ queryKey: ['players'] });
      }
    },
    onError: (error: Error) => {
      const msg = normalizeSolanaError(error);
      if (!msg.includes('already')) {
        toast.error('Failed to initialize player profile', { description: msg });
      }
    },
  });
}

// ── 2. Create wager ───────────────────────────────────────────────────────────

export function useCreateWagerOnChain() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { getSessionToken } = useWalletAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      stakeLamports,
      lichessGameId,
      requiresModerator = false,
      wagerId,
    }: {
      matchId: number;
      stakeLamports: number;
      lichessGameId: string;
      requiresModerator?: boolean;
      wagerId: string;
    }) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');

      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);

      const [wagerPda] = deriveWagerPda(publicKey, matchIdBigInt);
      const [playerProfilePda] = derivePlayerProfilePda(publicKey);

      let existingPda = null;
      try { existingPda = await connection.getAccountInfo(wagerPda); } catch { /* ok */ }

      let signature: string;

      if (existingPda) {
        console.log('[createWager] PDA exists — skipping tx, notifying DB');
        signature = 'already_deposited';
      } else {
        await ensurePlayerProfileExists(publicKey, sendTransaction, connection);

        const createIx = new TransactionInstruction({
          programId: new PublicKey(PROGRAM_ID),
          keys: [
            { pubkey: wagerPda, isSigner: false, isWritable: true },
            { pubkey: playerProfilePda, isSigner: false, isWritable: false },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: buildInstructionData(
            INSTRUCTION_DISCRIMINATORS.create_wager,
            matchIdBigInt,
            stakeAmount,
            lichessGameId,
            requiresModerator
          ),
        });

        signature = await sendAndConfirmViaAdapter(createIx, publicKey, sendTransaction, connection);
      }

      const token = await getSessionToken();
      if (token) {
        try {
          const supabase = getSupabaseClient();
          const { error } = await supabase.functions.invoke('secure-wager', {
            body: {
              action: 'recordOnChainCreate',
              wagerId,
              playerAWallet: publicKey.toBase58(),
              matchId,
              stakeLamports,
              wagerPda: wagerPda.toBase58(),
              txSignature: signature,
            },
            headers: { 'X-Session-Token': token },
          });
          if (error) console.warn('[createWager] recordOnChainCreate failed:', error.message);
        } catch (dbErr) {
          console.warn('[createWager] recordOnChainCreate threw:', dbErr);
        }
      }

      return { signature, wagerPda: wagerPda.toBase58(), matchId, stakeLamports };
    },
    onSuccess: (data) => {
      toast.success('Deposit confirmed!', {
        description: `${(data.stakeLamports / LAMPORTS_PER_SOL).toFixed(3)} SOL locked in escrow`,
      });
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('[createWager]', normalizeSolanaError(error));
    },
  });
}

// ── 3. Join wager ─────────────────────────────────────────────────────────────

export function useJoinWagerOnChain() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { getSessionToken } = useWalletAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerAWallet,
      matchId,
      stakeLamports,
      wagerId,
    }: {
      playerAWallet: string;
      matchId: number;
      stakeLamports: number;
      wagerId: string;
    }) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');

      const playerA = new PublicKey(playerAWallet);
      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);

      const [wagerPda] = deriveWagerPda(playerA, matchIdBigInt);
      const [playerBProfilePda] = derivePlayerProfilePda(publicKey);

      let pdaBalance = 0;
      try { pdaBalance = await connection.getBalance(wagerPda); } catch { /* ok */ }

      let signature: string;

      if (pdaBalance >= stakeLamports * 2) {
        console.log('[joinWager] PDA already fully funded — skipping tx, notifying DB');
        signature = 'already_deposited';
      } else {
        await ensurePlayerProfileExists(publicKey, sendTransaction, connection);

        const joinIx = new TransactionInstruction({
          programId: new PublicKey(PROGRAM_ID),
          keys: [
            { pubkey: wagerPda, isSigner: false, isWritable: true },
            { pubkey: playerBProfilePda, isSigner: false, isWritable: false },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: buildInstructionData(INSTRUCTION_DISCRIMINATORS.join_wager, stakeAmount),
        });

        try {
          signature = await sendAndConfirmViaAdapter(joinIx, publicKey, sendTransaction, connection);
        } catch (err: unknown) {
          const normalized = normalizeSolanaError(err);
          if (normalized === 'already_deposited') {
            signature = 'already_deposited';
          } else {
            throw err;
          }
        }
      }

      const token = await getSessionToken();
      if (token) {
        try {
          const supabase = getSupabaseClient();
          const { error } = await supabase.functions.invoke('secure-wager', {
            body: {
              action: 'recordOnChainJoin',
              wagerId,
              playerBWallet: publicKey.toBase58(),
              stakeLamports,
              txSignature: signature,
            },
            headers: { 'X-Session-Token': token },
          });
          if (error) console.warn('[joinWager] recordOnChainJoin failed:', error.message);
        } catch (dbErr) {
          console.warn('[joinWager] recordOnChainJoin threw:', dbErr);
        }
      }

      return { signature, wagerId };
    },
    onSuccess: () => {
      toast.success('Deposit confirmed!', {
        description: 'Your stake has been locked in escrow',
      });
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('[joinWager]', normalizeSolanaError(error));
    },
  });
}

// ── 4. Submit vote ────────────────────────────────────────────────────────────

export function useSubmitVoteOnChain() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerAWallet,
      matchId,
      votedWinnerWallet,
    }: {
      playerAWallet: string;
      matchId: number;
      votedWinnerWallet: string;
    }) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');

      const playerA = new PublicKey(playerAWallet);
      const matchIdBigInt = BigInt(matchId);
      const votedWinner = new PublicKey(votedWinnerWallet);
      const [wagerPda] = deriveWagerPda(playerA, matchIdBigInt);

      const instruction = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
          { pubkey: wagerPda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
        ],
        data: buildInstructionData(INSTRUCTION_DISCRIMINATORS.submit_vote, votedWinner),
      });

      const signature = await sendAndConfirmViaAdapter(instruction, publicKey, sendTransaction, connection);
      return { signature };
    },
    onSuccess: () => {
      toast.success('Vote submitted on-chain');
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      const msg = normalizeSolanaError(error);
      toast.error('Failed to submit vote', { description: msg });
    },
  });
}

// ── 5. Retract vote ───────────────────────────────────────────────────────────

export function useRetractVoteOnChain() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerAWallet,
      matchId,
    }: {
      playerAWallet: string;
      matchId: number;
    }) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');

      const playerA = new PublicKey(playerAWallet);
      const matchIdBigInt = BigInt(matchId);
      const [wagerPda] = deriveWagerPda(playerA, matchIdBigInt);

      const instruction = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
          { pubkey: wagerPda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
        ],
        data: buildInstructionData(INSTRUCTION_DISCRIMINATORS.retract_vote),
      });

      const signature = await sendAndConfirmViaAdapter(instruction, publicKey, sendTransaction, connection);
      return { signature };
    },
    onSuccess: () => {
      toast.info('Vote retracted');
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      const msg = normalizeSolanaError(error);
      toast.error('Failed to retract vote', { description: msg });
    },
  });
}

// ── 6. Check player profile ───────────────────────────────────────────────────

export function useCheckPlayerProfile() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  return useMutation({
    mutationFn: async (walletOverride?: string) => {
      const key = walletOverride ? new PublicKey(walletOverride) : publicKey;
      if (!key) throw new Error('No wallet provided');

      const [pda] = derivePlayerProfilePda(key);
      let info = null;
      try { info = await connection.getAccountInfo(pda); } catch { /* ok */ }
      return { exists: info !== null, pda: pda.toBase58() };
    },
  });
}