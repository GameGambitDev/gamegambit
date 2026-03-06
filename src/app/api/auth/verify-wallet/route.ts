import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, signature, message } = body;

        console.log('[verify-wallet] Received verification request for:', walletAddress);

        if (!walletAddress || !signature || !message) {
            return NextResponse.json(
                { error: 'Missing required fields', success: false },
                { status: 400 }
            );
        }

        const messageBuffer = Buffer.from(message);
        const signatureBuffer = Buffer.from(signature, 'base64');
        const publicKeyBuffer = bs58.decode(walletAddress);

        console.log('[verify-wallet] Verifying signature...');
        const isValid = nacl.sign.detached.verify(
            messageBuffer,
            signatureBuffer,
            publicKeyBuffer
        );

        if (!isValid) {
            console.error('[verify-wallet] Invalid signature for wallet:', walletAddress);
            return NextResponse.json(
                { error: 'Invalid signature', success: false },
                { status: 401 }
            );
        }

        const secret = process.env.WALLET_AUTH_SECRET;
        if (!secret) throw new Error('WALLET_AUTH_SECRET env var not set');

        const payload = {
            wallet: walletAddress,
            exp: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
        };

        const payloadStr = JSON.stringify(payload);
        const payloadB64 = Buffer.from(payloadStr).toString('base64');

        const encoder = new TextEncoder();
        const data = encoder.encode(payloadStr + secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const sessionToken = `${payloadB64}.${hash}`;

        console.log('[verify-wallet] Successfully verified wallet:', walletAddress);

        return NextResponse.json({
            success: true,
            sessionToken,
            walletAddress,
            message: 'Wallet verified successfully',
        });

    } catch (error) {
        console.error('[verify-wallet] Server error:', error);
        return NextResponse.json(
            { error: 'Internal server error', success: false },
            { status: 500 }
        );
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}