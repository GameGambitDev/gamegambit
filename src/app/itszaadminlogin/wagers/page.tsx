"use client";

import { useAdminWagers } from '@/hooks/admin/useAdminWagers';

export default function WagersPage() {
    const {
        wagers,
        loading,
        error,
        total,
        offset,
        limit,
        fetchWagers,
        fetchWagerDetails,
        nextPage,
        prevPage,
        refreshWagers,
        hasNextPage,
        hasPrevPage,
    } = useAdminWagers();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground">Loading wagers...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-destructive">Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Wagers</h1>
                <button
                    onClick={refreshWagers}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    Refresh
                </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
                Showing {offset + 1}–{Math.min(offset + limit, total)} of {total} wagers
            </p>

            <div className="rounded-md border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="px-4 py-3 text-left font-medium">ID</th>
                            <th className="px-4 py-3 text-left font-medium">Player A</th>
                            <th className="px-4 py-3 text-left font-medium">Player B</th>
                            <th className="px-4 py-3 text-left font-medium">Stake (lamports)</th>
                            <th className="px-4 py-3 text-left font-medium">Game</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Winner</th>
                            <th className="px-4 py-3 text-left font-medium">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {wagers.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                    No wagers found.
                                </td>
                            </tr>
                        ) : (
                            wagers.map((wager) => (
                                <tr key={wager.id} className="border-b hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs">{wager.id.slice(0, 8)}…</td>
                                    <td className="px-4 py-3 font-mono text-xs">{wager.player_a_wallet.slice(0, 8)}…</td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        {wager.player_b_wallet ? `${wager.player_b_wallet.slice(0, 8)}…` : '—'}
                                    </td>
                                    <td className="px-4 py-3">{wager.stake_lamports.toLocaleString()}</td>
                                    <td className="px-4 py-3">{wager.game}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted">
                                            {wager.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        {wager.winner_wallet ? `${wager.winner_wallet.slice(0, 8)}…` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {new Date(wager.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between mt-4">
                <button
                    onClick={prevPage}
                    disabled={!hasPrevPage}
                    className="px-4 py-2 text-sm border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
                >
                    Previous
                </button>
                <button
                    onClick={nextPage}
                    disabled={!hasNextPage}
                    className="px-4 py-2 text-sm border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
                >
                    Next
                </button>
            </div>
        </div>
    );
}