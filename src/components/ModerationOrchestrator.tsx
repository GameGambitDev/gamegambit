'use client';

// src/components/ModerationOrchestrator.tsx
//
// Mounts once inside Providers (inside GameEventProvider).
// Shows the moderation popup and panel at the right time.
//
// Two signal sources — both must work:
//   1. Realtime INSERT from GameEventContext  → catches the initial assignment live
//   2. useActiveModerationRequest poll (5s)   → restores state after page refresh
//
// Flow:
//   pending  → show ModerationRequestModal (30s popup)
//   accepted → show ModerationPanel (30-min workflow)
//   any other status → render nothing
//
// Fix — panelRequest status patch:
//   When the moderator accepts via the popup, the Realtime object still has
//   status='pending' and decision_deadline=null (the INSERT event fires before
//   the accept API responds). Without patching, the panel mounts with a null
//   deadline and the countdown shows '--:--' forever.
//
//   handleAccepted() now patches the request object to status='accepted' and
//   sets a provisional decision_deadline of now+30min. The poll (every 5s) will
//   overwrite this with the real DB value within 5 seconds anyway, so the UI
//   stays accurate. The patch only exists in local state — no DB write.

import { useState, useEffect } from 'react';
import { useGameEvents } from '@/contexts/GameEventContext';
import { useActiveModerationRequest } from '@/hooks/useModeration';
import { ModerationRequestModal } from '@/components/ModerationRequestModal';
import { ModerationPanel } from '@/components/ModerationPanel';
import type { ModerationRequest } from '@/hooks/useModeration';

export function ModerationOrchestrator() {
    const { activeModerationRequest, clearModerationRequest } = useGameEvents();

    // Polling fallback — catches state after page refresh or missed Realtime events.
    // Returns null when no active request exists, so it's always safe to read.
    const { data: polledRequest } = useActiveModerationRequest();

    // panelRequest is set when the user accepts, persisted for the session.
    const [panelRequest, setPanelRequest] = useState<ModerationRequest | null>(null);

    // ── Restore panel after page refresh ──────────────────────────────────────
    // If the poll finds an 'accepted' request and the panel isn't already open,
    // the user must have refreshed mid-session. Re-open the panel immediately.
    useEffect(() => {
        if (polledRequest?.status === 'accepted' && !panelRequest) {
            setPanelRequest(polledRequest);
        }
        // Only re-run when the request id or status actually changes — not on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [polledRequest?.id, polledRequest?.status]);

    // ── Keep panelRequest fresh from poll ────────────────────────────────────
    // Once the panel is open, sync it with the latest polled data so the
    // decision_deadline and status stay accurate without requiring a re-open.
    useEffect(() => {
        if (
            panelRequest &&
            polledRequest?.id === panelRequest.id &&
            polledRequest.status === 'accepted'
        ) {
            setPanelRequest(polledRequest);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [polledRequest?.decided_at, polledRequest?.decision_deadline]);

    // ── Derive what to show ───────────────────────────────────────────────────
    // Realtime event takes priority (it has the freshest object).
    // Poll is the fallback for refresh recovery or missed events.
    const effectiveRequest: ModerationRequest | null =
        activeModerationRequest ?? polledRequest ?? null;

    // Show the popup only for 'pending' requests when the panel isn't already open.
    // This prevents re-showing the popup if the user somehow gets a second Realtime
    // event for the same request they already accepted.
    const showPopup =
        !!effectiveRequest &&
        effectiveRequest.status === 'pending' &&
        !panelRequest;

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleAccepted() {
        // Transition: popup → panel.
        // Prefer the Realtime object (has .status freshly set by accept API);
        // fall back to polledRequest if Realtime already cleared.
        const req = activeModerationRequest ?? polledRequest;
        if (req) {
            // Patch the request so the panel has a valid decision_deadline immediately.
            // The real value from the DB will overwrite this within 5s via the poll.
            // Without the patch, the panel mounts with decision_deadline=null (the
            // Realtime INSERT event fires before the accept API call completes) and
            // the countdown shows '--:--' until the first poll cycle.
            const provisionalDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            setPanelRequest({
                ...req,
                status: 'accepted',
                decision_deadline: req.decision_deadline ?? provisionalDeadline,
            });
        }
        clearModerationRequest();
    }

    function handlePopupDismissed() {
        // User declined or the 30s timer expired.
        clearModerationRequest();
    }

    function handlePanelClose() {
        setPanelRequest(null);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            {showPopup && effectiveRequest && (
                <ModerationRequestModal
                    request={effectiveRequest}
                    onAccepted={handleAccepted}
                    onDismissed={handlePopupDismissed}
                />
            )}
            {panelRequest && (
                <ModerationPanel
                    request={panelRequest}
                    onClose={handlePanelClose}
                />
            )}
        </>
    );
}