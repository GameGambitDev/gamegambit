// src/hooks/useUsernameBinding.ts
//
// Mutations for the three username-binding flows:
//   useBindUsername      — bind a game username (calls /api/username/bind)
//   useUsernameAppeal    — file an appeal on a taken username (/api/username/appeal)
//   useSubmitChangeRequest — request a username change (/api/username/change-request)
//
// All three require a session token obtained from useWalletAuth's getSessionToken().

import { useMutation } from '@tanstack/react-query';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BindUsernamePayload = {
    game: 'pubg' | 'codm' | 'free_fire';
    username: string;
    accountId?: string;
    sessionToken: string;
};

export type AppealPayload = {
    game: 'pubg' | 'codm' | 'free_fire';
    username: string;
    sessionToken: string;
};

export type ChangeRequestPayload = {
    game: 'pubg' | 'codm' | 'free_fire';
    oldUsername: string;
    newUsername: string;
    reason: string;
    category: string;
    sessionToken: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function postJSON(url: string, body: object, sessionToken: string) {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': sessionToken,
        },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
}

// ── useBindUsername ───────────────────────────────────────────────────────────

/**
 * Binds a game username to the current player.
 * Throws with error.message === 'USERNAME_TAKEN' if already claimed,
 * so the UI can open the appeal flow.
 */
export function useBindUsername() {
    return useMutation({
        mutationFn: ({ game, username, accountId, sessionToken }: BindUsernamePayload) =>
            postJSON('/api/username/bind', { game, username, accountId }, sessionToken),
    });
}

// ── useUsernameAppeal ─────────────────────────────────────────────────────────

/**
 * Files a "this username is mine" appeal against the current holder.
 * Returns { ok, appealId, message } on success.
 */
export function useUsernameAppeal() {
    return useMutation({
        mutationFn: ({ game, username, sessionToken }: AppealPayload) =>
            postJSON('/api/username/appeal', { game, username }, sessionToken),
    });
}

// ── useSubmitChangeRequest ────────────────────────────────────────────────────

/**
 * Submits a formal username change request (max 2/year, goes to admin panel).
 * Returns { ok, requestId } on success.
 */
export function useSubmitChangeRequest() {
    return useMutation({
        mutationFn: ({ game, oldUsername, newUsername, reason, category, sessionToken }: ChangeRequestPayload) =>
            postJSON(
                '/api/username/change-request',
                { game, oldUsername, newUsername, reason, category },
                sessionToken,
            ),
    });
}