import { NextRequest, NextResponse } from 'next/server';
import { getAdminWallets, setPrimaryWallet } from '@/integrations/supabase/admin/wallets';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { logAdminAction } from '@/integrations/supabase/admin/audit';

// Get all wallets for admin
export async function GET(request: NextRequest) {
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

    // Get wallets
    const result = await getAdminWallets(sessionResult.session.admin_id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        wallets: result.wallets || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get wallets error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch wallets',
      },
      { status: 500 }
    );
  }
}

// Set primary wallet
export async function PUT(request: NextRequest) {
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
    const body = await request.json() as { wallet_id: string };

    if (!body.wallet_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'wallet_id is required',
        },
        { status: 400 }
      );
    }

    // Set primary wallet
    const result = await setPrimaryWallet(adminId, body.wallet_id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    // Log action
    await logAdminAction(
      adminId,
      'wallet_primary_set',
      'admin_wallet_binding',
      body.wallet_id,
      undefined,
      { is_primary: true },
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Primary wallet updated',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Set primary wallet error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to set primary wallet',
      },
      { status: 500 }
    );
  }
}
