/**
 * useSolanaProgram.ts
 *
 * Mobile fixes applied:
 *  1. initPlayer is sent as a SEPARATE tx before create_wager — batching them
 *     causes "Missing signature for pubkey" because the PDA created in ix1
 *     is a signer in ix2 simulation, confusing mobile wallets.
 *  2. sendTransaction options updated with skipPreflight + correct commitment.
 *  3. All errors caught and normalized — no raw console screaming.
 *  4. join_wager idempotency: PDA balance check instead of catching revert.
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

// ── PDA derivation ────────────────────────────────────────────────────────────

export function deriveWagerPda(playerA: PublicKey, matchId: bigint): [PublicKey, number] {
  const matchIdBuffer = Buffer.alloc(8);
  matchIdBuffer.writeBigUInt64LE(matchId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('wager'), playerA.toBuffer(), matchIdBuffer],
    new PublicKey(PROGRAM_ID)
  );
}

export function derivePlayerProfilePda(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('player'), player.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

// ── Instruction data builder ──────────────────────────────────────────────────

function buildInstructionData(
  discriminator: readonly number[],
  ...args: (bigint | boolean | string | PublicKey)[]
): Buffer {
  const buffers: Buffer[] = [Buffer.from(discriminator as number[])];

  for (const arg of args) {
    if (typeof arg === 'bigint') {
      const buf = Buffer.alloc(8);
      buf.writeBigUInt64LE(arg);
      buffers.push(buf);
    } else if (typeof arg === 'boolean') {
      buffers.push(Buffer.from([arg ? 1 : 0]));
    } else if (typeof arg === 'string') {
      const strBuf = Buffer.from(arg, 'utf8');
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32LE(strBuf.length);
      buffers.push(lenBuf, strBuf);
    } else if (arg instanceof PublicKey) {
      buffers.push(arg.toBuffer());
    }
  }

  return Buffer.concat(buffers);
}

// ── Error normalizer — silences wall-of-text mobile wallet errors ─────────────

export function normalizeSolanaError(err: unknown): string {
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
    return 'already_deposited'; // sentinel — caller handles this

  // Truncate long raw RPC/simulation errors so they don't flood the screen
  if (msg.length > 120) return msg.slice(0, 120) + '…';
  return msg;
}

// ── Send a single-instruction tx via wallet adapter ───────────────────────────
//
// MOBILE KEY: skipPreflight=true avoids simulation mismatches on mobile RPC
// nodes that are slightly behind. confirmTransaction still verifies on-chain.

async function sendAndConfirmViaAdapter(
  instructions: TransactionInstruction | TransactionInstruction[],
  payer: PublicKey,
  sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>,
  connection: any,
  { skipPreflight = true }: { skipPreflight?: boolean } = {}
): Promise<string> {
  const ixs = Array.isArray(instructions) ? instructions : [instructions];
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction();
  ixs.forEach(ix => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  // skipPreflight=true is the key mobile fix — Phantom/Solflare on mobile
  // sometimes fail preflight simulation even when the tx would succeed on-chain.
  const signature = await sendTransaction(tx, connection, {
    skipPreflight,
    preflightCommitment: 'confirmed',
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  return signature;
}

// ── Init player profile — SEPARATE tx (never batched with create_wager) ───────
//
// Batching initPlayer + createWager fails on mobile because the newly created
// player PDA in ix1 appears as a signer in ix2's account list, causing
// "Missing signature for pubkey <newPda>" during simulation.
// Solution: send initPlayer in its own tx first, await confirmation, then proceed.

async function ensurePlayerProfileExists(
  player: PublicKey,
  sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>,
  connection: any,
): Promise<void> {
  const [profilePda] = derivePlayerProfilePda(player);

  let existing = null;
  try {
    existing = await connection.getAccountInfo(profilePda);
  } catch {
    // RPC hiccup — assume it doesn't exist and try to create
  }

  if (existing) return; // already initialized

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
    // "already in use" means a race — profile was created concurrently, fine.
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
        console.error('[InitPlayer]', msg);
        toast.error('Failed to initialize player profile', { description: msg });
      }
    },
  });
}

// ── 2. Create wager (Player A deposits stake into PDA escrow) ─────────────────

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

      // ── IDEMPOTENCY: PDA already exists → prior tx succeeded, just notify DB
      let existingPda = null;
      try { existingPda = await connection.getAccountInfo(wagerPda); } catch { /* ok */ }

      let signature: string;

      if (existingPda) {
        console.log('[createWager] PDA exists — skipping tx, notifying DB');
        signature = 'already_deposited';
      } else {
        // ── MOBILE FIX: init player in its OWN tx first, never batched ──────
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

      // ── Notify DB regardless of whether we sent a new tx ─────────────────
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
          if (error) console.warn('[createWager] recordOnChainCreate DB notify failed:', error.message);
        } catch (dbErr) {
          console.warn('[createWager] recordOnChainCreate threw:', dbErr);
          // Don't rethrow — on-chain deposit succeeded
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
      // ReadyRoomModal displays the error — just log a short version here
      console.error('[createWager]', normalizeSolanaError(error));
    },
  });
}

// ── 3. Join wager (Player B deposits matching stake) ──────────────────────────

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

      // ── IDEMPOTENCY: check PDA balance — if ≥ 2x stake, B already deposited
      let pdaBalance = 0;
      try {
        pdaBalance = await connection.getBalance(wagerPda);
      } catch { /* ok */ }

      let signature: string;

      if (pdaBalance >= stakeLamports * 2) {
        console.log('[joinWager] PDA already fully funded — skipping tx, notifying DB');
        signature = 'already_deposited';
      } else {
        // ── MOBILE FIX: init player in its OWN tx first, never batched ──────
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
          // 'already_deposited' sentinel means PDA revert — prior attempt succeeded
          if (normalized === 'already_deposited') {
            console.log('[joinWager] on-chain revert suggests already deposited — notifying DB');
            signature = 'already_deposited';
          } else {
            throw err; // real error (rejected, insufficient funds…)
          }
        }
      }

      // ── Notify DB ─────────────────────────────────────────────────────────
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
          if (error) console.warn('[joinWager] recordOnChainJoin DB notify failed:', error.message);
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
      console.error('[submitVote]', msg);
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
      console.error('[retractVote]', msg);
      toast.error('Failed to retract vote', { description: msg });
    },
  });
}

// ── 6. Check player profile exists on-chain ───────────────────────────────────

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