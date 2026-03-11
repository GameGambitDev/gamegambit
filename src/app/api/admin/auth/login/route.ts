import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminUser } from '@/integrations/supabase/admin/auth';
import { validateLoginForm } from '@/lib/admin/validators';
import { logAdminAction } from '@/integrations/supabase/admin/audit';
import type { AdminLoginRequest } from '@/types/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AdminLoginRequest;

    // Validate input
    const validation = validateLoginForm(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password',
        },
        { status: 400 }
      );
    }

    // Authenticate admin
    const result = await authenticateAdminUser({
      email: body.email.toLowerCase(),
      password: body.password,
    });

    if (!result.success) {
      // Log failed login attempt (security logging)
      console.warn('Failed login attempt for email:', body.email);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Authentication failed',
        },
        { status: 401 }
      );
    }

    // Log successful login
    if (result.admin) {
      await logAdminAction(
        result.admin.id,
        'admin_login',
        'admin_user',
        result.admin.id,
        undefined,
        { last_login: new Date().toISOString() },
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      );
    }

    // Create response
    const response = NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        admin: result.admin,
      },
      { status: 200 }
    );

    // Set httpOnly cookie with token
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
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
