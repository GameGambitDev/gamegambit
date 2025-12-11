import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import bs58 from "https://esm.sh/bs58@4.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const SECRET_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-secret';

// Generate HMAC-based nonce (stateless)
async function generateNonce(walletAddress: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${walletAddress}:${timestamp}:${SECRET_KEY}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Verify the nonce by regenerating it
async function verifyNonce(walletAddress: string, timestamp: number, nonce: string): Promise<boolean> {
  const expectedNonce = await generateNonce(walletAddress, timestamp);
  return expectedNonce === nonce;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, walletAddress, signature, message } = await req.json();
    console.log(`[verify-wallet] Action: ${action}, Wallet: ${walletAddress}`);

    // Generate nonce for wallet
    if (action === 'generate-nonce') {
      if (!walletAddress) {
        return new Response(JSON.stringify({ error: 'Wallet address required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const timestamp = Date.now();
      const nonce = await generateNonce(walletAddress, timestamp);
      const messageToSign = `Sign this message to verify your wallet ownership.\n\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
      
      console.log(`[verify-wallet] Generated nonce for ${walletAddress}, timestamp: ${timestamp}`);

      return new Response(JSON.stringify({ 
        nonce,
        timestamp,
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

      // Extract timestamp and nonce from message
      const timestampMatch = message.match(/Timestamp: (\d+)/);
      const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
      
      if (!timestampMatch || !nonceMatch) {
        console.log(`[verify-wallet] Invalid message format`);
        return new Response(JSON.stringify({ error: 'Invalid message format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const timestamp = parseInt(timestampMatch[1]);
      const nonce = nonceMatch[1];

      // Check nonce expiry
      if (Date.now() - timestamp > NONCE_EXPIRY_MS) {
        console.log(`[verify-wallet] Nonce expired for ${walletAddress}`);
        return new Response(JSON.stringify({ error: 'Nonce expired. Please try again.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify the nonce is valid (regenerate and compare)
      const isValidNonce = await verifyNonce(walletAddress, timestamp, nonce);
      if (!isValidNonce) {
        console.log(`[verify-wallet] Invalid nonce for ${walletAddress}`);
        return new Response(JSON.stringify({ error: 'Invalid nonce' }), {
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
        
        // Generate a session token
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
  
  const tokenData = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(tokenData + SECRET_KEY);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return btoa(tokenData) + '.' + hash;
}
