// JWT Token generation and verification
import crypto from 'crypto';

interface JWTPayload {
  sub: string; // admin ID
  email: string;
  role: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your_super_secret_key_here_min_32_chars';
const JWT_EXPIRY = parseInt(process.env.ADMIN_JWT_EXPIRY || '3600'); // 1 hour default

/**
 * Generate a JWT token
 */
export function generateToken(adminId: string, email: string, role: string): string {
  if (!adminId || !email) {
    throw new Error('Admin ID and email are required');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: adminId,
    email,
    role,
    iat: now,
    exp: now + JWT_EXPIRY,
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64');

  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, bodyB64, signatureB64] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64');

    if (signatureB64 !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(bodyB64, 'base64').toString()) as JWTPayload;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (e) {
    console.error('Token verification failed:', e);
    return null;
  }
}

/**
 * Hash a token for storage in database
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Get token expiry timestamp
 */
export function getTokenExpiry(): Date {
  return new Date(Date.now() + JWT_EXPIRY * 1000);
}

/**
 * Extract token from authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}
