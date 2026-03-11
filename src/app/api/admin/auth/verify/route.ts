import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';

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
          valid: false,
          error: 'No session found',
        },
        { status: 401 }
      );
    }

    // Hash token to lookup session
    const tokenHash = hashToken(token);

    // Verify session
    const result = await verifyAdminSession(tokenHash);

    if (!result.valid) {
      // Clear cookie if session is invalid
      const response = NextResponse.json(
        {
          valid: false,
          error: result.error || 'Session invalid or expired',
        },
        { status: 401 }
      );

      response.cookies.set('admin_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      {
        valid: true,
        admin: result.admin,
        expiresAt: result.expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      {
        valid: false,
        error: 'Verification failed',
      },
      { status: 500 }
    );
  }
}
