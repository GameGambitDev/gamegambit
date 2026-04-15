/**
 * useSolanaProgram.ts
 *
 * Phase 1 fix: recordOnChainCreate and recordOnChainJoin now throw on failure
 * instead of silently console.warn-ing. If the DB flag (deposit_player_a /
 * deposit_player_b) is never set, Player B's poll in ReadyRoomModal will wait
 * indefinitely rather than proceeding with a wrong or missing deposit.
 *
 * ROOT CAUSE FIX (this version):
 *  Phantom uses its own internal RPC node to simulate transactions independently
 *  of the dApp's configured RPC. When initialize_player was sent as a SEPARATE
 *  prior transaction, Phantom's RPC often hadn't indexed the new player_a_profile
 *  account yet (devnet RPC lag / different node). So when Phantom simulated
 *  create_wager it failed with ConstraintSeeds on player_a_profile — showing the
 *  red "Transaction reverted during simulation" warning — even though the dApp's
 *  own simulateTransaction call succeeded moments before.
 *
 *  The fix: always include initialize_player as the FIRST instruction in the SAME
 *  transaction as create_wager. The contract uses `init_if_needed` so it's
 *  idempotent (safe if profile already exists). Phantom now simulates both
 *  instructions atomically — profile is guaranteed to exist when create_wager runs,
 *  regardless of Phantom's internal RPC state.
 *
 * Mobile fix (carried forward):
 *  - Always use sendTransaction — Mobile Wallet Adapter handles opening Phantom
 *    and signing internally. Calling signTransaction separately breaks it.
 *  - signTransaction has been removed from sendAndConfirmViaAdapter entirely.
 *
 * Instruction fix:
 *  - create_wager now only encodes matchId + stakeAmount (2 args).
 *    The old hook was also encoding lichessGameId (string) and requiresModerator
 *    (bool), which corrupted the stake_lamports field the contract reads —
 *    it was reading the string length prefix as the lamport amount (~8), so
 *    Phantom showed 0.000008 SOL instead of 1 SOL.
 *    lichessGameId / requiresModerator are still accepted as params because
 *    recordOnChainCreate forwards them to the edge function for Supabase.
 *
 * DEBUG LOGGING ADDED:
 *  - Every mutationFn logs its received args immediately on entry so you can
 *    confirm whether stake_lamports arrives correctly or has already been
 *    corrupted upstream (e.g. by a partial Supabase Realtime cache write).
 *  - buildInstructionData logs the BigInt values it encodes into the tx.
 *  - sendAndConfirmViaAdapter logs the full tx lifecycle.
 *  - The "STAKE SANITY CHECK" guard throws early with a clear message if
 *    stake_lamports arrives as 0 or suspiciously small (< 1000 lamports),
 *    preventing a near-zero deposit from hitting the chain silently.
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
  // Log what we're encoding so we can verify stake amounts at the tx-build step
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

async function sendAndConfirmViaAdapter(
  instructions: TransactionInstruction | TransactionInstruction[],
  payer: PublicKey,
  sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>,
  connection: any,
): Promise<string> {
  const ixs = Array.isArray(instructions) ? instructions : [instructions];
  console.log('[sendAndConfirmViaAdapter] fetching latest blockhash…');
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction();
  ixs.forEach(ix => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  console.log('[sendAndConfirmViaAdapter] sending tx, payer:', payer.toBase58(), 'blockhash:', blockhash);

  const signature = await sendTransaction(tx, connection, {
    skipPreflight: true,
    preflightCommitment: 'confirmed',
  });

  console.log('[sendAndConfirmViaAdapter] tx sent, signature:', signature, '— confirming…');

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  console.log('[sendAndConfirmViaAdapter] ✅ confirmed:', signature);
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
  if (existing) {
    console.log('[ensurePlayerProfile] profile already exists, skipping init');
    return;
  }

  toast.info('Creating your on-chain profile (one-time setup)…');
  console.log('[ensurePlayerProfile] profile not found — creating for', player.toBase58());

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
      // ── ENTRY LOGGING ──────────────────────────────────────────────────────
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

      // ── STAKE SANITY CHECK ─────────────────────────────────────────────────
      if (!stakeLamports || stakeLamports < 1_000) {
        const msg = `[createWager] STAKE SANITY FAIL: stakeLamports=${stakeLamports} (${stakeLamports / LAMPORTS_PER_SOL} SOL). This is almost certainly a corrupted value. Aborting to prevent a dust deposit.`;
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
        // ── CONDITIONAL BATCH: only include initialize_player if profile doesn't exist ──
        //
        // ROOT CAUSE OF PHANTOM "reverted during simulation" + wrong fee display:
        // The previous approach always bundled initialize_player + create_wager in
        // one tx, assuming init_if_needed made it a safe no-op when profile exists.
        // But Phantom runs its own independent simulation on its own RPC node.
        // When the profile account already exists, Phantom's sim sees initialize_player
        // trying to re-init an existing account and throws — causing the red "reverted"
        // banner. Because Phantom's sim failed, it can't model the SOL movement, so it
        // only shows the network fee (0.00008 SOL) instead of the actual 1 SOL stake.
        // The dApp's own simulation passed fine (different RPC node, correct state).
        //
        // FIX: Check if the profile account exists on-chain before building the tx.
        // Only include initialize_player if it doesn't. When profile already exists,
        // Phantom simulates a single clean create_wager ix and correctly shows the
        // full stake amount. New users still get both instructions atomically.

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
        // Do NOT pass lichessGameId or requiresModerator — they corrupt instruction
        // data and cause the contract to misread stake_lamports.
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

        // ── DIAGNOSTIC: simulate before sending to surface real Anchor errors ──
        {
          const simTx = new Transaction();
          simTx.add(...instructions);
          simTx.feePayer = publicKey;
          simTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          const simResult = await connection.simulateTransaction(simTx);
          console.log('[createWager] SIMULATION RESULT:', JSON.stringify(simResult.value, null, 2));
          if (simResult.value.err) {
            console.error('[createWager] SIMULATION FAILED — err:', JSON.stringify(simResult.value.err));
            console.error('[createWager] SIMULATION LOGS:', simResult.value.logs);
            throw new Error(
              `Transaction simulation failed. Logs: ${(simResult.value.logs ?? []).join(' | ')}`
            );
          }
        }
        // ── END DIAGNOSTIC ────────────────────────────────────────────────────

        console.log(
          profileExists
            ? '[createWager] sending create_wager only (profile exists), stake:'
            : '[createWager] sending batched init_profile + create_wager, stake:',
          stakeAmount.toString(), 'lamports'
        );
        signature = await sendAndConfirmViaAdapter(
          instructions, publicKey, sendTransaction, connection
        );
      }

      // recordOnChainCreate MUST succeed — it sets deposit_player_a in the DB,
      // which is the flag Player B polls before firing join_wager. If it fails
      // we throw so the tx state goes to error rather than silently proceeding
      // and leaving Player B stuck waiting or joining with a wrong balance.
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
      // ── ENTRY LOGGING ──────────────────────────────────────────────────────
      console.log('[joinWager] ▶ mutationFn ENTRY', {
        wagerId,
        matchId,
        stakeLamports,
        stake_sol: stakeLamports / LAMPORTS_PER_SOL,
        playerAWallet,
        wallet: publicKey?.toBase58() ?? 'NOT CONNECTED',
      });

      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');

      // ── STAKE SANITY CHECK ─────────────────────────────────────────────────
      if (!stakeLamports || stakeLamports < 1_000) {
        const msg = `[joinWager] STAKE SANITY FAIL: stakeLamports=${stakeLamports} (${stakeLamports / LAMPORTS_PER_SOL} SOL). Aborting to prevent a dust deposit.`;
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

        console.log('[joinWager] sending join_wager tx with stake:', stakeAmount.toString(), 'lamports');

        try {
          signature = await sendAndConfirmViaAdapter(
            joinIx, publicKey, sendTransaction, connection
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

      // recordOnChainJoin MUST succeed — it sets deposit_player_b and transitions
      // the wager to 'voting'. Throwing here surfaces the error to the user
      // rather than silently leaving the wager in a broken state.
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