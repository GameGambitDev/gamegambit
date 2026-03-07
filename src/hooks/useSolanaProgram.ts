/**
 * useSolanaProgram.ts
 *
 * All on-chain interactions for GameGambit.
 *
 * Flow:
 *  1. Player A  → useCreateWagerOnChain()  → create_wager  (deposits stake into PDA escrow)
 *  2. Player B  → useJoinWagerOnChain()    → join_wager    (deposits matching stake)
 *  3. [Both players now in ReadyRoom — funds already locked on-chain]
 *  4. Game played
 *  5. Each player → useSubmitVoteOnChain() → submit_vote   (signs who they think won)
 *  6a. Votes agree  → Retractable → after RETRACT_WINDOW → backend calls resolve_wager
 *  6b. Votes disagree → Disputed  → moderator resolves via backend
 *  7. For chess: backend auto-resolves via Lichess API
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Connection,
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
  DEFAULT_RPC_URL,
  INSTRUCTION_DISCRIMINATORS,
  PLATFORM_WALLET_PUBKEY,
} from '@/lib/solana-config';
import { toast } from 'sonner';

// ── RPC connection (shared, one instance) ────────────────────────────────────

const connection = new Connection(DEFAULT_RPC_URL, 'confirmed');

// ── PDA derivation ────────────────────────────────────────────────────────────

/** Seeds: ["wager", player_a_pubkey, match_id_u64_le] */
export function deriveWagerPda(playerA: PublicKey, matchId: bigint): [PublicKey, number] {
  const matchIdBuffer = Buffer.alloc(8);
  matchIdBuffer.writeBigUInt64LE(matchId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('wager'), playerA.toBuffer(), matchIdBuffer],
    new PublicKey(PROGRAM_ID)
  );
}

/** Seeds: ["player", player_pubkey] */
export function derivePlayerProfilePda(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('player'), player.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

// ── Instruction data builder ──────────────────────────────────────────────────
// Anchor wire format: 8-byte discriminator | borsh-encoded args
// Supported arg types: bigint (u64 LE), boolean, string (u32 len + utf8), pubkey (32 bytes)

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
      // pubkey is encoded as raw 32 bytes in Borsh
      buffers.push(arg.toBuffer());
    }
  }

  return Buffer.concat(buffers);
}

// ── Shared: send + confirm helper ─────────────────────────────────────────────

async function sendAndConfirm(
  instruction: TransactionInstruction,
  payer: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction().add(instruction);
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  const signedTx = await signTransaction(tx);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  return signature;
}

// ── Shared: auto-initialize player profile if not yet on-chain ────────────────
// create_wager and join_wager both require the player profile PDA to exist.
// This sends initialize_player automatically if missing — one extra wallet popup
// shown only on the player's very first wager ever.
async function ensurePlayerProfile(
  player: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<void> {
  const [profilePda] = derivePlayerProfilePda(player);
  const existing = await connection.getAccountInfo(profilePda);
  if (existing) return; // already initialized

  const initIx = new TransactionInstruction({
    programId: new PublicKey(PROGRAM_ID),
    keys: [
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(INSTRUCTION_DISCRIMINATORS.initialize_player as number[]),
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction().add(initIx);
  tx.recentBlockhash = blockhash;
  tx.feePayer = player;

  toast.info("First-time setup: initializing your on-chain profile\u2026");
  const signed = await signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  toast.success("On-chain profile ready!");
}


// ── 1. Initialize player profile ──────────────────────────────────────────────

export function useInitializePlayer() {
  const { publicKey, signTransaction } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

      const [playerProfilePda] = derivePlayerProfilePda(publicKey);

      // Check if already initialized to avoid wasting SOL on rent
      const existing = await connection.getAccountInfo(playerProfilePda);
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

      const signature = await sendAndConfirm(instruction, publicKey, signTransaction);
      return { alreadyExists: false, signature, pda: playerProfilePda.toBase58() };
    },
    onSuccess: (data) => {
      if (!data.alreadyExists) {
        toast.success('Player profile created on-chain');
        queryClient.invalidateQueries({ queryKey: ['players'] });
      }
    },
    onError: (error: Error) => {
      if (!error.message?.includes('already in use')) {
        console.error('Initialize player error:', error);
        toast.error('Failed to initialize player profile');
      }
    },
  });
}

// ── 2. Create wager (Player A deposits stake into PDA escrow) ─────────────────

export function useCreateWagerOnChain() {
  const { publicKey, signTransaction } = useWallet();
  const { getSessionToken } = useWalletAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      stakeLamports,
      lichessGameId,
      requiresModerator = false,
    }: {
      matchId: number;
      stakeLamports: number;
      lichessGameId: string;
      requiresModerator?: boolean;
    }) => {
      if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

      // Auto-initialize on-chain profile if this is the player's first wager
      await ensurePlayerProfile(publicKey, signTransaction);

      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);

      const [wagerPda] = deriveWagerPda(publicKey, matchIdBigInt);
      const [playerProfilePda] = derivePlayerProfilePda(publicKey);

      // Account order must match CreateWager context in lib.rs:
      //   wager (writable, PDA), player_a_profile (PDA, readonly), player_a (signer, writable), system_program
      const instruction = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
          { pubkey: wagerPda, isSigner: false, isWritable: true },
          { pubkey: playerProfilePda, isSigner: false, isWritable: false },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        // Args: match_id: u64, stake_lamports: u64, lichess_game_id: string, requires_moderator: bool
        data: buildInstructionData(
          INSTRUCTION_DISCRIMINATORS.create_wager,
          matchIdBigInt,
          stakeAmount,
          lichessGameId,
          requiresModerator
        ),
      });

      const signature = await sendAndConfirm(instruction, publicKey, signTransaction);

      // Record in backend so the DB wager gets the on-chain tx signature
      const sessionToken = await getSessionToken();
      if (sessionToken) {
        const supabase = getSupabaseClient();
        await supabase.functions.invoke('secure-wager', {
          body: {
            action: 'recordOnChainCreate',
            playerAWallet: publicKey.toBase58(),
            matchId,
            stakeLamports,
            wagerPda: wagerPda.toBase58(),
            txSignature: signature,
          },
        });
      }

      return { signature, wagerPda: wagerPda.toBase58(), matchId, stakeLamports };
    },
    onSuccess: (data) => {
      toast.success('Wager created on-chain!', {
        description: `${(data.stakeLamports / LAMPORTS_PER_SOL).toFixed(3)} SOL deposited to escrow`,
      });
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('Create wager on-chain error:', error);
      toast.error('Failed to create wager', { description: error.message });
    },
  });
}

// ── 3. Join wager (Player B deposits matching stake) ──────────────────────────

export function useJoinWagerOnChain() {
  const { publicKey, signTransaction } = useWallet();
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
      if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

      // Auto-initialize on-chain profile if this is player B's first wager
      await ensurePlayerProfile(publicKey, signTransaction);

      const playerA = new PublicKey(playerAWallet);
      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);

      const [wagerPda] = deriveWagerPda(playerA, matchIdBigInt);
      const [playerBProfilePda] = derivePlayerProfilePda(publicKey);

      // Account order must match JoinWager context in lib.rs:
      //   wager (writable, PDA), player_b_profile (PDA, readonly), player_b (signer, writable), system_program
      const instruction = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
          { pubkey: wagerPda, isSigner: false, isWritable: true },
          { pubkey: playerBProfilePda, isSigner: false, isWritable: false },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        // Args: stake_lamports: u64
        data: buildInstructionData(INSTRUCTION_DISCRIMINATORS.join_wager, stakeAmount),
      });

      const signature = await sendAndConfirm(instruction, publicKey, signTransaction);

      // Notify backend
      const sessionToken = await getSessionToken();
      if (sessionToken) {
        const supabase = getSupabaseClient();
        await supabase.functions.invoke('secure-wager', {
          body: {
            action: 'recordOnChainJoin',
            wagerId,
            playerBWallet: publicKey.toBase58(),
            stakeLamports,
            txSignature: signature,
          },
        });
      }

      return { signature, wagerId };
    },
    onSuccess: (data) => {
      toast.success('Joined wager on-chain!', {
        description: 'Your stake has been deposited to escrow',
      });
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('Join wager on-chain error:', error);
      toast.error('Failed to join wager', { description: error.message });
    },
  });
}

// ── 4. Submit vote (each player signs who they think won) ─────────────────────
//
// For chess:   this is called automatically by the backend after Lichess confirms the result.
// For CODM/PUBG: each player submits their vote manually from the UI.

export function useSubmitVoteOnChain() {
  const { publicKey, signTransaction } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerAWallet,
      matchId,
      votedWinnerWallet,
    }: {
      playerAWallet: string;   // needed to derive the wager PDA
      matchId: number;
      votedWinnerWallet: string;
    }) => {
      if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

      const playerA = new PublicKey(playerAWallet);
      const matchIdBigInt = BigInt(matchId);
      const votedWinner = new PublicKey(votedWinnerWallet);

      const [wagerPda] = deriveWagerPda(playerA, matchIdBigInt);

      // Account order must match SubmitVote context in lib.rs:
      //   wager (writable, PDA), player (signer, writable)
      const instruction = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
          { pubkey: wagerPda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
        ],
        // Args: voted_winner: pubkey
        data: buildInstructionData(INSTRUCTION_DISCRIMINATORS.submit_vote, votedWinner),
      });

      const signature = await sendAndConfirm(instruction, publicKey, signTransaction);
      return { signature };
    },
    onSuccess: () => {
      toast.success('Vote submitted on-chain');
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('Submit vote on-chain error:', error);
      toast.error('Failed to submit vote', { description: error.message });
    },
  });
}

// ── 5. Retract vote (only during Retractable window) ─────────────────────────

export function useRetractVoteOnChain() {
  const { publicKey, signTransaction } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerAWallet,
      matchId,
    }: {
      playerAWallet: string;
      matchId: number;
    }) => {
      if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

      const playerA = new PublicKey(playerAWallet);
      const matchIdBigInt = BigInt(matchId);
      const [wagerPda] = deriveWagerPda(playerA, matchIdBigInt);

      // Account order: wager (writable, PDA), player (signer, writable)
      const instruction = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
          { pubkey: wagerPda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
        ],
        data: buildInstructionData(INSTRUCTION_DISCRIMINATORS.retract_vote),
      });

      const signature = await sendAndConfirm(instruction, publicKey, signTransaction);
      return { signature };
    },
    onSuccess: () => {
      toast.info('Vote retracted');
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('Retract vote error:', error);
      toast.error('Failed to retract vote', { description: error.message });
    },
  });
}

// ── 6. Check player profile exists on-chain ───────────────────────────────────

export function useCheckPlayerProfile() {
  const { publicKey } = useWallet();

  return useMutation({
    mutationFn: async (walletOverride?: string) => {
      const key = walletOverride ? new PublicKey(walletOverride) : publicKey;
      if (!key) throw new Error('No wallet provided');

      const [pda] = derivePlayerProfilePda(key);
      const info = await connection.getAccountInfo(pda);
      return { exists: info !== null, pda: pda.toBase58() };
    },
  });
}

// ── NOTE: resolve_wager and close_wager are NEVER called from the frontend ────
//
// resolve_wager is called by the backend (edge function / server) using the
// AUTHORITY wallet secret which lives only in edge function env vars.
//
// For chess:      secure-wager edge function polls Lichess API → resolves automatically
// For CODM/PUBG:  secure-wager edge function resolves once votes agree or moderator decides
//
// close_wager is also called by the backend for expired/cancelled wagers.