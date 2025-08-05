-- Phase 2.2 Rate Limiting and Security Tables

-- Rate limiting log for sliding window algorithm
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  limit_key TEXT NOT NULL,                -- Combined limit type and identifier
  identifier TEXT NOT NULL,               -- JSON with IP, user ID, user agent
  timestamp INTEGER NOT NULL              -- Request timestamp
);

-- Token bucket storage for burst limiting
CREATE TABLE IF NOT EXISTS token_buckets (
  bucket_key TEXT PRIMARY KEY,            -- Combined limit type and identifier
  tokens INTEGER NOT NULL,                -- Current token count
  last_refill INTEGER NOT NULL,           -- Last refill timestamp
  max_tokens INTEGER NOT NULL,            -- Maximum bucket capacity
  refill_rate INTEGER NOT NULL            -- Tokens per window
);

-- IP blacklist for abuse prevention
CREATE TABLE IF NOT EXISTS ip_blacklist (
  ip_address TEXT PRIMARY KEY,
  reason TEXT NOT NULL,                   -- Why IP was blacklisted
  created_at INTEGER NOT NULL,            -- When blacklist entry was created
  expires_at INTEGER NOT NULL,            -- When blacklist expires
  is_active INTEGER DEFAULT 1             -- Active flag
);

-- Indexes for rate limiting performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit_log(limit_key, timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limit_time ON rate_limit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_buckets_refill ON token_buckets(last_refill);
CREATE INDEX IF NOT EXISTS idx_blacklist_ip_active ON ip_blacklist(ip_address, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON ip_blacklist(expires_at);