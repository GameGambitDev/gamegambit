// supabase/functions/secure-wager/index.ts
//
// Entry point — HTTP routing only.
// Auth lives in ./auth.ts
// Solana plumbing lives in ./solana.ts
// Push/in-app notifications live in ./notifications.ts
// All action handlers live in ./actions.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateSessionToken } from "./auth.ts";
import {
    handleCreate,
    handleJoin,
    handleVote,
    handleEdit,
    handleApplyProposal,
    handleNotifyChat,
    handleNotifyProposal,
    handleNotifyRematch,
    handleDelete,
    handleSetReady,
    handleStartGame,
    handleRecordOnChainCreate,
    handleRecordOnChainJoin,
    handleCheckGameComplete,
    handleCancelWager,
    handleMarkGameComplete,
    handleSubmitVote,
    handleRetractVote,
} from "./actions.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Actions that don't require a session token
const PUBLIC_ACTIONS = ['checkGameComplete'];

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const respond = (body: unknown, status = 200): Response =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    try {
        const sessionToken = req.headers.get('X-Session-Token')?.trim();
        const { action, ...data } = await req.json();
        console.log(`[secure-wager] action: ${action}`);

        // ── Auth ───────────────────────────────────────────────────────────────
        let walletAddress = '';
        if (!PUBLIC_ACTIONS.includes(action)) {
            if (!sessionToken) return respond({ error: 'Wallet verification required' }, 401);
            const verified = await validateSessionToken(sessionToken);
            if (!verified) return respond({ error: 'Invalid or expired session' }, 401);
            walletAddress = verified;
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ── Dispatch ───────────────────────────────────────────────────────────
        switch (action) {
            case 'create':              return await handleCreate(supabase, walletAddress, data, respond);
            case 'join':                return await handleJoin(supabase, walletAddress, data, respond);
            case 'vote':                return await handleVote(supabase, walletAddress, data, respond);
            case 'edit':                return await handleEdit(supabase, walletAddress, data, respond);
            case 'applyProposal':       return await handleApplyProposal(supabase, walletAddress, data, respond);
            case 'notifyChat':          return await handleNotifyChat(supabase, walletAddress, data, respond);
            case 'notifyProposal':      return await handleNotifyProposal(supabase, walletAddress, data, respond);
            case 'notifyRematch':       return await handleNotifyRematch(supabase, walletAddress, data, respond);
            case 'delete':              return await handleDelete(supabase, walletAddress, data, respond);
            case 'setReady':            return await handleSetReady(supabase, walletAddress, data, respond);
            case 'startGame':           return await handleStartGame(supabase, walletAddress, data, respond);
            case 'recordOnChainCreate': return await handleRecordOnChainCreate(supabase, walletAddress, data, respond);
            case 'recordOnChainJoin':   return await handleRecordOnChainJoin(supabase, walletAddress, data, respond);
            case 'checkGameComplete':   return await handleCheckGameComplete(supabase, walletAddress, data, respond);
            case 'cancelWager':         return await handleCancelWager(supabase, walletAddress, data, respond);
            case 'markGameComplete':    return await handleMarkGameComplete(supabase, walletAddress, data, respond);
            case 'submitVote':          return await handleSubmitVote(supabase, walletAddress, data, respond);
            case 'retractVote':         return await handleRetractVote(supabase, walletAddress, data, respond);
            default:                    return respond({ error: 'Invalid action' }, 400);
        }

    } catch (error) {
        console.error('[secure-wager] Error:', error);
        return respond({ error: 'Internal server error' }, 500);
    }
});
