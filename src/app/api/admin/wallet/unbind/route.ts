import { NextRequest, NextResponse } from 'next/server';
import { deleteWalletBinding, getWalletBinding } from '@/integrations/supabase/admin/wallets';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { logAdminAction } from '@/integrations/supabase/admin/audit';

export async function DELETE(request: NextRequest) {
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

    // Get wallet_id from query params
    const searchParams = request.nextUrl.searchParams;
    const walletId = searchParams.get('wallet_id');

    if (!walletId) {
      return NextResponse.json(
        {
          success: false,
          error: 'wallet_id query parameter is required',
        },
        { status: 400 }
      );
    }

    // Get binding to verify ownership and log
    const bindingResult = await getWalletBinding(walletId);
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

    // Delete wallet binding
    const result = await deleteWalletBinding(walletId, adminId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    // Log unbind action
    await logAdminAction(
      adminId,
      'wallet_unbind',
      'admin_wallet_binding',
      walletId,
      { ...bindingResult.binding },
      { deleted: true },
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Wallet binding removed',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Wallet unbind error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to unbind wallet',
      },
      { status: 500 }
    );
  }
}
