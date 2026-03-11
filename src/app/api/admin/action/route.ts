import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionByTokenHash } from '@/integrations/supabase/admin/sessions';
import { hashToken, extractTokenFromHeader } from '@/lib/admin/auth';
import { logAdminAction } from '@/integrations/supabase/admin/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Verify admin session
        const tokenHash = hashToken(token);
        const sessionResult = await getSessionByTokenHash(tokenHash);

        if (!sessionResult.success || !sessionResult.session) {
            return NextResponse.json(
                { success: false, error: 'Invalid session' },
                { status: 401 }
            );
        }

        const adminId = sessionResult.session.admin_id;

        // Parse request body
        const body = await request.json() as {
            action: string;
            adminWallet: string;
            wagerId?: string;
            winnerWallet?: string;
            playerWallet?: string;
            reason?: string;
            notes?: string;
        };

        const {
            action,
            adminWallet,
            wagerId,
            winnerWallet,
            playerWallet,
            reason,
            notes,
        } = body;

        // Validate admin wallet is set (for edge function verification)
        if (!adminWallet) {
            return NextResponse.json(
                { success: false, error: 'Admin wallet required' },
                { status: 400 }
            );
        }

        // Call Supabase edge function
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const functionName = 'admin-action';
        const payload: Record<string, any> = {
            action,
            adminWallet,
        };

        switch (action) {
            case 'forceResolve':
                if (!wagerId || !winnerWallet) {
                    return NextResponse.json(
                        { success: false, error: 'Missing required fields: wagerId, winnerWallet' },
                        { status: 400 }
                    );
                }
                payload.wagerId = wagerId;
                payload.winnerWallet = winnerWallet;
                payload.notes = notes;
                break;

            case 'forceRefund':
                if (!wagerId) {
                    return NextResponse.json(
                        { success: false, error: 'Missing required field: wagerId' },
                        { status: 400 }
                    );
                }
                payload.wagerId = wagerId;
                payload.notes = notes;
                break;

            case 'markDisputed':
                if (!wagerId) {
                    return NextResponse.json(
                        { success: false, error: 'Missing required field: wagerId' },
                        { status: 400 }
                    );
                }
                payload.wagerId = wagerId;
                payload.reason = reason;
                break;

            case 'banPlayer':
            case 'flagPlayer':
            case 'unbanPlayer':
                if (!playerWallet) {
                    return NextResponse.json(
                        { success: false, error: 'Missing required field: playerWallet' },
                        { status: 400 }
                    );
                }
                payload.playerWallet = playerWallet;
                if (reason) payload.reason = reason;
                break;

            default:
                return NextResponse.json(
                    { success: false, error: 'Unknown action' },
                    { status: 400 }
                );
        }

        // Call edge function
        const { data, error } = await supabase.functions.invoke(functionName, {
            body: payload,
        });

        if (error) {
            console.error('[Admin API] Edge function error:', error);
            return NextResponse.json(
                { success: false, error: error.message || 'Edge function failed' },
                { status: 500 }
            );
        }

        // Log admin action
        try {
            await logAdminAction(
                adminId,
                `admin_${action}`,
                action === 'forceResolve' || action === 'forceRefund' || action === 'markDisputed'
                    ? 'wager'
                    : 'player',
                wagerId || playerWallet,
                data?.transactionSignature,
                { ...payload },
                request.headers.get('x-forwarded-for') || 'unknown',
                request.headers.get('user-agent') || 'unknown'
            );
        } catch (logError) {
            console.error('[Admin API] Failed to log action:', logError);
            // Don't fail the request if logging fails
        }

        return NextResponse.json({
            success: true,
            message: `${action} completed successfully`,
            ...data,
        });
    } catch (error) {
        console.error('[Admin API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to process admin action',
            },
            { status: 500 }
        );
    }
}
