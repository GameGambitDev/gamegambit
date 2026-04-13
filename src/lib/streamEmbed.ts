/**
 * streamEmbed.ts
 * Shared utility for converting raw stream URLs into embeddable iframe URLs.
 * Supports YouTube (full + short URLs) and Twitch channels.
 *
 * Twitch requires a `parent` domain param — we read NEXT_PUBLIC_APP_DOMAIN
 * so it works correctly on Vercel preview URLs and custom domains alike.
 * Falls back to window.location.hostname for local dev.
 */

/** Resolved embed info returned for a valid stream URL */
export interface StreamEmbed {
    /** The iframe src URL */
    embedUrl: string
    /** Human-readable platform name */
    platform: 'YouTube' | 'Twitch'
    /** Original channel / video identifier, useful for fallback links */
    id: string
}

/**
 * Parse a raw stream URL and return embed info, or null if unsupported / invalid.
 *
 * @example
 * getStreamEmbed('https://twitch.tv/shroud')
 * // → { embedUrl: 'https://player.twitch.tv/?channel=shroud&parent=gamegambit.gg&autoplay=false', platform: 'Twitch', id: 'shroud' }
 *
 * getStreamEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
 * // → { embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0', platform: 'YouTube', id: 'dQw4w9WgXcQ' }
 */
export function getStreamEmbed(url: string): StreamEmbed | null {
    if (!url) return null
    try {
        const u = new URL(url)

        // ── YouTube: https://www.youtube.com/watch?v=VIDEO_ID ────────────────
        if (u.hostname.includes('youtube.com')) {
            const videoId = u.searchParams.get('v')
            if (!videoId) return null
            return {
                embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=0`,
                platform: 'YouTube',
                id: videoId,
            }
        }

        // ── YouTube: https://youtu.be/VIDEO_ID ───────────────────────────────
        if (u.hostname.includes('youtu.be')) {
            const videoId = u.pathname.replace('/', '')
            if (!videoId) return null
            return {
                embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=0`,
                platform: 'YouTube',
                id: videoId,
            }
        }

        // ── Twitch: https://twitch.tv/CHANNEL ────────────────────────────────
        if (u.hostname.includes('twitch.tv')) {
            const channel = u.pathname.replace(/^\//, '').split('/')[0]
            if (!channel) return null

            // Prefer the env var so Vercel preview URLs + custom domains work.
            // Falls back to window.location.hostname for local dev.
            const parent =
                process.env.NEXT_PUBLIC_APP_DOMAIN ??
                (typeof window !== 'undefined' ? window.location.hostname : 'localhost')

            return {
                embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=false`,
                platform: 'Twitch',
                id: channel,
            }
        }

        return null
    } catch {
        return null
    }
}