import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from './useWalletAuth';
import { PROGRAM_ID, AUTHORITY_PUBKEY, DEFAULT_RPC_URL, INSTRUCTION_DISCRIMINATORS } from '@/lib/solana-config';
import { toast } from 'sonner';

const connection = new Connection(DEFAULT_RPC_URL, 'confirmed');

// Helper to derive PDAs
function deriveWagerPda(playerA: PublicKey, matchId: bigint): [PublicKey, number] {
  const matchIdBuffer = Buffer.alloc(8);
  matchIdBuffer.writeBigUInt64LE(matchId);
  
  return PublicKey.findProgramAddressSync(
    [Buffer.from('wager'), playerA.toBuffer(), matchIdBuffer],
    new PublicKey(PROGRAM_ID)
  );
}

function derivePlayerProfilePda(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('player'), player.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

// Build instruction data with discriminator
function buildInstructionData(discriminator: readonly number[] | number[], ...args: (bigint | boolean | string)[]): Buffer {
  const discArray = Array.isArray(discriminator) ? [...discriminator] : discriminator;
  const buffers: Buffer[] = [Buffer.from(discArray as number[])];
  
  for (const arg of args) {
    if (typeof arg === 'bigint') {
      const buf = Buffer.alloc(8);
      buf.writeBigUInt64LE(arg);
      buffers.push(buf);
    } else if (typeof arg === 'boolean') {
      buffers.push(Buffer.from([arg ? 1 : 0]));
    } else if (typeof arg === 'string') {
      // String: 4-byte length + content
      const strBuf = Buffer.from(arg, 'utf8');
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32LE(strBuf.length);
      buffers.push(lenBuf, strBuf);
    }
  }
  
  return Buffer.concat(buffers);
}

// Initialize player profile on-chain
export function useInitializePlayer() {
  const { publicKey, signTransaction } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!publicKey || !signTransaction) {
        throw new Error('Wallet not connected');
      }

      const [playerProfilePda] = derivePlayerProfilePda(publicKey);
      
      const instruction = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
          { pubkey: playerProfilePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: buildInstructionData(INSTRUCTION_DISCRIMINATORS.initialize_player),
      });

      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new Transaction().add(instruction);
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      return { signature, playerProfilePda: playerProfilePda.toBase58() };
    },
    onSuccess: () => {
      toast.success('Player profile initialized on-chain');
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
    onError: (error) => {
      console.error('Initialize player error:', error);
      // Don't show error if account already exists
      if (!error.message?.includes('already in use')) {
        toast.error('Failed to initialize player profile');
      }
    },
  });
}

// Create wager on-chain with escrow
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
      if (!publicKey || !signTransaction) {
        throw new Error('Wallet not connected');
      }

      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);
      
      const [wagerPda] = deriveWagerPda(publicKey, matchIdBigInt);
      const [playerProfilePda] = derivePlayerProfilePda(publicKey);

      // Build create_wager instruction
      const instruction = new TransactionInstruction({
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

      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new Transaction().add(instruction);
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      // Record escrow transaction in backend
      const sessionToken = await getSessionToken();
      if (sessionToken) {
        await supabase.functions.invoke('resolve-wager', {
          body: {
            action: 'record_escrow',
            wagerId: null, // Will be set when DB wager is created
            playerAWallet: publicKey.toBase58(),
            stakeLamports,
            txSignature: signature,
            txType: 'escrow_deposit',
          },
          headers: { 'x-wallet-session': sessionToken },
        });
      }

      return { 
        signature, 
        wagerPda: wagerPda.toBase58(),
        matchId,
        stakeLamports,
      };
    },
    onSuccess: (data) => {
      toast.success('Wager created on-chain!', {
        description: `${data.stakeLamports / LAMPORTS_PER_SOL} SOL deposited to escrow`,
      });
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
    onError: (error) => {
      console.error('Create wager on-chain error:', error);
      toast.error('Failed to create wager on-chain');
    },
  });
}

// Join wager on-chain with escrow
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
      if (!publicKey || !signTransaction) {
        throw new Error('Wallet not connected');
      }

      const playerA = new PublicKey(playerAWallet);
      const matchIdBigInt = BigInt(matchId);
      const stakeAmount = BigInt(stakeLamports);
      
      const [wagerPda] = deriveWagerPda(playerA, matchIdBigInt);
      const [playerBProfilePda] = derivePlayerProfilePda(publicKey);

      // Build join_wager instruction
      const instruction = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
          { pubkey: wagerPda, isSigner: false, isWritable: true },
          { pubkey: playerBProfilePda, isSigner: false, isWritable: false },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: buildInstructionData(INSTRUCTION_DISCRIMINATORS.join_wager, stakeAmount),
      });

      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new Transaction().add(instruction);
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      // Record escrow transaction in backend
      const sessionToken = await getSessionToken();
      if (sessionToken) {
        await supabase.functions.invoke('resolve-wager', {
          body: {
            action: 'record_escrow',
            wagerId,
            playerBWallet: publicKey.toBase58(),
            stakeLamports,
            txSignature: signature,
            txType: 'escrow_deposit',
          },
          headers: { 'x-wallet-session': sessionToken },
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
    onError: (error) => {
      console.error('Join wager on-chain error:', error);
      toast.error('Failed to join wager on-chain');
    },
  });
}

// Check if player profile exists on-chain
export function useCheckPlayerProfile() {
  const { publicKey } = useWallet();

  return useMutation({
    mutationFn: async () => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      const [playerProfilePda] = derivePlayerProfilePda(publicKey);
      
      try {
        const accountInfo = await connection.getAccountInfo(playerProfilePda);
        return { exists: accountInfo !== null, pda: playerProfilePda.toBase58() };
      } catch {
        return { exists: false, pda: playerProfilePda.toBase58() };
      }
    },
  });
}