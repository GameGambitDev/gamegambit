import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import bs58 from "https://esm.sh/bs58@4.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory nonce store (in production, use Redis or database)
const nonceStore = new Map<string, { nonce: string; timestamp: number }>();
const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function cleanExpiredNonces() {
  const now = Date.now();
  for (const [key, value] of nonceStore.entries()) {
    if (now - value.timestamp > NONCE_EXPIRY_MS) {
      nonceStore.delete(key);
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, walletAddress, signature, nonce, message } = await req.json();
    console.log(`[verify-wallet] Action: ${action}, Wallet: ${walletAddress}`);

    // Generate nonce for wallet
    if (action === 'generate-nonce') {
      if (!walletAddress) {
        return new Response(JSON.stringify({ error: 'Wallet address required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      cleanExpiredNonces();
      const generatedNonce = crypto.randomUUID();
      const messageToSign = `Sign this message to verify your wallet ownership.\n\nNonce: ${generatedNonce}\nTimestamp: ${Date.now()}`;
      
      nonceStore.set(walletAddress, { nonce: generatedNonce, timestamp: Date.now() });
      console.log(`[verify-wallet] Generated nonce for ${walletAddress}`);

      return new Response(JSON.stringify({ 
        nonce: generatedNonce,
        message: messageToSign 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify signature
    if (action === 'verify-signature') {
      if (!walletAddress || !signature || !message) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if nonce exists and is valid
      const storedData = nonceStore.get(walletAddress);
      if (!storedData) {
        console.log(`[verify-wallet] No nonce found for ${walletAddress}`);
        return new Response(JSON.stringify({ error: 'Nonce not found or expired. Please request a new nonce.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check nonce expiry
      if (Date.now() - storedData.timestamp > NONCE_EXPIRY_MS) {
        nonceStore.delete(walletAddress);
        console.log(`[verify-wallet] Nonce expired for ${walletAddress}`);
        return new Response(JSON.stringify({ error: 'Nonce expired. Please request a new nonce.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify the message contains our nonce
      if (!message.includes(storedData.nonce)) {
        console.log(`[verify-wallet] Nonce mismatch for ${walletAddress}`);
        return new Response(JSON.stringify({ error: 'Invalid nonce in message' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        // Decode wallet address and signature
        const publicKeyBytes = bs58.decode(walletAddress);
        const signatureBytes = new Uint8Array(signature);
        const messageBytes = new TextEncoder().encode(message);

        // Verify the signature
        const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

        if (!isValid) {
          console.log(`[verify-wallet] Invalid signature for ${walletAddress}`);
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Clear the used nonce
        nonceStore.delete(walletAddress);
        
        // Generate a session token (simple JWT-like token for this session)
        const sessionToken = await generateSessionToken(walletAddress);
        
        console.log(`[verify-wallet] Wallet verified successfully: ${walletAddress}`);
        return new Response(JSON.stringify({ 
          verified: true,
          walletAddress,
          sessionToken
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error(`[verify-wallet] Signature verification error:`, error);
        return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[verify-wallet] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateSessionToken(walletAddress: string): Promise<string> {
  const payload = {
    wallet: walletAddress,
    exp: Date.now() + (60 * 60 * 1000), // 1 hour expiry
    iat: Date.now(),
  };
  
  // Simple base64 encoding for session token (in production, use proper JWT with secret)
  const tokenData = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(tokenData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return btoa(tokenData) + '.' + hash;
}
