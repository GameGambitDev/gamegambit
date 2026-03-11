import { NextRequest, NextResponse } from 'next/server';
import { createWalletBinding, isWalletBound } from '@/integrations/supabase/admin/wallets';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { validateWalletAddress } from '@/lib/admin/validators';
import { generateVerificationMessage } from '@/lib/admin/wallet-verify';
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
    const body = await request.json() as { wallet_address: string };

    // Validate wallet address
    const validation = validateWalletAddress(body.wallet_address);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // Check if wallet is already bound
    const boundCheck = await isWalletBound(body.wallet_address);
    if (boundCheck.bound) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet is already bound to another admin account',
        },
        { status: 409 }
      );
    }

    // Create wallet binding
    const result = await createWalletBinding(adminId, body.wallet_address);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    // Generate verification message
    const verificationMessage = generateVerificationMessage(adminId);

    // Log wallet bind action
    await logAdminAction(
      adminId,
      'wallet_bind_initiated',
      'admin_wallet_binding',
      result.binding?.id,
      undefined,
      { wallet_address: body.wallet_address },
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Wallet binding initiated. Please sign the verification message.',
        binding: result.binding,
        verificationMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Wallet bind error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to bind wallet',
      },
      { status: 500 }
    );
  }
}
