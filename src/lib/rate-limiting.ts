import { NextRequest, NextResponse } from 'next/server'

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyGenerator?: (req: NextRequest) => string
  handler?: (req: NextRequest, res: NextResponse) => NextResponse
}

/**
 * Rate limiting store using Map with automatic cleanup
 * For production, use Redis (Upstash) for distributed rate limiting
 */
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>()

  increment(key: string, windowMs: number): { current: number; remaining: number; retryAfter: number } {
    const now = Date.now()
    const entry = this.store.get(key)

    let current = 1
    let resetTime = now + windowMs

    if (entry && entry.resetTime > now) {
      current = entry.count + 1
      resetTime = entry.resetTime
    } else {
      // Cleanup expired entries
      this.cleanup()
    }

    this.store.set(key, { count: current, resetTime })

    return {
      current,
      remaining: Math.max(0, windowMs - (resetTime - now)),
      retryAfter: Math.ceil((resetTime - now) / 1000),
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const keysToDelete = []
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.store.delete(key))
  }

  reset(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

const store = new RateLimitStore()

/**
 * Default rate limit key generator - uses IP address
 */
function defaultKeyGenerator(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             req.ip || 
             'unknown'
  return `ratelimit:${ip}`
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs = 60 * 1000, // 1 minute default
    maxRequests = 100,
    keyGenerator = defaultKeyGenerator,
    handler,
  } = config

  return function rateLimitMiddleware(req: NextRequest) {
    const key = keyGenerator(req)
    const result = store.increment(key, windowMs)

    if (result.current > maxRequests) {
      const response = new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Too many requests',
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfter),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': new Date(Date.now() + result.retryAfter * 1000).toISOString(),
          },
        }
      )

      if (handler) {
        return handler(req, response)
      }
      return response
    }

    return NextResponse.next({
      request: {
        headers: new Headers(req.headers),
      },
    })
  }
}

/**
 * Rate limiter configurations for different endpoints
 */
export const rateLimitConfig = {
  // Public endpoints - less strict
  public: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
  // API endpoints - moderate
  api: {
    windowMs: 60 * 1000,
    maxRequests: 50,
  },
  // Authentication endpoints - strict
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  // Wager creation - moderate to prevent spam
  wagerCreation: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  // Trading endpoints - strict
  trading: {
    windowMs: 10 * 1000,
    maxRequests: 3,
  },
  // Query endpoints - very permissive for UI
  query: {
    windowMs: 60 * 1000,
    maxRequests: 200,
  },
}

/**
 * User-based rate limiter (authenticated users with different limits)
 */
export function userBasedKeyGenerator(req: NextRequest): string {
  const token = req.headers.get('authorization')?.split(' ')[1]
  const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown'
  
  if (token) {
    return `user:${token}`
  }
  return `anon:${ip}`
}

/**
 * Cache-Control header helpers for responses
 */
export function setCacheHeaders(
  response: NextResponse,
  options: {
    maxAge?: number // in seconds
    public?: boolean
    revalidate?: number
    sMaxAge?: number // shared cache max age (CDN)
  }
) {
  const { maxAge = 3600, public: isPublic = true, revalidate = 0, sMaxAge = 3600 } = options

  const cacheControl = [
    isPublic ? 'public' : 'private',
    `max-age=${maxAge}`,
    revalidate > 0 ? `stale-while-revalidate=${revalidate}` : undefined,
    sMaxAge > 0 ? `s-maxage=${sMaxAge}` : undefined,
  ]
    .filter(Boolean)
    .join(', ')

  response.headers.set('Cache-Control', cacheControl)
  return response
}

/**
 * Conditional cache validation using ETags
 */
export function generateETag(data: any): string {
  const hash = JSON.stringify(data)
    .split('')
    .reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0)
      return a & a
    }, 0)
  return `"${Math.abs(hash).toString(16)}"`
}

export function checkETag(req: NextRequest, etag: string): boolean {
  const ifNoneMatch = req.headers.get('if-none-match')
  return ifNoneMatch === etag
}

/**
 * Response compression hint
 */
export function addCompressionHeaders(response: NextResponse): NextResponse {
  response.headers.set('Content-Encoding', 'gzip')
  response.headers.set('Vary', 'Accept-Encoding')
  return response
}

/**
 * CORS headers for API routes
 */
export function setCORSHeaders(
  response: NextResponse,
  origin: string = '*'
): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

/**
 * Security headers
 */
export function setSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return response
}

/**
 * Clear rate limit for specific user (admin function)
 */
export function clearRateLimit(key: string): void {
  store.reset(key)
}

/**
 * Clear all rate limits (use sparingly)
 */
export function clearAllRateLimits(): void {
  store.clear()
}
