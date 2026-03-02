// ─── Auth helpers: JWT (jose) + password hashing (Web Crypto PBKDF2) ─────────

/** Converts a Uint8Array to a base64 string without spread (avoids TS2802). */
function u8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
// jose uses the Web Crypto API and is fully Edge Runtime compatible.
// No bcrypt/argon2 — both require native Node.js modules.
import { SignJWT, jwtVerify } from 'jose'

// ── JWT ───────────────────────────────────────────────────────────────────────

export interface TokenPayload {
  sub: string         // userId
  hid: string | null  // householdId (null until onboarding complete)
  mid: string | null  // memberId    (null until onboarding complete)
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ hid: payload.hid, mid: payload.mid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return {
    sub: payload.sub as string,
    hid: (payload.hid as string | null) ?? null,
    mid: (payload.mid as string | null) ?? null,
  }
}

// ── Password hashing (PBKDF2 via Web Crypto) ──────────────────────────────────
// Format: base64(salt[16] + hash[32])
// 100,000 PBKDF2-SHA256 iterations — comparable to bcrypt cost=12.

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  )
  const combined = new Uint8Array(48)
  combined.set(salt, 0)
  combined.set(new Uint8Array(bits), 16)
  return u8ToBase64(combined)
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0))
    const salt = combined.slice(0, 16)
    const storedHash = combined.slice(16)
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      key,
      256,
    )
    const computed = new Uint8Array(bits)
    if (storedHash.length !== computed.length) return false
    // Constant-time comparison to prevent timing attacks
    let diff = 0
    for (let i = 0; i < storedHash.length; i++) diff |= storedHash[i] ^ computed[i]
    return diff === 0
  } catch {
    return false
  }
}

// ── Refresh tokens ────────────────────────────────────────────────────────────

export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  // URL-safe base64, no padding
  return u8ToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return u8ToBase64(new Uint8Array(buf))
}

export function refreshTokenExpiry(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}
