import { NextRequest, NextResponse } from 'next/server';
import { logoutAdminUser, getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
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
          error: 'No session found',
        },
        { status: 401 }
      );
    }

    // Hash token to lookup session
    const tokenHash = hashToken(token);

    // Get session to find admin ID for logging
    const sessionResult = await getSessionByTokenHash(tokenHash);
    
    // Logout the session
    const result = await logoutAdminUser(tokenHash);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Logout failed',
        },
        { status: 500 }
      );
    }

    // Log logout action
    if (sessionResult.success && sessionResult.session) {
      await logAdminAction(
        sessionResult.session.admin_id,
        'admin_logout',
        'admin_session',
        sessionResult.session.id,
        undefined,
        { session_id: sessionResult.session.id, timestamp: new Date().toISOString() },
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      );
    }

    // Clear cookie
    const response = NextResponse.json(
      {
        success: true,
        message: 'Logged out successfully',
      },
      { status: 200 }
    );

    response.cookies.set('admin_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
