// functions/utils/jwt.js
// Simple JWT verification for web clients
import crypto from 'crypto';

function base64urlDecode(str) {
  const pad = str.length % 4;
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/') +
    (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

export function verifyWebToken(token, secret) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }

    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    if (expectedSig !== signatureB64) {
      return null;
    }

    const payloadJson = base64urlDecode(payloadB64);
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch (err) {
    console.error('JWT verification error:', err);
    return null;
  }
}

export default verifyWebToken;

