import { NextRequest, NextResponse } from 'next/server';
import { refreshAdminSession } from '@/integrations/supabase/admin/auth';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { logAdminAction } from '@/integrations/supabase/admin/audit';

export async function POST(request: NextRequest) {
  try {
    // Get old token from cookie or header
    let oldToken = request.cookies.get('admin_token')?.value;
    
    if (!oldToken) {
      const authHeader = request.headers.get('authorization');
      oldToken = extractTokenFromHeader(authHeader);
    }

    if (!oldToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'No session found',
        },
        { status: 401 }
      );
    }

    // Hash token to lookup session
    const oldTokenHash = hashToken(oldToken);

    // Refresh session
    const result = await refreshAdminSession(oldTokenHash);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to refresh session',
        },
        { status: 401 }
      );
    }

    // Log token refresh
    if (result.admin) {
      await logAdminAction(
        result.admin.id,
        'token_refresh',
        'admin_session',
        result.admin.id,
        undefined,
        { refreshed_at: new Date().toISOString() },
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      );
    }

    // Create response
    const response = NextResponse.json(
      {
        success: true,
        message: 'Session refreshed',
        admin: result.admin,
        token: result.token,
      },
      { status: 200 }
    );

    // Set new token in cookie
    if (result.token) {
      response.cookies.set('admin_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: parseInt(process.env.ADMIN_JWT_EXPIRY || '3600'),
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
