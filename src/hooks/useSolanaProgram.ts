/**
 * useSolanaProgram.ts
 *
 * FIXES IN THIS VERSION:
 *
 * Fix 1 — Remove skipPreflight: true from sendAndConfirmViaAdapter
 *   skipPreflight told Phantom to skip its own simulation entirely. Without
 *   simulation it can't model the SOL transfer and falls back to showing just
 *   the raw network fee (~0.00001 SOL for Player A). Removed the opts object
 *   so Phantom simulates normally and shows the real stake amount.
 *
 * Fix 2 — joinWager now uses conditional batch (same as createWager)
 *   The old joinWager called ensurePlayerProfileExists as a SEPARATE prior
 *   transaction, then sent joinIx alone. When Phantom simulated joinIx, it
 *   needed the profile account to exist on its own RPC node — but devnet RPC
 *   propagation lag meant it often wasn't indexed yet. Simulation failed →
 *   Phantom showed only fees (~0.00008 SOL) for Player B.
 *   Fix: check if profile exists on-chain, then bundle [initProfileIx, joinIx]
 *   or just [joinIx] atomically. Phantom simulates both instructions together,
 *   sees the full stake movement, shows the correct amount.
 *
 * Fix 3 — Raise compute unit limit to 200_000
 *   50_000 was fine for single instructions but unreliable for batched
 *   initProfile + join/create on congested devnet slots. Phantom also uses
 *   this limit to estimate priority fees — too low made the estimate look wrong.
 *   200_000 is the standard safe default for Anchor programs.
 *
 * Carried forward from previous version:
 *  - createWager conditional batch (only include initProfileIx if profile missing)
 *  - create_wager encodes only matchId + stakeAmount (no lichessGameId/requiresModerator)
 *  - recordOnChainCreate/Join throw on failure instead of silent console.warn
 *  - Stake sanity check guard (throws if stakeLamports < 1000)
 *  - Full debug logging throughout
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWalletAuth } from './useWalletAuth';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
} from '@/lib/solana-config';
import { toast } from 'sonner';

// ── PDA derivation — NO Buffer, uses Uint8Array only ─────────────────────────

export function deriveWagerPda(playerA: PublicKey, matchId: bigint): [PublicKey, number] {
  const matchIdBuffer = new Uint8Array(8);
  new DataView(matchIdBuffer.buffer).setBigUint64(0, matchId, true);
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

function buildInstructionData(
  discriminator: readonly number[],
  ...args: (bigint | boolean | string | PublicKey)[]
): Buffer {
  if (args.length > 0) {
    console.log('[buildInstructionData] encoding args:', args.map((a) =>
      typeof a === 'bigint'
        ? { type: 'bigint', value: a.toString(), asSol: Number(a) / LAMPORTS_PER_SOL }
        : typeof a === 'boolean'
          ? { type: 'bool', value: a }
          : typeof a === 'string'
            ? { type: 'string', value: a }
            : { type: 'PublicKey', value: (a as PublicKey).toBase58() }
    ));
  }

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

// ── Error normalizer ──────────────────────────────────────────────────────────

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
// Always use sendTransaction — Mobile Wallet Adapter handles Phantom opening
// and signing internally. Never call signTransaction separately.

// FIX 4: buildFullTransaction is extracted so that BOTH the pre-send simulation
// AND the actual sendTransaction call use the EXACT same transaction structure
// (including ComputeBudget instructions). Previously, simTx was built without
// priorityFeeIx / computeLimitIx while the sent tx included them — Phantom's
// own simulation saw a different tx than what was pre-simulated, which could
// cause it to fall back to showing only the raw network fee (<0.00001 SOL).
function buildFullTransaction(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  blockhash: string,
): Transaction {
  const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 });
  const computeLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
  const tx = new Transaction();
  tx.add(priorityFeeIx, computeLimitIx);
  instructions.forEach(ix => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;
  return tx;
}

async function sendAndConfirmViaAdapter(
  instructions: TransactionInstruction | TransactionInstruction[],
  payer: PublicKey,
  sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>,
  connection: any,
  preBuiltTx?: { tx: Transaction; lastValidBlockHeight: number },
): Promise<string> {
  let tx: Transaction;
  let blockhash: string;
  let lastValidBlockHeight: number;

  if (preBuiltTx) {
    // Reuse the exact tx that was already simulated — Phantom will simulate
    // the same transaction it receives, so its simulation matches ours.
    tx = preBuiltTx.tx;
    blockhash = tx.recentBlockhash!;
    lastValidBlockHeight = preBuiltTx.lastValidBlockHeight;
    console.log('[sendAndConfirmViaAdapter] reusing pre-built tx, blockhash:', blockhash);
  } else {
    const ixs = Array.isArray(instructions) ? instructions : [instructions];
    console.log('[sendAndConfirmViaAdapter] fetching latest blockhash…');
    const bh = await connection.getLatestBlockhash('confirmed');
    blockhash = bh.blockhash;
    lastValidBlockHeight = bh.lastValidBlockHeight;
    tx = buildFullTransaction(ixs, payer, blockhash);
  }

  console.log('[sendAndConfirmViaAdapter] sending tx, payer:', payer.toBase58(), 'blockhash:', blockhash);

  // skipPreflight must remain false (default) so Phantom runs its own simulation
  // on the exact tx it receives and can correctly display the SOL stake amount.
  const signature = await sendTransaction(tx, connection);

  console.log('[sendAndConfirmViaAdapter] tx sent, signature:', signature, '— confirming…');

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  console.log('[sendAndConfirmViaAdapter] ✅ confirmed:', signature);
  return signature;
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

      const signature = await sendAndConfirmViaAdapter(
        instruction, publicKey, sendTransaction, connection
      );
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
      console.log('[createWager] ▶ mutationFn ENTRY', {
        wagerId,
        matchId,
        stakeLamports,
        stake_sol: stakeLamports / LAMPORTS_PER_SOL,
        lichessGameId,
        requiresModerator,
        wallet: publicKey?.toBase58() ?? 'NOT CONNECTED',
      });

      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');

      if (!stakeLamports || stakeLamports < 1_000) {
        const msg = `[createWager] STAKE SANITY FAIL: stakeLamports=${stakeLamports} (${stakeLamports / LAMPORTS_PER_SOL} SOL). Aborting.`;
        console.error(msg);
        throw new Error(
          `Invalid stake amount (${stakeLamports / LAMPORTS_PER_SOL} SOL). Please close and reopen the Ready Room — this is a data sync issue, not a wallet problem.`
        );
      }

      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);

      const [wagerPda] = deriveWagerPda(publicKey, matchIdBigInt);
      const [playerProfilePda] = derivePlayerProfilePda(publicKey);

      console.log('[createWager] PDAs derived', {
        wagerPda: wagerPda.toBase58(),
        playerProfilePda: playerProfilePda.toBase58(),
      });

      let existingPda = null;
      try { existingPda = await connection.getAccountInfo(wagerPda); } catch { /* ok */ }

      let signature: string;

      if (existingPda) {
        console.log('[createWager] PDA exists — skipping tx, notifying DB');
        signature = 'already_deposited';
      } else {
        // Conditional batch: only include initProfileIx if profile doesn't exist yet.
        // If profile exists and we blindly include initProfileIx, Phantom's independent
        // simulation sees it trying to re-init an existing account → red "reverted"
        // banner → Phantom can't model SOL movement → shows only network fee.
        let profileExists = false;
        try {
          const profileInfo = await connection.getAccountInfo(playerProfilePda);
          profileExists = profileInfo !== null;
        } catch { /* ok — assume doesn't exist */ }

        const initProfileIx = new TransactionInstruction({
          programId: new PublicKey(PROGRAM_ID),
          keys: [
            { pubkey: playerProfilePda, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from(INSTRUCTION_DISCRIMINATORS.initialize_player as number[]),
        });

        // create_wager takes ONLY (match_id: u64, stake_lamports: u64).
        // Do NOT pass lichessGameId or requiresModerator — they corrupt the
        // instruction data and cause the contract to misread stake_lamports.
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
          ),
        });

        const instructions = profileExists ? [createIx] : [initProfileIx, createIx];

        // Simulate using the EXACT same tx we will send to Phantom.
        // By reusing the same tx object (same blockhash, same instructions),
        // Phantom's independent simulation operates on an identical transaction
        // and can correctly model the SOL transfer → shows the real stake amount
        // instead of falling back to the raw network fee (<0.00001 SOL).
        let readyTx: Transaction;
        let readyLastValidBlockHeight: number;
        {
          const bh = await connection.getLatestBlockhash('confirmed');
          readyTx = buildFullTransaction(instructions, publicKey, bh.blockhash);
          readyLastValidBlockHeight = bh.lastValidBlockHeight;
          const simResult = await connection.simulateTransaction(readyTx);
          console.log('[createWager] SIMULATION RESULT:', JSON.stringify(simResult.value, null, 2));
          if (simResult.value.err) {
            console.error('[createWager] SIMULATION FAILED — err:', JSON.stringify(simResult.value.err));
            console.error('[createWager] SIMULATION LOGS:', simResult.value.logs);
            throw new Error(
              `Transaction simulation failed. Logs: ${(simResult.value.logs ?? []).join(' | ')}`
            );
          }
        }

        console.log(
          profileExists
            ? '[createWager] sending create_wager only (profile exists), stake:'
            : '[createWager] sending batched init_profile + create_wager, stake:',
          stakeAmount.toString(), 'lamports'
        );
        signature = await sendAndConfirmViaAdapter(
          instructions, publicKey, sendTransaction, connection,
          { tx: readyTx, lastValidBlockHeight: readyLastValidBlockHeight }
        );
      }

      const token = await getSessionToken();
      console.log('[createWager] session token:', token ? 'ok' : 'NULL');
      if (!token) {
        throw new Error('Session expired — please reconnect your wallet and try again.');
      }

      console.log('[createWager] calling recordOnChainCreate', { wagerId, stakeLamports, matchId });
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

      if (error) {
        console.error('[createWager] recordOnChainCreate failed:', error);
        throw new Error(`Failed to record deposit: ${error.message}`);
      }

      console.log('[createWager] ✅ complete', { signature, stakeLamports });
      return { signature, wagerPda: wagerPda.toBase58(), matchId, stakeLamports };
    },
    onSuccess: (data) => {
      toast.success('Deposit confirmed!', {
        description: `${(data.stakeLamports / LAMPORTS_PER_SOL).toFixed(3)} SOL locked in escrow`,
      });
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('[createWager] onError:', normalizeSolanaError(error));
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
      console.log('[joinWager] ▶ mutationFn ENTRY', {
        wagerId,
        matchId,
        stakeLamports,
        stake_sol: stakeLamports / LAMPORTS_PER_SOL,
        playerAWallet,
        wallet: publicKey?.toBase58() ?? 'NOT CONNECTED',
      });

      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');

      if (!stakeLamports || stakeLamports < 1_000) {
        const msg = `[joinWager] STAKE SANITY FAIL: stakeLamports=${stakeLamports} (${stakeLamports / LAMPORTS_PER_SOL} SOL). Aborting.`;
        console.error(msg);
        throw new Error(
          `Invalid stake amount (${stakeLamports / LAMPORTS_PER_SOL} SOL). Please close and reopen the Ready Room — this is a data sync issue, not a wallet problem.`
        );
      }

      const playerA = new PublicKey(playerAWallet);
      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);

      const [wagerPda] = deriveWagerPda(playerA, matchIdBigInt);
      const [playerBProfilePda] = derivePlayerProfilePda(publicKey);

      console.log('[joinWager] PDAs derived', {
        wagerPda: wagerPda.toBase58(),
        playerBProfilePda: playerBProfilePda.toBase58(),
      });

      let pdaBalance = 0;
      try { pdaBalance = await connection.getBalance(wagerPda); } catch { /* ok */ }
      console.log('[joinWager] current PDA balance:', pdaBalance, 'lamports —', pdaBalance / LAMPORTS_PER_SOL, 'SOL');

      let signature: string;

      if (pdaBalance >= stakeLamports * 2) {
        console.log('[joinWager] PDA already fully funded — skipping tx, notifying DB');
        signature = 'already_deposited';
      } else {
        // FIX 2: Conditional batch — same pattern as createWager.
        //
        // Old approach: ensurePlayerProfileExists sent initProfileIx as a SEPARATE
        // prior transaction, then joinIx was sent alone. When Phantom simulated
        // joinIx by itself, it needed the profile account to already exist on its
        // own RPC node. Due to devnet RPC propagation lag, the freshly-created
        // profile often wasn't indexed on Phantom's node yet — simulation failed,
        // and Phantom showed only the bare network fee (~0.00008 SOL) for Player B.
        //
        // New approach: check if the profile exists, then atomically bundle
        // [initProfileIx, joinIx] or just [joinIx]. Phantom simulates both
        // instructions in the same tx — profile is guaranteed to exist when
        // join_wager runs, and Phantom correctly shows the full stake amount.

        let profileExists = false;
        try {
          const profileInfo = await connection.getAccountInfo(playerBProfilePda);
          profileExists = profileInfo !== null;
        } catch { /* ok — assume doesn't exist */ }

        console.log('[joinWager] Player B profile exists:', profileExists);

        const initProfileIx = new TransactionInstruction({
          programId: new PublicKey(PROGRAM_ID),
          keys: [
            { pubkey: playerBProfilePda, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from(INSTRUCTION_DISCRIMINATORS.initialize_player as number[]),
        });

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

        const instructions = profileExists ? [joinIx] : [initProfileIx, joinIx];

        // Same pattern as createWager: build the tx once, simulate it, then
        // send that exact tx object so Phantom simulates the same transaction.
        let readyTx: Transaction;
        let readyLastValidBlockHeight: number;
        {
          const bh = await connection.getLatestBlockhash('confirmed');
          readyTx = buildFullTransaction(instructions, publicKey, bh.blockhash);
          readyLastValidBlockHeight = bh.lastValidBlockHeight;
          const simResult = await connection.simulateTransaction(readyTx);
          console.log('[joinWager] SIMULATION RESULT:', JSON.stringify(simResult.value, null, 2));
          if (simResult.value.err) {
            console.error('[joinWager] SIMULATION FAILED — err:', JSON.stringify(simResult.value.err));
            console.error('[joinWager] SIMULATION LOGS:', simResult.value.logs);
            throw new Error(
              `Transaction simulation failed. Logs: ${(simResult.value.logs ?? []).join(' | ')}`
            );
          }
        }

        console.log(
          profileExists
            ? '[joinWager] sending join_wager only (profile exists), stake:'
            : '[joinWager] sending batched init_profile + join_wager, stake:',
          stakeAmount.toString(), 'lamports'
        );

        try {
          signature = await sendAndConfirmViaAdapter(
            instructions, publicKey, sendTransaction, connection,
            { tx: readyTx, lastValidBlockHeight: readyLastValidBlockHeight }
          );
        } catch (err: unknown) {
          const normalized = normalizeSolanaError(err);
          if (normalized === 'already_deposited') {
            console.log('[joinWager] already_deposited error — treating as success');
            signature = 'already_deposited';
          } else {
            throw err;
          }
        }
      }

      const token = await getSessionToken();
      console.log('[joinWager] session token:', token ? 'ok' : 'NULL');
      if (!token) {
        throw new Error('Session expired — please reconnect your wallet and try again.');
      }

      console.log('[joinWager] calling recordOnChainJoin', { wagerId, stakeLamports });
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

      if (error) {
        console.error('[joinWager] recordOnChainJoin failed:', error);
        throw new Error(`Failed to record deposit: ${error.message}`);
      }

      console.log('[joinWager] ✅ complete', { signature, wagerId });
      return { signature, wagerId };
    },
    onSuccess: () => {
      toast.success('Deposit confirmed!', {
        description: 'Your stake has been locked in escrow',
      });
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('[joinWager] onError:', normalizeSolanaError(error));
    },
  });
}

// ── 4. Submit vote ────────────────────────────────────────────────────────────
// NOTE: The new contract has no submit_vote instruction — voting is handled
// entirely off-chain via Supabase (useSubmitGameVote in useWagers.ts).
// This hook is kept only as a fallback stub. Do NOT call it from VotingModal.

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

      const signature = await sendAndConfirmViaAdapter(
        instruction, publicKey, sendTransaction, connection
      );
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
// NOTE: Same as submit_vote — no on-chain retract in the new contract.
// Retraction is handled via useRetractVote in useWagers.ts (Supabase).

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

      const signature = await sendAndConfirmViaAdapter(
        instruction, publicKey, sendTransaction, connection
      );
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