-- Phase 2.1 Secure Ticket System Tables

-- Streaming tickets table with revocation and usage tracking
CREATE TABLE IF NOT EXISTS streaming_tickets (
  id TEXT PRIMARY KEY,                    -- UUID v4
  user_id TEXT NOT NULL,                  -- User who created the ticket
  content_id TEXT NOT NULL,               -- Movie or show ID
  content_type TEXT NOT NULL,             -- 'movie' or 'show'
  season_number INTEGER,                  -- For TV shows
  episode_number INTEGER,                 -- For TV shows
  file_id TEXT NOT NULL,                  -- Telegram file ID
  hmac_token TEXT NOT NULL,               -- HMAC signature for verification
  client_ip TEXT NOT NULL,                -- IP address for security
  user_agent TEXT,                        -- User agent for tracking
  created_at INTEGER NOT NULL,            -- Timestamp when created
  expires_at INTEGER NOT NULL,            -- Expiration timestamp
  use_count INTEGER DEFAULT 0,            -- Times the ticket has been used
  max_uses INTEGER DEFAULT 3,             -- Maximum allowed uses
  last_used_at INTEGER,                   -- Last time ticket was used
  is_revoked INTEGER DEFAULT 0,           -- Revocation flag
  revoked_at INTEGER,                     -- When ticket was revoked
  revocation_reason TEXT,                 -- Why ticket was revoked
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance and security monitoring
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON streaming_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_expires_at ON streaming_tickets(expires_at);
CREATE INDEX IF NOT EXISTS idx_tickets_client_ip ON streaming_tickets(client_ip);
CREATE INDEX IF NOT EXISTS idx_tickets_is_revoked ON streaming_tickets(is_revoked);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON streaming_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_content ON streaming_tickets(content_id, content_type);

-- Security events table for audit logging
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,               -- 'ticket_create', 'ticket_use', 'ticket_revoke', etc.
  user_id TEXT,                           -- User involved (if applicable)
  client_ip TEXT,                         -- IP address
  user_agent TEXT,                        -- User agent
  details TEXT,                           -- JSON details about the event
  severity TEXT DEFAULT 'info',           -- 'low', 'medium', 'high', 'critical'
  timestamp INTEGER NOT NULL,             -- Event timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for security monitoring
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(client_ip);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);