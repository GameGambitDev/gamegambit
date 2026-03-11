import { NextRequest, NextResponse } from 'next/server';
import { createAdminUser, emailExists } from '@/integrations/supabase/admin/auth';
import { logAdminAction } from '@/integrations/supabase/admin/audit';
import type { AdminSignupRequest } from '@/types/admin';
import { validateSignupForm, sanitizeInput } from '@/lib/admin/validators';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AdminSignupRequest;

    // Validate input
    const validation = validateSignupForm(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }

    // Check if email already exists
    const exists = await emailExists(body.email);
    if (exists) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Create admin user
    const result = await createAdminUser({
      email: body.email.toLowerCase(),
      password: body.password,
      full_name: body.full_name ? sanitizeInput(body.full_name) : undefined,
      username: body.username ? sanitizeInput(body.username) : undefined,
    });

    if (!result.success) {
      console.error('Signup error:', result.error);
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create admin account' },
        { status: 500 }
      );
    }

    // Log signup action
    if (result.admin) {
      await logAdminAction(
        result.admin.id,
        'admin_signup',
        'admin_user',
        result.admin.id,
        undefined,
        { email: result.admin.email, role: result.admin.role },
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      );
    }

    const response = NextResponse.json(
      { success: true, message: 'Admin account created successfully', admin: result.admin },
      { status: 201 }
    );

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
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}