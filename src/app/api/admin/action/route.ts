import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {
            action: string;
            adminWallet: string;
            wagerId?: string;
            winnerWallet?: string;
            playerWallet?: string;
            reason?: string;
            notes?: string;
        };

        const { action, adminWallet, wagerId, winnerWallet, playerWallet, reason, notes } = body;

        if (!adminWallet) {
            return NextResponse.json({ success: false, error: 'Admin wallet required' }, { status: 400 });
        }

        // Map camelCase frontend action names → snake_case edge function action names
        // (actions.ts sends snake_case, but handle both just in case)
        const actionMap: Record<string, string> = {
            force_resolve: 'forceResolve',
            force_refund: 'forceRefund',
            mark_disputed: 'markDisputed',
            ban_player: 'banPlayer',
            flag_player: 'flagPlayer',
            unban_player: 'unbanPlayer',
            // pass-through if already camelCase
            forceResolve: 'forceResolve',
            forceRefund: 'forceRefund',
            markDisputed: 'markDisputed',
            banPlayer: 'banPlayer',
            flagPlayer: 'flagPlayer',
            unbanPlayer: 'unbanPlayer',
            checkPdaBalance: 'checkPdaBalance',
            addNote: 'addNote',
        };

        const edgeAction = actionMap[action];
        if (!edgeAction) {
            return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }

        // Validate required fields per action
        if ((edgeAction === 'forceResolve') && (!wagerId || !winnerWallet)) {
            return NextResponse.json({ success: false, error: 'Missing required fields: wagerId, winnerWallet' }, { status: 400 });
        }
        if (['forceRefund', 'markDisputed', 'checkPdaBalance'].includes(edgeAction) && !wagerId) {
            return NextResponse.json({ success: false, error: 'Missing required field: wagerId' }, { status: 400 });
        }
        if (['banPlayer', 'flagPlayer', 'unbanPlayer'].includes(edgeAction) && !playerWallet) {
            return NextResponse.json({ success: false, error: 'Missing required field: playerWallet' }, { status: 400 });
        }

        // Build payload for edge function
        const payload: Record<string, unknown> = {
            action: edgeAction,
            adminWallet,
            ...(wagerId && { wagerId }),
            ...(winnerWallet && { winnerWallet }),
            ...(playerWallet && { playerWallet }),
            ...(reason && { reason }),
            ...(notes && { notes }),
        };

        // Call admin-action edge function directly with service role key
        const edgeRes = await fetch(`${supabaseUrl}/functions/v1/admin-action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
            },
            body: JSON.stringify(payload),
        });

        const data = await edgeRes.json().catch(() => ({ error: edgeRes.statusText }));

        if (!edgeRes.ok) {
            console.error('[Admin API] Edge function error:', data);
            return NextResponse.json(
                { success: false, error: (data as { error?: string }).error || 'Edge function failed' },
                { status: edgeRes.status }
            );
        }

        return NextResponse.json({ success: true, message: `${edgeAction} completed successfully`, ...data });

    } catch (error) {
        console.error('[Admin API] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to process admin action' },
            { status: 500 }
        );
    }
}