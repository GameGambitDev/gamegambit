/**
 * useSolanaProgram.ts
 *
 * All on-chain interactions for GameGambit.
 *
 * Mobile fix: uses `sendTransaction` from wallet adapter instead of
 * `signTransaction` + manual `sendRawTransaction`. The adapter's sendTransaction
 * handles deep links and in-app browser signing on Phantom/Solflare mobile correctly.
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

// ── Shared: send + confirm via wallet adapter sendTransaction ─────────────────
//
// KEY MOBILE FIX: We use `sendTransaction` from the wallet adapter instead of
// `signTransaction` + `sendRawTransaction`. The adapter's sendTransaction:
//   - On desktop: signs and sends in one step
//   - On mobile (Phantom/Solflare): correctly handles deep link signing flow
//     and in-app browser context without losing the promise reference
//
// Accepts one or more instructions batched into a single tx / single popup.

async function sendAndConfirmViaAdapter(
  instructions: TransactionInstruction | TransactionInstruction[],
  payer: PublicKey,
  sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>,
  connection: any
): Promise<string> {
  const ixs = Array.isArray(instructions) ? instructions : [instructions];
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction();
  ixs.forEach(ix => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  // sendTransaction handles signing + sending — works on mobile
  const signature = await sendTransaction(tx, connection, { skipPreflight: false });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  return signature;
}

// ── Shared: init player ix if profile PDA doesn't exist ──────────────────────

async function getInitPlayerIxIfNeeded(
  player: PublicKey,
  connection: any,
): Promise<TransactionInstruction | null> {
  const [profilePda] = derivePlayerProfilePda(player);
  const existing = await connection.getAccountInfo(profilePda);
  if (existing) return null;

  toast.info('First-time setup: your on-chain profile will be created with this transaction');

  return new TransactionInstruction({
    programId: new PublicKey(PROGRAM_ID),
    keys: [
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(INSTRUCTION_DISCRIMINATORS.initialize_player as number[]),
  });
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
      if (!error.message?.includes('already in use')) {
        console.error('Initialize player error:', error);
        toast.error('Failed to initialize player profile');
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
      wagerId: string;  // needed to record deposit in DB
    }) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');

      const initIx = await getInitPlayerIxIfNeeded(publicKey, connection);

      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);

      const [wagerPda] = deriveWagerPda(publicKey, matchIdBigInt);
      const [playerProfilePda] = derivePlayerProfilePda(publicKey);

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

      const ixs = initIx ? [initIx, createIx] : [createIx];
      const signature = await sendAndConfirmViaAdapter(ixs, publicKey, sendTransaction, connection);

      // ── Record deposit in DB — server sets deposit_player_a=true and
      //    auto-starts the game if both players have now deposited
      const sessionToken = await getSessionToken();
      if (sessionToken) {
        const supabase = getSupabaseClient();
        await supabase.functions.invoke('secure-wager', {
          body: {
            action: 'recordOnChainCreate',
            wagerId,
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
      toast.success('Deposit confirmed!', {
        description: `${(data.stakeLamports / LAMPORTS_PER_SOL).toFixed(3)} SOL locked in escrow`,
      });
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('Create wager on-chain error:', error);
      // Don't double-toast — ReadyRoomModal handles the error display
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

      const initIx = await getInitPlayerIxIfNeeded(publicKey, connection);

      const playerA = new PublicKey(playerAWallet);
      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);

      const [wagerPda] = deriveWagerPda(playerA, matchIdBigInt);
      const [playerBProfilePda] = derivePlayerProfilePda(publicKey);

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

      const ixs = initIx ? [initIx, joinIx] : [joinIx];
      const signature = await sendAndConfirmViaAdapter(ixs, publicKey, sendTransaction, connection);

      // ── Record deposit in DB — server sets deposit_player_b=true and
      //    auto-starts the game if both players have now deposited
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
    onSuccess: () => {
      toast.success('Deposit confirmed!', {
        description: 'Your stake has been locked in escrow',
      });
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error: Error) => {
      console.error('Join wager on-chain error:', error);
      // Don't double-toast — ReadyRoomModal handles the error display
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
      console.error('Submit vote on-chain error:', error);
      toast.error('Failed to submit vote', { description: error.message });
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
      console.error('Retract vote error:', error);
      toast.error('Failed to retract vote', { description: error.message });
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
      const info = await connection.getAccountInfo(pda);
      return { exists: info !== null, pda: pda.toBase58() };
    },
  });
}