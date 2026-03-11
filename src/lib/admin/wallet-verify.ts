// Solana wallet verification utilities
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

/**
 * Generate a message for wallet signing
 */
export function generateVerificationMessage(adminId: string): string {
  const timestamp = new Date().toISOString();
  return `Sign this message to verify your Solana wallet for Game Gambit Admin Panel\n\nAdmin ID: ${adminId}\nTimestamp: ${timestamp}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;
}

/**
 * Verify a Solana wallet signature
 */
export async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signatureB64: string
): Promise<boolean> {
  try {
    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch {
      console.error('Invalid wallet address format');
      return false;
    }

    // Decode the signature
    let signature: Uint8Array;
    try {
      signature = bs58.decode(signatureB64);
    } catch {
      console.error('Invalid signature encoding');
      return false;
    }

    // Prepare message for verification
    const messageBytes = new TextEncoder().encode(message);

    // Get the public key
    const publicKey = new PublicKey(walletAddress).toBytes();

    // Verify the signature
    const isValid = nacl.sign.detached.verify(messageBytes, signature, publicKey);

    return isValid;
  } catch (e) {
    console.error('Error verifying wallet signature:', e);
    return false;
  }
}

/**
 * Validate signature format
 */
export function isValidSignatureFormat(signature: string): boolean {
  try {
    const decoded = bs58.decode(signature);
    // Ed25519 signatures are 64 bytes
    return decoded.length === 64;
  } catch {
    return false;
  }
}

/**
 * Extract public key from wallet address
 */
export function extractPublicKey(walletAddress: string): Uint8Array | null {
  try {
    return new PublicKey(walletAddress).toBytes();
  } catch {
    return null;
  }
}

/**
 * Create a challenge message for wallet binding
 */
export function createWalletChallenge(adminId: string, walletAddress: string): {
  message: string;
  nonce: string;
  timestamp: string;
} {
  const timestamp = new Date().toISOString();
  const nonce = Math.random().toString(36).substring(2, 15);

  const message = `Verify wallet binding for Game Gambit Admin Panel\n\nWallet: ${walletAddress}\nAdmin ID: ${adminId}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nThis is a security verification and will not cost any gas fees.`;

  return {
    message,
    nonce,
    timestamp,
  };
}

/**
 * Verify wallet challenge response
 */
export async function verifyChallengeResponse(
  walletAddress: string,
  message: string,
  signature: string,
  nonce: string
): Promise<{
  valid: boolean;
  error?: string;
}> {
  // Check if nonce is in message
  if (!message.includes(nonce)) {
    return { valid: false, error: 'Invalid nonce in message' };
  }

  // Verify signature
  const isValid = await verifyWalletSignature(walletAddress, message, signature);

  if (!isValid) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
}
