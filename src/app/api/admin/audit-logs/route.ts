import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuditLogs, searchAuditLogs, getActionStats } from '@/integrations/supabase/admin/audit';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { canViewAuditLogs } from '@/lib/admin/permissions';
import { getAdminById } from '@/integrations/supabase/admin/auth';

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

    const adminId = sessionResult.session.admin_id;

    // Check permissions
    const adminResult = await getAdminById(adminId);
    if (!adminResult.success || !adminResult.admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found',
        },
        { status: 404 }
      );
    }

    // Check if admin has permission to view audit logs
    if (!canViewAuditLogs(adminResult.admin)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions',
        },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const stats = searchParams.get('stats') === 'true';

    // If search query provided, use search
    if (search) {
      const result = await searchAuditLogs(search, limit);
      
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
          logs: result.logs || [],
        },
        { status: 200 }
      );
    }

    // Get logs for this admin
    const logsResult = await getAdminAuditLogs(adminId, limit, offset);

    if (!logsResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: logsResult.error,
        },
        { status: 500 }
      );
    }

    // Get stats if requested
    let statsData;
    if (stats) {
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const statsResult = await getActionStats(startDate || undefined, endDate || undefined);
      
      if (statsResult.success) {
        statsData = statsResult.stats;
      }
    }

    return NextResponse.json(
      {
        success: true,
        logs: logsResult.logs || [],
        total: logsResult.total,
        stats: statsData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch audit logs',
      },
      { status: 500 }
    );
  }
}
