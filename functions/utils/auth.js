// functions/utils/auth.js
import crypto from 'crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, originalHash] = stored.split(':');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');
  return hash === originalHash;
}

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
    
    // Parse user data
    const user = JSON.parse(urlParams.get('user'));
    return user;
    
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}