import { NextRequest, NextResponse } from 'next/server';
import { verifyWalletBinding, getWalletBinding } from '@/integrations/supabase/admin/wallets';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { verifyWalletSignature, isValidSignatureFormat } from '@/lib/admin/wallet-verify';
import { logAdminAction } from '@/integrations/supabase/admin/audit';

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie or header
    let token = request.cookies.get('admin_token')?.value;
    
    if (!token) {
      const authHeader = request.headers.get('authorization');
      token = extractTokenFromHeader(authHeader);
    }

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    // Get admin ID from session
    const tokenHash = hashToken(token);
    const sessionResult = await getSessionByTokenHash(tokenHash);

    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid session',
        },
        { status: 401 }
      );
    }

    const adminId = sessionResult.session.admin_id;

    // Parse body
    const body = await request.json() as {
      binding_id: string;
      signature: string;
      message: string;
    };

    // Validate inputs
    if (!body.binding_id || !body.signature || !body.message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        { status: 400 }
      );
    }

    // Validate signature format
    if (!isValidSignatureFormat(body.signature)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid signature format',
        },
        { status: 400 }
      );
    }

    // Get binding to verify ownership
    const bindingResult = await getWalletBinding(body.binding_id);
    if (!bindingResult.success || !bindingResult.binding) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet binding not found',
        },
        { status: 404 }
      );
    }

    // Verify binding belongs to current admin
    if (bindingResult.binding.admin_id !== adminId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 403 }
      );
    }

    // Verify wallet signature
    const signatureValid = await verifyWalletSignature(
      bindingResult.binding.wallet_address,
      body.message,
      body.signature
    );

    if (!signatureValid) {
      // Log failed verification
      await logAdminAction(
        adminId,
        'wallet_verify_failed',
        'admin_wallet_binding',
        body.binding_id,
        undefined,
        { reason: 'Invalid signature' },
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      );

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: 'Signature verification failed',
        },
        { status: 401 }
      );
    }

    // Update binding as verified
    const verifyResult = await verifyWalletBinding(body.binding_id, body.signature);

    if (!verifyResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: verifyResult.error,
        },
        { status: 500 }
      );
    }

    // Log successful verification
    await logAdminAction(
      adminId,
      'wallet_verified',
      'admin_wallet_binding',
      body.binding_id,
      { verified: false },
      { verified: true, verified_at: new Date().toISOString() },
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    return NextResponse.json(
      {
        success: true,
        verified: true,
        message: 'Wallet verified successfully',
        binding: verifyResult.binding,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Wallet verify error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Wallet verification failed',
      },
      { status: 500 }
    );
  }
}
