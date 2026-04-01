'use client';

// src/components/ModerationOrchestrator.tsx
//
// Mounts once inside Providers (inside GameEventProvider).
// Listens to activeModerationRequest from GameEventContext and shows:
//   1. ModerationRequestModal (30s popup — accept / decline)
//   2. ModerationPanel (5-step workflow — after accepting)
//
// Nothing else in the app needs to know about these modals.

import { useState } from 'react';
import { useGameEvents } from '@/contexts/GameEventContext';
import { ModerationRequestModal } from '@/components/ModerationRequestModal';
import { ModerationPanel } from '@/components/ModerationPanel';
import type { ModerationRequest } from '@/hooks/useModeration';

export function ModerationOrchestrator() {
    const { activeModerationRequest, clearModerationRequest } = useGameEvents();
    const [panelRequest, setPanelRequest] = useState<ModerationRequest | null>(null);

    // Show popup only if we have an active request and the panel isn't already open
    const showPopup = !!activeModerationRequest && !panelRequest;

    function handleAccepted() {
        // Move from popup → panel using the same request object
        if (activeModerationRequest) {
            setPanelRequest(activeModerationRequest);
        }
        clearModerationRequest();
    }

    function handlePopupDismissed() {
        clearModerationRequest();
    }

    function handlePanelClose() {
        setPanelRequest(null);
    }

    return (
        <>
            {showPopup && activeModerationRequest && (
                <ModerationRequestModal
                    request={activeModerationRequest}
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