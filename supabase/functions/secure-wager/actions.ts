// supabase/functions/secure-wager/actions.ts
//
// All 18 wager action handlers. Each function receives:
//   - supabase client
//   - walletAddress of the authenticated caller
//   - data: the request body (minus `action`)
//   - respond: the HTTP response helper
//
// Imports Solana helpers from ./solana.ts and notification helpers from ./notifications.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    getSolana,
    loadAuthorityKeypair,
    deriveWagerPda,
    buildCloseWagerIx,
    resolveOnChain,
} from "./solana.ts";
import { getDisplayName, insertNotifications } from "./notifications.ts";

type Supabase = ReturnType<typeof createClient>;
type Respond = (body: unknown, status?: number) => Response;

// ── Shared wager fetcher ──────────────────────────────────────────────────────

async function getWager(supabase: Supabase, wagerId: string) {
    const { data: w, error } = await supabase.from('wagers').select('*').eq('id', wagerId).single();
    if (error || !w) throw new Error('Wager not found');
    return w;
}

// ── create ────────────────────────────────────────────────────────────────────

export async function handleCreate(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { game, stake_lamports, is_public, stream_url, chess_clock_limit, chess_clock_increment, chess_rated, chess_side_preference } = data;
    if (!game || !['chess', 'codm', 'pubg', 'free_fire'].includes(game as string)) return respond({ error: 'Invalid game type' }, 400);
    if (!stake_lamports || (stake_lamports as number) <= 0) return respond({ error: 'Invalid stake amount' }, 400);

    if (game === 'chess') {
        const { data: p } = await supabase.from('players').select('lichess_username').eq('wallet_address', walletAddress).single();
        if (!p?.lichess_username) return respond({ error: 'Connect your Lichess account before creating chess wagers' }, 400);
    }

    const { data: newWager, error } = await supabase.from('wagers').insert({
        player_a_wallet: walletAddress,
        game,
        stake_lamports,
        is_public: is_public !== false,
        stream_url: stream_url || null,
        ...(game === 'chess' && {
            chess_clock_limit: chess_clock_limit ?? 300,
            chess_clock_increment: chess_clock_increment ?? 3,
            chess_rated: chess_rated ?? false,
            chess_side_preference: chess_side_preference ?? 'random',
        }),
    }).select().single();

    if (error) {
        console.error('[actions] create error:', error);
        return respond({ error: 'Failed to create wager' }, 500);
    }
    return respond({ wager: newWager });
}

// ── join ──────────────────────────────────────────────────────────────────────

export async function handleJoin(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId } = data;
    if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.status !== 'created') return respond({ error: 'Wager is not available to join' }, 400);
    if (wager.player_a_wallet === walletAddress) return respond({ error: 'Cannot join your own wager' }, 400);

    if (wager.game === 'chess') {
        const { data: p } = await supabase.from('players').select('lichess_username').eq('wallet_address', walletAddress).single();
        if (!p?.lichess_username) return respond({ error: 'Connect your Lichess account before joining chess wagers' }, 400);
    }

    const { data: updatedWager, error } = await supabase.from('wagers')
        .update({ player_b_wallet: walletAddress, status: 'joined' })
        .eq('id', wagerId).eq('status', 'created').select().single();
    if (error) return respond({ error: 'Failed to join wager' }, 500);

    const joinerName = await getDisplayName(supabase, walletAddress);
    await insertNotifications(supabase, [{
        player_wallet: wager.player_a_wallet,
        type: 'wager_joined',
        title: 'Someone joined your wager!',
        message: `${joinerName} accepted your wager. Head to the Ready Room to get started.`,
        wager_id: wagerId as string,
    }]);

    return respond({ wager: updatedWager });
}

// ── vote (legacy chess vote path — kept for backwards compat) ─────────────────

export async function handleVote(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, votedWinner } = data;
    if (!wagerId || !votedWinner) return respond({ error: 'Wager ID and voted winner required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.game === 'chess') return respond({ error: 'Chess wagers resolve automatically via Lichess.' }, 400);
    const isPlayerA = wager.player_a_wallet === walletAddress;
    const isPlayerB = wager.player_b_wallet === walletAddress;
    if (!isPlayerA && !isPlayerB) return respond({ error: 'You are not a participant' }, 403);
    if (votedWinner !== wager.player_a_wallet && votedWinner !== wager.player_b_wallet) return respond({ error: 'Invalid winner selection' }, 400);
    if (isPlayerA && wager.vote_player_a) return respond({ error: 'You have already voted' }, 400);
    if (isPlayerB && wager.vote_player_b) return respond({ error: 'You have already voted' }, 400);
    const otherVote = isPlayerA ? wager.vote_player_b : wager.vote_player_a;
    const voteField = isPlayerA ? 'vote_player_a' : 'vote_player_b';
    const updateData: Record<string, unknown> = { [voteField]: votedWinner, vote_timestamp: new Date().toISOString(), status: 'voting' };
    let voteResultStatus = 'pending';
    if (otherVote && otherVote === votedWinner) { updateData.status = 'retractable'; updateData.retract_deadline = new Date(Date.now() + 15_000).toISOString(); voteResultStatus = 'agreed'; }
    else if (otherVote && otherVote !== votedWinner) { updateData.status = 'disputed'; voteResultStatus = 'disputed'; }
    const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
    if (error) return respond({ error: 'Failed to submit vote' }, 500);

    const opponentWallet = isPlayerA ? wager.player_b_wallet : wager.player_a_wallet;
    if (opponentWallet) {
        const voterName = await getDisplayName(supabase, walletAddress);
        const votedForSelf = votedWinner === walletAddress;
        let title = 'Opponent voted', message = '';
        if (voteResultStatus === 'agreed') { title = '✅ Result agreed!'; message = 'Both players agree. The result is being confirmed.'; }
        else if (voteResultStatus === 'disputed') { title = '⚠️ Result disputed'; message = `${voterName} voted differently. Submit your vote to resolve the dispute.`; }
        else { message = `${voterName} voted ${votedForSelf ? 'themselves' : 'you'} as the winner. Submit your vote to confirm.`; }
        await insertNotifications(supabase, [{ player_wallet: opponentWallet, type: 'wager_vote', title, message, wager_id: wagerId as string }]);
    }
    return respond({ wager: updatedWager });
}

// ── edit ──────────────────────────────────────────────────────────────────────

export async function handleEdit(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, stake_lamports, lichess_game_id, stream_url, is_public } = data;
    if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.player_a_wallet !== walletAddress) return respond({ error: 'Only the wager owner can edit' }, 403);

    const updateData: Record<string, unknown> = {};
    if (wager.status === 'created') {
        if (stake_lamports !== undefined) updateData.stake_lamports = stake_lamports;
        if (is_public !== undefined) updateData.is_public = is_public;
        if (lichess_game_id !== undefined) updateData.lichess_game_id = lichess_game_id || null;
    }
    if (stream_url !== undefined) updateData.stream_url = stream_url || null;
    if (Object.keys(updateData).length === 0) return respond({ wager }, 200);

    const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
    if (error) return respond({ error: 'Failed to edit wager' }, 500);
    return respond({ wager: updatedWager });
}

// ── applyProposal ─────────────────────────────────────────────────────────────

export async function handleApplyProposal(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, field, newValue } = data;
    if (!wagerId || !field || newValue === undefined) return respond({ error: 'wagerId, field, and newValue required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    const isParticipant = wager.player_a_wallet === walletAddress || wager.player_b_wallet === walletAddress;
    if (!isParticipant) return respond({ error: 'Not a participant in this wager' }, 403);
    const allowedFields = ['stake_lamports', 'is_public', 'stream_url'];
    if (!allowedFields.includes(field as string)) return respond({ error: `Field '${field}' cannot be changed via proposal` }, 400);
    if (field === 'stake_lamports' && (typeof newValue !== 'number' || newValue <= 0)) return respond({ error: 'Invalid stake amount' }, 400);
    const { data: updatedWager, error } = await supabase.from('wagers').update({ [field as string]: newValue }).eq('id', wagerId).select().single();
    if (error) return respond({ error: 'Failed to apply proposal' }, 500);
    console.log(`[actions] applyProposal: ${field as string} = ${newValue} on wager ${wagerId as string} by ${walletAddress}`);
    return respond({ wager: updatedWager });
}

// ── notifyChat ────────────────────────────────────────────────────────────────

export async function handleNotifyChat(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId } = data;
    if (!wagerId) return respond({ error: 'wagerId required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    const opponentWallet = wager.player_a_wallet === walletAddress ? wager.player_b_wallet : wager.player_a_wallet;
    if (!opponentWallet) return respond({ ok: true });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent } = await supabase.from('notifications').select('id')
        .eq('player_wallet', opponentWallet).eq('wager_id', wagerId).eq('type', 'chat_message')
        .gte('created_at', fiveMinutesAgo).limit(1);
    if (recent && recent.length > 0) return respond({ ok: true, skipped: true });

    const senderName = await getDisplayName(supabase, walletAddress);
    await insertNotifications(supabase, [{ player_wallet: opponentWallet, type: 'chat_message', title: 'New message', message: `${senderName} is messaging you in the ready room.`, wager_id: wagerId as string }]);
    return respond({ ok: true });
}

// ── notifyProposal ────────────────────────────────────────────────────────────

export async function handleNotifyProposal(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, proposalCount } = data;
    if (!wagerId) return respond({ error: 'wagerId required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    const opponentWallet = wager.player_a_wallet === walletAddress ? wager.player_b_wallet : wager.player_a_wallet;
    if (!opponentWallet) return respond({ ok: true });
    const senderName = await getDisplayName(supabase, walletAddress);
    const count = typeof proposalCount === 'number' && proposalCount > 1 ? proposalCount : 1;
    await insertNotifications(supabase, [{ player_wallet: opponentWallet, type: 'wager_proposal', title: 'Wager change proposed', message: `${senderName} proposed ${count > 1 ? `${count} changes` : 'a change'} to your wager. Open the ready room to review.`, wager_id: wagerId as string }]);
    return respond({ ok: true });
}

// ── notifyRematch ─────────────────────────────────────────────────────────────

export async function handleNotifyRematch(supabase: Supabase, _walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, opponentWallet, fromUsername, game, stake } = data as { wagerId: string; opponentWallet: string; fromUsername: string; game: string; stake: number };
    if (!wagerId || !opponentWallet) return respond({ error: 'wagerId and opponentWallet required' }, 400);
    const stakeSol = (stake / 1_000_000_000).toFixed(4);
    await insertNotifications(supabase, [{ player_wallet: opponentWallet, type: 'rematch_challenge', title: '⚔️ Rematch challenge!', message: `${fromUsername} wants a rematch — ${game.toUpperCase()} for ${stakeSol} SOL. Check Open Wagers to accept!`, wager_id: wagerId }]);
    return respond({ ok: true });
}

// ── delete ────────────────────────────────────────────────────────────────────

export async function handleDelete(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId } = data;
    if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.player_a_wallet !== walletAddress) return respond({ error: 'Only the wager owner can delete' }, 403);
    if (wager.status !== 'created') return respond({ error: 'Cannot delete a wager that has been accepted' }, 400);
    const { error } = await supabase.from('wagers').delete().eq('id', wagerId);
    if (error) return respond({ error: 'Failed to delete wager' }, 500);
    return respond({ success: true });
}

// ── setReady ──────────────────────────────────────────────────────────────────

export async function handleSetReady(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, ready } = data;
    if (!wagerId || ready === undefined) return respond({ error: 'Wager ID and ready status required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.status !== 'joined') return respond({ error: 'Wager must be in joined status' }, 400);
    const isPlayerA = wager.player_a_wallet === walletAddress;
    const isPlayerB = wager.player_b_wallet === walletAddress;
    if (!isPlayerA && !isPlayerB) return respond({ error: 'You are not a participant' }, 403);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('set_player_ready', {
        p_wager_id: wagerId, p_is_player_a: isPlayerA, p_ready: ready,
    });

    if (rpcError) {
        console.warn('[actions] set_player_ready RPC unavailable, fallback:', rpcError.message);
        const readyField = isPlayerA ? 'ready_player_a' : 'ready_player_b';
        const { error: step1Error } = await supabase.from('wagers').update({ [readyField]: ready }).eq('id', wagerId);
        if (step1Error) return respond({ error: 'Failed to set ready status' }, 500);
        const fresh = await getWager(supabase, wagerId as string);
        const bothReady = fresh.ready_player_a && fresh.ready_player_b;
        const shouldStartCountdown = bothReady && !fresh.countdown_started_at;
        const shouldClearCountdown = !fresh.ready_player_a || !fresh.ready_player_b;
        if (shouldStartCountdown || shouldClearCountdown) {
            await supabase.from('wagers').update({ countdown_started_at: shouldStartCountdown ? new Date(Date.now() - 1000).toISOString() : null }).eq('id', wagerId).eq('ready_player_a', fresh.ready_player_a).eq('ready_player_b', fresh.ready_player_b);
        }
        return respond({ wager: await getWager(supabase, wagerId as string) });
    }
    return respond({ wager: rpcResult });
}

// ── startGame ─────────────────────────────────────────────────────────────────

export async function handleStartGame(supabase: Supabase, _walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId } = data;
    if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.status === 'voting') return respond({ wager });
    if (!wager.ready_player_a || !wager.ready_player_b) return respond({ error: 'Both players must be ready' }, 400);
    if (!wager.countdown_started_at) return respond({ error: 'Countdown not started' }, 400);
    const bothDeposited = wager.deposit_player_a && wager.deposit_player_b;
    const elapsed = Date.now() - new Date(wager.countdown_started_at).getTime();
    if (!bothDeposited && elapsed < 11_000) return respond({ error: 'Waiting for both players to deposit', elapsed, bothDeposited }, 400);
    const { data: updatedWager, error } = await supabase.from('wagers').update({ status: 'voting' }).eq('id', wagerId).eq('status', 'joined').select().single();
    if (error || !updatedWager) return respond({ wager: await getWager(supabase, wagerId as string) });
    return respond({ wager: updatedWager });
}

// ── recordOnChainCreate ───────────────────────────────────────────────────────

export async function handleRecordOnChainCreate(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, txSignature } = data;
    if (!wagerId) return respond({ error: 'wagerId required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.player_a_wallet !== walletAddress) return respond({ error: 'Only Player A can record create deposit' }, 403);

    const updatePayload: Record<string, unknown> = { deposit_player_a: true };
    if (txSignature) updatePayload.tx_signature_a = txSignature;
    const bothDeposited = wager.deposit_player_b === true;
    if (bothDeposited) updatePayload.status = 'voting';

    const { data: updated, error } = await supabase.from('wagers').update(updatePayload).eq('id', wagerId).select().single();
    if (error) return respond({ error: 'Failed to record deposit' }, 500);

    if (bothDeposited) {
        return await _handleBothDeposited(supabase, wagerId as string, wager, updated, respond);
    }
    return respond({ success: true, wager: updated, gameStarted: false });
}

// ── recordOnChainJoin ─────────────────────────────────────────────────────────

export async function handleRecordOnChainJoin(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, txSignature } = data;
    if (!wagerId) return respond({ error: 'wagerId required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.player_b_wallet !== walletAddress) return respond({ error: 'Only Player B can record join deposit' }, 403);

    const updatePayload: Record<string, unknown> = { deposit_player_b: true };
    if (txSignature) updatePayload.tx_signature_b = txSignature;
    const bothDeposited = wager.deposit_player_a === true;
    if (bothDeposited) updatePayload.status = 'voting';

    const { data: updated, error } = await supabase.from('wagers').update(updatePayload).eq('id', wagerId).select().single();
    if (error) return respond({ error: 'Failed to record deposit' }, 500);

    if (bothDeposited) {
        return await _handleBothDeposited(supabase, wagerId as string, wager, updated, respond);
    }
    return respond({ success: true, wager: updated, gameStarted: false });
}

// shared "both deposited" logic for create + join
async function _handleBothDeposited(supabase: Supabase, wagerId: string, wager: Record<string, unknown>, updated: Record<string, unknown>, respond: Respond) {
    if (wager.game === 'chess') {
        console.log(`[actions] Both deposited on chess wager ${wagerId} — creating Lichess game`);
        const lichessResult = await tryCreateLichessGame(supabase, wagerId, wager);
        await insertNotifications(supabase, [
            { player_wallet: wager.player_a_wallet as string, type: 'game_started', title: 'Game started!', message: 'Both players deposited. Your Lichess game is ready.', wager_id: wagerId },
            { player_wallet: wager.player_b_wallet as string, type: 'game_started', title: 'Game started!', message: 'Both players deposited. Your Lichess game is ready.', wager_id: wagerId },
        ]);
        return respond({ success: true, wager: { ...updated, ...lichessResult }, gameStarted: true });
    } else {
        await insertNotifications(supabase, [
            { player_wallet: wager.player_a_wallet as string, type: 'game_started', title: 'Game started!', message: 'Both players deposited. The game is live — good luck!', wager_id: wagerId },
            { player_wallet: wager.player_b_wallet as string, type: 'game_started', title: 'Game started!', message: 'Both players deposited. The game is live — good luck!', wager_id: wagerId },
        ]);
        return respond({ success: true, wager: updated, gameStarted: true });
    }
}

// ── checkGameComplete (chess/Lichess polling) ─────────────────────────────────

export async function handleCheckGameComplete(supabase: Supabase, _walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId } = data;
    if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (!['voting', 'joined'].includes(wager.status)) return respond({ gameComplete: false, message: 'Wager not in active game state' });
    if (wager.game !== 'chess' || !wager.lichess_game_id) return respond({ gameComplete: false, message: 'No Lichess game linked' });

    try {
        const lichessResponse = await fetch(`https://lichess.org/api/game/${wager.lichess_game_id}`, { headers: { Accept: 'application/json' } });
        if (!lichessResponse.ok) return respond({ gameComplete: false, message: 'Could not fetch game from Lichess' });
        const game = await lichessResponse.json();
        console.log(`[actions] Lichess ${wager.lichess_game_id}: status=${game.status} winner=${game.winner}`);

        const finishedStatuses = ['mate', 'resign', 'outoftime', 'draw', 'stalemate', 'timeout', 'cheat', 'noStart', 'aborted'];
        if (!finishedStatuses.includes(game.status)) return respond({ gameComplete: false, status: game.status, message: 'Game still in progress' });

        const [{ data: pA }, { data: pB }] = await Promise.all([
            supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_a_wallet).single(),
            supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_b_wallet).single(),
        ]);

        const playerAUsername = (pA?.lichess_username || '').toLowerCase().trim();
        const playerBUsername = (pB?.lichess_username || '').toLowerCase().trim();
        const whiteUser = (game.players?.white?.userId || game.players?.white?.user?.id || game.players?.white?.user?.name || '').toLowerCase().trim();
        const blackUser = (game.players?.black?.userId || game.players?.black?.user?.id || game.players?.black?.user?.name || '').toLowerCase().trim();

        let winnerWallet: string | null = null;
        let resultType: 'playerA' | 'playerB' | 'draw' | 'unknown' = 'unknown';
        const drawStatuses = ['draw', 'stalemate', 'aborted', 'noStart'];
        if (drawStatuses.includes(game.status) || !game.winner) {
            resultType = 'draw';
        } else {
            const winnerLichessUser = game.winner === 'white' ? whiteUser : blackUser;
            if (playerAUsername && winnerLichessUser === playerAUsername) { winnerWallet = wager.player_a_wallet; resultType = 'playerA'; }
            else if (playerBUsername && winnerLichessUser === playerBUsername) { winnerWallet = wager.player_b_wallet; resultType = 'playerB'; }
            else { resultType = 'unknown'; }
        }

        if (resultType === 'unknown') {
            return respond({ gameComplete: true, status: game.status, winner: game.winner, resultType: 'unknown', message: `Cannot match players. A="${playerAUsername}" B="${playerBUsername}". white="${whiteUser}" black="${blackUser}".` });
        }

        const { data: updatedWager, error: updateError } = await supabase.from('wagers')
            .update({ status: 'resolved', winner_wallet: resultType === 'draw' ? null : winnerWallet, resolved_at: new Date().toISOString() })
            .eq('id', wagerId).in('status', ['voting', 'joined']).select().single();
        if (updateError || !updatedWager) return respond({ gameComplete: true, message: 'Already resolved by concurrent request' });

        const stake = wager.stake_lamports as number;
        const payout = Math.floor(stake * 2 * 0.9);
        const payoutSol = (payout / 1e9).toFixed(4);

        if (resultType === 'draw') {
            await insertNotifications(supabase, [
                { player_wallet: wager.player_a_wallet, type: 'wager_draw', title: 'Game ended in a draw', message: 'Your stake has been refunded in full.', wager_id: wagerId as string },
                { player_wallet: wager.player_b_wallet, type: 'wager_draw', title: 'Game ended in a draw', message: 'Your stake has been refunded in full.', wager_id: wagerId as string },
            ]);
        } else if (winnerWallet) {
            const loserWallet = winnerWallet === wager.player_a_wallet ? wager.player_b_wallet : wager.player_a_wallet;
            await insertNotifications(supabase, [
                { player_wallet: winnerWallet, type: 'wager_won', title: '🏆 You won!', message: `${payoutSol} SOL has been sent to your wallet.`, wager_id: wagerId as string },
                { player_wallet: loserWallet as string, type: 'wager_lost', title: 'You lost this one', message: 'Better luck next time.', wager_id: wagerId as string },
            ]);
        }

        const txSig = await resolveOnChain(supabase, wager, winnerWallet, resultType as 'playerA' | 'playerB' | 'draw');
        return respond({ gameComplete: true, status: game.status, winner: game.winner, resultType, winnerWallet: resultType === 'draw' ? null : winnerWallet, isDraw: resultType === 'draw', wager: updatedWager, txSignature: txSig, explorerUrl: txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet` : null });
    } catch (lichessError) {
        console.error('[actions] Lichess API error:', lichessError);
        return respond({ gameComplete: false, message: 'Error checking Lichess game' });
    }
}

// ── cancelWager ───────────────────────────────────────────────────────────────

export async function handleCancelWager(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, reason } = data;
    if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (!['joined', 'voting'].includes(wager.status)) return respond({ error: 'Wager cannot be cancelled in current status' }, 400);
    const isPlayerA = wager.player_a_wallet === walletAddress;
    const isPlayerB = wager.player_b_wallet === walletAddress;
    if (!isPlayerA && !isPlayerB) return respond({ error: 'Only participants can cancel the wager' }, 403);

    const { data: updatedWager, error: updateError } = await supabase.from('wagers')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: walletAddress, cancel_reason: reason || 'user_requested', ready_player_a: false, ready_player_b: false, countdown_started_at: null })
        .eq('id', wagerId).select().single();
    if (updateError) return respond({ error: 'Failed to cancel wager' }, 500);

    try { await supabase.from('wager_transactions').insert({ wager_id: wagerId, tx_type: 'cancelled', wallet_address: wager.player_a_wallet, amount_lamports: 0, status: 'confirmed' }); } catch { /* non-critical */ }

    if (wager.player_b_wallet) {
        try {
            const { Connection, PublicKey } = await getSolana();
            const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';
            const connection = new Connection(rpcUrl, 'confirmed');
            const authority = await loadAuthorityKeypair();
            const playerAPubkey = new PublicKey(wager.player_a_wallet);
            const playerBPubkey = new PublicKey(wager.player_b_wallet);
            const wagerPda = await deriveWagerPda(wager.player_a_wallet, BigInt(wager.match_id));
            const pdaBalance = await connection.getBalance(wagerPda);
            if (pdaBalance > 0) {
                const ix = await buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey);
                const { sendAndConfirm } = await import("./solana.ts");
                const txSig = await sendAndConfirm(connection, authority, ix);
                console.log(`[actions] Cancel refund tx: ${txSig}`);
                await supabase.from('wager_transactions').upsert([
                    { wager_id: wagerId, tx_type: 'cancel_refund', wallet_address: wager.player_a_wallet, amount_lamports: wager.stake_lamports, tx_signature: txSig, status: 'confirmed' },
                    { wager_id: wagerId, tx_type: 'cancel_refund', wallet_address: wager.player_b_wallet, amount_lamports: wager.stake_lamports, tx_signature: txSig, status: 'confirmed' },
                ], { onConflict: 'tx_signature', ignoreDuplicates: true });
            }
        } catch (e: unknown) { console.error('[actions] Cancel refund failed:', e instanceof Error ? e.message : String(e)); }
    }

    const otherPlayer = walletAddress === wager.player_a_wallet ? wager.player_b_wallet : wager.player_a_wallet;
    if (otherPlayer) {
        const cancellerName = await getDisplayName(supabase, walletAddress);
        await insertNotifications(supabase, [{ player_wallet: otherPlayer, type: 'wager_cancelled', title: 'Wager cancelled', message: `${cancellerName} cancelled the wager. Your stake has been refunded.`, wager_id: wagerId as string }]);
    }
    return respond({ wager: updatedWager, message: 'Wager cancelled.', refundInitiated: true });
}

// ── markGameComplete ──────────────────────────────────────────────────────────

export async function handleMarkGameComplete(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId } = data;
    if (!wagerId) return respond({ error: 'wagerId required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.status !== 'voting') return respond({ error: 'Wager is not in voting state' }, 400);
    const isPlayerA = wager.player_a_wallet === walletAddress;
    const isPlayerB = wager.player_b_wallet === walletAddress;
    if (!isPlayerA && !isPlayerB) return respond({ error: 'Not a participant' }, 403);
    if (isPlayerA && wager.game_complete_a) return respond({ error: 'Already confirmed' }, 400);
    if (isPlayerB && wager.game_complete_b) return respond({ error: 'Already confirmed' }, 400);

    const field = isPlayerA ? 'game_complete_a' : 'game_complete_b';
    const opponentConfirmed = isPlayerA ? wager.game_complete_b : wager.game_complete_a;
    const updates: Record<string, unknown> = { [field]: true };
    if (opponentConfirmed) {
        updates.game_complete_deadline = new Date(Date.now() + 10_000).toISOString();
        updates.vote_deadline = new Date(Date.now() + 10_000 + 5 * 60 * 1000).toISOString();
    }

    const { data: updated, error: updateErr } = await supabase.from('wagers').update(updates).eq('id', wagerId).select().single();
    if (updateErr) return respond({ error: updateErr.message }, 500);
    return respond({ wager: updated });
}

// ── submitVote ────────────────────────────────────────────────────────────────

export async function handleSubmitVote(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId, votedWinner } = data;
    if (!wagerId || !votedWinner) return respond({ error: 'wagerId and votedWinner required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.status !== 'voting') return respond({ error: 'Wager is not in voting state' }, 400);
    const isPlayerA = wager.player_a_wallet === walletAddress;
    const isPlayerB = wager.player_b_wallet === walletAddress;
    if (!isPlayerA && !isPlayerB) return respond({ error: 'Not a participant' }, 403);
    const validTargets = [wager.player_a_wallet, wager.player_b_wallet, 'draw'];
    if (!validTargets.includes(votedWinner as string)) return respond({ error: 'Invalid vote target' }, 400);

    const voteField = isPlayerA ? 'vote_player_a' : 'vote_player_b';
    const voteAtField = isPlayerA ? 'vote_a_at' : 'vote_b_at';
    const opponentVote = isPlayerA ? wager.vote_player_b : wager.vote_player_a;

    const { data: updated, error: updateErr } = await supabase.from('wagers')
        .update({ [voteField]: votedWinner, [voteAtField]: new Date().toISOString() })
        .eq('id', wagerId).select().single();
    if (updateErr) return respond({ error: updateErr.message }, 500);

    if (opponentVote) {
        const stake = wager.stake_lamports as number;
        const payout = Math.floor(stake * 2 * 0.9);
        const payoutSol = (payout / 1e9).toFixed(4);

        if (opponentVote === votedWinner) {
            // Agreement
            const resultType: 'playerA' | 'playerB' | 'draw' = votedWinner === 'draw' ? 'draw' : votedWinner === wager.player_a_wallet ? 'playerA' : 'playerB';
            const winnerWallet = votedWinner === 'draw' ? null : votedWinner as string;
            await supabase.from('wagers').update({ status: 'resolved', winner_wallet: winnerWallet, resolved_at: new Date().toISOString() }).eq('id', wagerId);
            if (resultType === 'draw') {
                await insertNotifications(supabase, [
                    { player_wallet: wager.player_a_wallet, type: 'wager_draw', title: 'Game ended in a draw', message: 'Your stake has been refunded in full.', wager_id: wagerId as string },
                    { player_wallet: wager.player_b_wallet, type: 'wager_draw', title: 'Game ended in a draw', message: 'Your stake has been refunded in full.', wager_id: wagerId as string },
                ]);
            } else if (winnerWallet) {
                const loserWallet = winnerWallet === wager.player_a_wallet ? wager.player_b_wallet : wager.player_a_wallet;
                await insertNotifications(supabase, [
                    { player_wallet: winnerWallet, type: 'wager_won', title: '🏆 You won!', message: `${payoutSol} SOL has been sent to your wallet.`, wager_id: wagerId as string },
                    { player_wallet: loserWallet as string, type: 'wager_lost', title: 'You lost this one', message: 'Better luck next time.', wager_id: wagerId as string },
                ]);
            }
            await resolveOnChain(supabase, wager, winnerWallet, resultType);
        } else {
            // Dispute
            await supabase.from('wagers').update({ status: 'disputed', dispute_created_at: new Date().toISOString() }).eq('id', wagerId);
            await insertNotifications(supabase, [
                { player_wallet: wager.player_a_wallet, type: 'wager_disputed', title: '⚠️ Result disputed', message: 'You and your opponent voted differently. A moderator will review the match.', wager_id: wagerId as string },
                { player_wallet: wager.player_b_wallet as string, type: 'wager_disputed', title: '⚠️ Result disputed', message: 'You and your opponent voted differently. A moderator will review the match.', wager_id: wagerId as string },
            ]);
        }
    }

    const { data: final } = await supabase.from('wagers').select('*').eq('id', wagerId).single();
    return respond({ wager: final ?? updated });
}

// ── retractVote ───────────────────────────────────────────────────────────────

export async function handleRetractVote(supabase: Supabase, walletAddress: string, data: Record<string, unknown>, respond: Respond) {
    const { wagerId } = data;
    if (!wagerId) return respond({ error: 'wagerId required' }, 400);
    const wager = await getWager(supabase, wagerId as string);
    if (wager.status !== 'voting') return respond({ error: 'Wager is not in voting state' }, 400);
    const isPlayerA = wager.player_a_wallet === walletAddress;
    const isPlayerB = wager.player_b_wallet === walletAddress;
    if (!isPlayerA && !isPlayerB) return respond({ error: 'Not a participant' }, 403);
    const opponentVote = isPlayerA ? wager.vote_player_b : wager.vote_player_a;
    if (opponentVote) return respond({ error: 'Cannot retract — opponent has already voted' }, 400);
    const voteField = isPlayerA ? 'vote_player_a' : 'vote_player_b';
    const voteAtField = isPlayerA ? 'vote_a_at' : 'vote_b_at';
    const { data: updated, error: updateErr } = await supabase.from('wagers').update({ [voteField]: null, [voteAtField]: null }).eq('id', wagerId).select().single();
    if (updateErr) return respond({ error: updateErr.message }, 500);
    return respond({ wager: updated });
}

// ── Lichess game creation helper ──────────────────────────────────────────────

async function createLichessGame(
    playerAUsername: string, playerBUsername: string,
    clockLimit: number, clockIncrement: number, rated: boolean, sidePreference = 'random',
): Promise<{ gameId: string; urlWhite: string; urlBlack: string }> {
    const platformToken = Deno.env.get('LICHESS_PLATFORM_TOKEN');
    if (!platformToken) throw new Error('LICHESS_PLATFORM_TOKEN not configured');
    const body = new URLSearchParams({
        'clock.limit': String(clockLimit), 'clock.increment': String(clockIncrement),
        rated: String(rated),
        users: sidePreference === 'black' ? `${playerBUsername},${playerAUsername}` : `${playerAUsername},${playerBUsername}`,
        rules: 'noRematch,noEarlyDraw', name: 'GameGambit Wager',
    });
    const res = await fetch('https://lichess.org/api/challenge/open', {
        method: 'POST',
        headers: { Authorization: `Bearer ${platformToken}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: body.toString(),
    });
    if (!res.ok) { const errText = await res.text(); throw new Error(`Lichess challenge failed (${res.status}): ${errText}`); }
    const challenge = await res.json() as { id: string; urlWhite: string; urlBlack: string };
    if (!challenge.id) throw new Error('Lichess returned no game ID');
    return { gameId: challenge.id, urlWhite: challenge.urlWhite, urlBlack: challenge.urlBlack };
}

async function tryCreateLichessGame(
    supabase: Supabase, wagerId: string, wager: Record<string, unknown>,
): Promise<{ lichess_game_id?: string; lichess_url_white?: string; lichess_url_black?: string }> {
    try {
        const [{ data: pA }, { data: pB }] = await Promise.all([
            supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_a_wallet).single(),
            supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_b_wallet).single(),
        ]);
        if (!pA?.lichess_username || !pB?.lichess_username) { console.error(`[actions] Missing Lichess usernames for wager ${wagerId}`); return {}; }
        const { gameId, urlWhite, urlBlack } = await createLichessGame(pA.lichess_username, pB.lichess_username, (wager.chess_clock_limit as number) ?? 300, (wager.chess_clock_increment as number) ?? 3, (wager.chess_rated as boolean) ?? false, (wager.chess_side_preference as string) ?? 'random');
        console.log(`[actions] Lichess game created: ${gameId} for wager ${wagerId}`);
        await supabase.from('wagers').update({ lichess_game_id: gameId, lichess_url_white: urlWhite, lichess_url_black: urlBlack }).eq('id', wagerId);
        return { lichess_game_id: gameId, lichess_url_white: urlWhite, lichess_url_black: urlBlack };
    } catch (err) {
        console.error(`[actions] createLichessGame failed for wager ${wagerId}:`, err instanceof Error ? err.message : String(err));
        return {};
    }
}
