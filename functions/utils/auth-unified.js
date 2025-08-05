// functions/utils/auth-unified.js - Single JWT-based Auth System (Phase 1.3)
// Replaces complex multi-auth system with unified JWT approach

import crypto from 'crypto';

// JWT Helper Functions
function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str) {
  const pad = str.length % 4;
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/') +
    (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

// Primary JWT Authentication System
export class AuthSystem {
  constructor(jwtSecret, db) {
    this.jwtSecret = jwtSecret;
    this.db = db;
    
    // Token lifetimes
    this.ACCESS_TOKEN_LIFETIME = 15 * 60; // 15 minutes
    this.REFRESH_TOKEN_LIFETIME = 7 * 24 * 60 * 60; // 7 days
  }

  // Generate Access Token (short-lived)
  generateAccessToken(userId, userInfo = {}) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      userId,
      type: 'access',
      iat: timestamp,
      exp: timestamp + this.ACCESS_TOKEN_LIFETIME,
      ...userInfo
    };

    const headerB64 = base64urlEncode(JSON.stringify(header));
    const payloadB64 = base64urlEncode(JSON.stringify(payload));
    const data = `${headerB64}.${payloadB64}`;
    
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `${data}.${signature}`;
  }

  // Generate Refresh Token (long-lived)
  async generateRefreshToken(userId, userAgent = '') {
    const tokenId = crypto.randomBytes(32).toString('hex');
    const token = crypto.randomBytes(32).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Store refresh token in D1
    await this.db.db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, created_at, expires_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tokenId,
      userId,
      crypto.createHash('sha256').update(token).digest('hex'),
      userAgent,
      timestamp,
      timestamp + this.REFRESH_TOKEN_LIFETIME,
      1
    ).run();

    return { tokenId, token };
  }

  // Verify Access Token
  verifyAccessToken(token) {
    try {
      const [headerB64, payloadB64, signatureB64] = token.split('.');
      if (!headerB64 || !payloadB64 || !signatureB64) {
        return null;
      }

      const data = `${headerB64}.${payloadB64}`;
      const expectedSig = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      if (expectedSig !== signatureB64) {
        return null;
      }

      const payload = JSON.parse(base64urlDecode(payloadB64));

      // Check expiration
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        return null;
      }

      // Ensure it's an access token
      if (payload.type !== 'access') {
        return null;
      }

      return payload;
    } catch (err) {
      console.error('Access token verification error:', err);
      return null;
    }
  }

  // Verify and Rotate Refresh Token
  async verifyAndRotateRefreshToken(tokenId, token) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const now = Math.floor(Date.now() / 1000);

      // Find active refresh token
      const storedToken = await this.db.db.prepare(`
        SELECT user_id, expires_at, is_active 
        FROM refresh_tokens 
        WHERE id = ? AND token_hash = ? AND is_active = 1
      `).bind(tokenId, tokenHash).first();

      if (!storedToken || storedToken.expires_at < now) {
        return null;
      }

      // Invalidate old token
      await this.db.db.prepare(`
        UPDATE refresh_tokens SET is_active = 0 WHERE id = ?
      `).bind(tokenId).run();

      // Generate new tokens
      const userAgent = ''; // Could extract from request headers
      const accessToken = this.generateAccessToken(storedToken.user_id);
      const refreshTokenData = await this.generateRefreshToken(storedToken.user_id, userAgent);

      return {
        accessToken,
        refreshToken: refreshTokenData,
        userId: storedToken.user_id
      };
    } catch (err) {
      console.error('Refresh token rotation error:', err);
      return null;
    }
  }

  // Revoke Refresh Token
  async revokeRefreshToken(tokenId) {
    await this.db.db.prepare(`
      UPDATE refresh_tokens SET is_active = 0 WHERE id = ?
    `).bind(tokenId).run();
  }

  // Revoke All User Tokens (logout all devices)
  async revokeAllUserTokens(userId) {
    await this.db.db.prepare(`
      UPDATE refresh_tokens SET is_active = 0 WHERE user_id = ?
    `).bind(userId).run();
  }

  // Clean up expired tokens (should be run periodically)
  async cleanupExpiredTokens() {
    const now = Math.floor(Date.now() / 1000);
    const result = await this.db.db.prepare(`
      DELETE FROM refresh_tokens WHERE expires_at < ?
    `).bind(now).run();
    
    return result.changes;
  }

  // Generate HTTP-Only Cookie Headers
  generateCookieHeaders(accessToken, refreshToken) {
    const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
    
    return {
      'Set-Cookie': [
        `access_token=${accessToken}; HttpOnly; ${secure}SameSite=Strict; Path=/; Max-Age=${this.ACCESS_TOKEN_LIFETIME}`,
        `refresh_token=${refreshToken.tokenId}:${refreshToken.token}; HttpOnly; ${secure}SameSite=Strict; Path=/; Max-Age=${this.REFRESH_TOKEN_LIFETIME}`
      ]
    };
  }

  // Parse Cookies from Request
  parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    
    return Object.fromEntries(
      cookieHeader.split(';').map(cookie => {
        const [key, value] = cookie.trim().split('=');
        return [key, value];
      })
    );
  }

  // Extract Token from Request (Bearer or Cookie)
  extractTokenFromRequest(request) {
    // Try Authorization header first
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookies
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = this.parseCookies(cookieHeader);
      return cookies.access_token;
    }

    return null;
  }

  // Main Authentication Middleware
  async authenticate(request) {
    const token = this.extractTokenFromRequest(request);
    if (!token) {
      return { success: false, error: 'No token provided' };
    }

    const payload = this.verifyAccessToken(token);
    if (!payload) {
      return { success: false, error: 'Invalid or expired token' };
    }

    return {
      success: true,
      user: {
        id: payload.userId,
        ...payload
      }
    };
  }
}

// Secondary: Telegram Admin Authentication (for bot operations only)
export function verifyTelegramWebAppData(initData, botToken) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    // Sort parameters
    const params = Array.from(urlParams.entries());
    params.sort((a, b) => a[0].localeCompare(b[0]));
    
    // Create data check string
    const dataCheckString = params
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Create secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Verify hash
    if (calculatedHash !== hash) {
      return null;
    }
    
    // Parse user data - only for admin verification
    const user = JSON.parse(urlParams.get('user'));
    return user;
    
  } catch (error) {
    console.error('Telegram auth verification error:', error);
    return null;
  }
}

// User Registration/Login for JWT system
export async function createOrUpdateUser(db, telegramUser) {
  const userId = `tg_${telegramUser.id}`;
  const now = new Date().toISOString();
  
  // Create or update user in D1
  await db.db.prepare(`
    INSERT INTO users (id, telegram_id, username, first_name, last_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      updated_at = excluded.updated_at
  `).bind(
    userId,
    telegramUser.id,
    telegramUser.username || null,
    telegramUser.first_name || null,
    telegramUser.last_name || null,
    now,
    now
  ).run();
  
  return userId;
}