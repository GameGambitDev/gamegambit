import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';

export interface PlayerSettings {
    pushNotificationsEnabled: boolean;
    moderationRequestsEnabled: boolean;
}

// ── snake_case ↔ camelCase mappers ────────────────────────────────────────────
// The API stores and returns snake_case; the hook surface is camelCase.

function fromApi(raw: Record<string, unknown>): PlayerSettings {
    return {
        pushNotificationsEnabled: (raw.push_notifications_enabled as boolean) ?? true,
        moderationRequestsEnabled: (raw.moderation_requests_enabled as boolean) ?? true,
    };
}

function toApi(updates: Partial<PlayerSettings>): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    if (updates.pushNotificationsEnabled !== undefined) out.push_notifications_enabled = updates.pushNotificationsEnabled;
    if (updates.moderationRequestsEnabled !== undefined) out.moderation_requests_enabled = updates.moderationRequestsEnabled;
    return out;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchSettings(sessionToken: string): Promise<PlayerSettings> {
    const res = await fetch('/api/settings', {
        headers: { 'X-Session-Token': sessionToken },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to load settings');
    return fromApi(json as Record<string, unknown>);
}

async function patchSettings(
    updates: Partial<PlayerSettings>,
    sessionToken: string,
): Promise<PlayerSettings> {
    const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': sessionToken,
        },
        body: JSON.stringify(toApi(updates)),   // ← send snake_case to the API
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to update settings');
    // PATCH returns { ok, updated } — re-fetch for the canonical state
    // (the onSettled invalidation will do that; just return what we sent)
    return fromApi((json.updated ?? json) as Record<string, unknown>);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * usePlayerSettings
 *
 * Reads and writes the player's push notification and moderation toggles.
 * Uses optimistic updates so the UI feels instant.
 *
 * Key fixes vs. original:
 *  1. snake_case ↔ camelCase mapping — the API speaks snake_case, this hook
 *     speaks camelCase. Without the mapper the returned values were always
 *     undefined, making every toggle appear stuck at its default.
 *  2. PATCH body is now snake_case — the API's whitelist only checks for
 *     push_notifications_enabled / moderation_requests_enabled, so sending
 *     camelCase keys caused "No valid settings provided" 400 errors.
 *  3. Query is gated on sessionToken — previously the query fired as soon as
 *     the wallet connected, before a valid session token existed in
 *     localStorage. That caused a flood of 401s because getSessionToken()
 *     would call verifyWallet() which can't run until the user manually signs.
 *     Now the query only runs when there's already a live token in cache.
 *
 * Usage:
 *   const { settings, isLoading, updateSettings, isUpdating } = usePlayerSettings()
 */
export function usePlayerSettings() {
    const { publicKey } = useWallet();
    const { getSessionToken, sessionToken } = useWalletAuth();
    const queryClient = useQueryClient();

    const walletAddress = publicKey?.toBase58();

    // ── Read ─────────────────────────────────────────────────────────────────
    const {
        data: settings,
        isLoading,
        error,
    } = useQuery<PlayerSettings>({
        queryKey: ['playerSettings', walletAddress],
        queryFn: async () => {
            const token = await getSessionToken();
            if (!token) throw new Error('Wallet verification required');
            return fetchSettings(token);
        },
        // Only run when wallet is connected AND we already have a live session
        // token. This prevents the 401 storm that happened when the query fired
        // before the user had signed the verification message.
        enabled: !!walletAddress && !!sessionToken,
        staleTime: 5 * 60 * 1000,
        placeholderData: {
            pushNotificationsEnabled: true,
            moderationRequestsEnabled: true,
        },
    });

    // ── Write (optimistic) ───────────────────────────────────────────────────
    const { mutateAsync: updateSettings, isPending: isUpdating } = useMutation<
        PlayerSettings,
        Error,
        Partial<PlayerSettings>
    >({
        mutationFn: async (updates) => {
            const token = await getSessionToken();
            if (!token) throw new Error('Wallet verification required');
            return patchSettings(updates, token);
        },
        onMutate: async (updates) => {
            await queryClient.cancelQueries({ queryKey: ['playerSettings', walletAddress] });
            const previous = queryClient.getQueryData<PlayerSettings>(['playerSettings', walletAddress]);
            queryClient.setQueryData<PlayerSettings>(['playerSettings', walletAddress], (old) => ({
                ...((old ?? { pushNotificationsEnabled: true, moderationRequestsEnabled: true }) as PlayerSettings),
                ...updates,
            }));
            return { previous };
        },
        onError: (_err, _updates, context) => {
            const ctx = context as { previous?: PlayerSettings } | undefined;
            if (ctx?.previous) {
                queryClient.setQueryData(['playerSettings', walletAddress], ctx.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['playerSettings', walletAddress] });
            queryClient.invalidateQueries({ queryKey: ['player', walletAddress] });
        },
    });

    return {
        settings: settings ?? { pushNotificationsEnabled: true, moderationRequestsEnabled: true },
        isLoading,
        error,
        updateSettings,
        isUpdating,
    };
}