import { NextRequest, NextResponse } from 'next/server';
import { getAdminProfile, updateAdminProfile } from '@/integrations/supabase/admin/profile';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { validateProfileUpdate, sanitizeInput } from '@/lib/admin/validators';
import { logAdminAction } from '@/integrations/supabase/admin/audit';
import type { AdminProfileUpdateRequest } from '@/types/admin';

// Get admin profile
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

    // Get profile
    const result = await getAdminProfile(sessionResult.session.admin_id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        admin: result.admin,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch profile',
      },
      { status: 500 }
    );
  }
}

// Update admin profile
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

    // Parse request body
    const body = await request.json() as AdminProfileUpdateRequest;

    // Validate input
    const validation = validateProfileUpdate(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const updateData: AdminProfileUpdateRequest = {};
    if (body.full_name) updateData.full_name = sanitizeInput(body.full_name);
    if (body.username) updateData.username = sanitizeInput(body.username);
    if (body.bio) updateData.bio = sanitizeInput(body.bio);
    if (body.avatar_url) updateData.avatar_url = body.avatar_url;

    // Get old profile for audit log
    const oldResult = await getAdminProfile(adminId);

    // Update profile
    const result = await updateAdminProfile(adminId, updateData);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    // Log update action
    await logAdminAction(
      adminId,
      'profile_update',
      'admin_user',
      adminId,
      oldResult.admin ? { ...oldResult.admin } : undefined,
      { ...result.admin },
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Profile updated successfully',
        admin: result.admin,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update profile',
      },
      { status: 500 }
    );
  }
}
