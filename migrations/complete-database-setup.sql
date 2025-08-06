-- Complete Database Setup - All Required Tables
-- This migration includes all tables needed for SparrowFlix to function properly

-- ======================================
-- CORE CONTENT TABLES
-- ======================================

-- Movies table
CREATE TABLE IF NOT EXISTS movies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  year INTEGER,
  genre TEXT,
  overview TEXT,
  poster TEXT,
  backdrop TEXT,
  tmdb_id TEXT,
  imdb_id TEXT,
  file_id TEXT,
  file_size INTEGER,
  duration INTEGER,
  rating REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TV Shows table
CREATE TABLE IF NOT EXISTS shows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  year INTEGER,
  genre TEXT,
  overview TEXT,
  poster TEXT,
  backdrop TEXT,
  tmdb_id TEXT,
  seasons INTEGER,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Episodes table
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL,
  season INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  title TEXT,
  overview TEXT,
  air_date TEXT,
  file_id TEXT,
  file_size INTEGER,
  duration INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
);

-- ======================================
-- AUTHENTICATION SYSTEM
-- ======================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_id TEXT UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ======================================
-- SECURE TICKET SYSTEM
-- ======================================

-- Secure tickets table
CREATE TABLE IF NOT EXISTS secure_tickets (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  user_id TEXT,
  ip_address TEXT,
  hmac_token TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  max_usage INTEGER DEFAULT 3,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE
);

-- ======================================
-- RATE LIMITING SYSTEM
-- ======================================

-- Rate limiting log for sliding window algorithm
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  limit_key TEXT NOT NULL,
  identifier TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

-- Token bucket storage for burst limiting
CREATE TABLE IF NOT EXISTS token_buckets (
  bucket_key TEXT PRIMARY KEY,
  tokens INTEGER NOT NULL,
  last_refill INTEGER NOT NULL,
  max_tokens INTEGER NOT NULL,
  refill_rate INTEGER NOT NULL
);

-- IP blacklist for abuse prevention
CREATE TABLE IF NOT EXISTS ip_blacklist (
  ip_address TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- ======================================
-- RBAC SYSTEM
-- ======================================

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action)
);

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT TRUE
);

-- ======================================
-- CDN SYSTEM
-- ======================================

-- CDN content storage
CREATE TABLE IF NOT EXISTS cdn_content (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  original_file_id TEXT,
  cdn_url TEXT,
  cdn_status TEXT DEFAULT 'pending',
  file_size INTEGER,
  mime_type TEXT,
  quality TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS migration_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- CDN usage statistics
CREATE TABLE IF NOT EXISTS cdn_usage_stats (
  date TEXT PRIMARY KEY,
  bandwidth_used INTEGER DEFAULT 0,
  requests_count INTEGER DEFAULT 0,
  storage_used INTEGER DEFAULT 0
);

-- CDN health monitoring
CREATE TABLE IF NOT EXISTS cdn_health_monitoring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time INTEGER,
  error_message TEXT,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- BOT LOGGING SYSTEM
-- ======================================

-- Webhook request logging
CREATE TABLE IF NOT EXISTS webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id TEXT NOT NULL,
  source_ip TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  processing_time INTEGER,
  retry_count INTEGER DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot error logging
CREATE TABLE IF NOT EXISTS bot_error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot operation logging
CREATE TABLE IF NOT EXISTS bot_operation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,
  operation_id TEXT,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT,
  duration INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot admin sessions
CREATE TABLE IF NOT EXISTS bot_admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_end DATETIME,
  operations_count INTEGER DEFAULT 0,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot configuration
CREATE TABLE IF NOT EXISTS bot_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

-- Bot rate limits
CREATE TABLE IF NOT EXISTS bot_rate_limits (
  ip_address TEXT NOT NULL,
  window_start DATETIME NOT NULL,
  request_count INTEGER DEFAULT 1,
  last_request DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ip_address, window_start)
);

-- Bulk operation tracking
CREATE TABLE IF NOT EXISTS bot_bulk_operations (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  data TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  error_message TEXT
);

-- File upload tracking
CREATE TABLE IF NOT EXISTS bot_file_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  upload_type TEXT,
  processed BOOLEAN DEFAULT FALSE,
  content_id TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot statistics cache
CREATE TABLE IF NOT EXISTS bot_stats_cache (
  metric_name TEXT PRIMARY KEY,
  metric_value TEXT NOT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- PERFORMANCE INDEXES
-- ======================================

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
CREATE INDEX IF NOT EXISTS idx_movies_genre ON movies(genre);
CREATE INDEX IF NOT EXISTS idx_shows_title ON shows(title);
CREATE INDEX IF NOT EXISTS idx_episodes_show_id ON episodes(show_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_episode ON episodes(season, episode);

-- Auth indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Ticket indexes
CREATE INDEX IF NOT EXISTS idx_secure_tickets_content ON secure_tickets(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_secure_tickets_expires ON secure_tickets(expires_at);
CREATE INDEX IF NOT EXISTS idx_secure_tickets_user ON secure_tickets(user_id);

-- Rate limiting indexes
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit_log(limit_key, timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limit_time ON rate_limit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_buckets_refill ON token_buckets(last_refill);
CREATE INDEX IF NOT EXISTS idx_blacklist_ip_active ON ip_blacklist(ip_address, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON ip_blacklist(expires_at);

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_log(action);

-- CDN indexes
CREATE INDEX IF NOT EXISTS idx_cdn_content_type_id ON cdn_content(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_cdn_status ON cdn_content(cdn_status);
CREATE INDEX IF NOT EXISTS idx_migration_status ON migration_tracking(status);
CREATE INDEX IF NOT EXISTS idx_migration_priority ON migration_tracking(priority DESC);

-- Bot indexes
CREATE INDEX IF NOT EXISTS idx_webhook_log_timestamp ON webhook_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_log_status ON webhook_log(status);
CREATE INDEX IF NOT EXISTS idx_bot_error_log_timestamp ON bot_error_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_operation_log_timestamp ON bot_operation_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_operation_log_chat_id ON bot_operation_log(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_admin_sessions_chat_id ON bot_admin_sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_rate_limits_window ON bot_rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_bot_bulk_operations_status ON bot_bulk_operations(status);
CREATE INDEX IF NOT EXISTS idx_bot_file_uploads_processed ON bot_file_uploads(processed);

-- ======================================
-- DEFAULT DATA
-- ======================================

-- Default roles
INSERT OR IGNORE INTO roles (id, name, description) VALUES 
('guest', 'Guest', 'Unauthenticated users with minimal access'),
('user', 'User', 'Authenticated users with standard access'),
('moderator', 'Moderator', 'Users with content moderation capabilities'),
('admin', 'Admin', 'Full system access');

-- Default permissions
INSERT OR IGNORE INTO permissions (id, resource, action, description) VALUES 
('movies.read', 'movies', 'read', 'View movies'),
('movies.stream', 'movies', 'stream', 'Stream movie content'),
('shows.read', 'shows', 'read', 'View TV shows'),
('shows.stream', 'shows', 'stream', 'Stream TV show content'),
('content.manage', 'content', 'manage', 'Manage content (add/edit/delete)'),
('users.manage', 'users', 'manage', 'Manage user accounts'),
('system.admin', 'system', 'admin', 'Full system administration');

-- Default role permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES 
-- Guest permissions
('guest', 'movies.read'),
('guest', 'shows.read'),
-- User permissions (includes guest permissions)
('user', 'movies.read'),
('user', 'shows.read'),
('user', 'movies.stream'),
('user', 'shows.stream'),
-- Moderator permissions (includes user permissions)
('moderator', 'movies.read'),
('moderator', 'shows.read'),
('moderator', 'movies.stream'),
('moderator', 'shows.stream'),
('moderator', 'content.manage'),
-- Admin permissions (all permissions)
('admin', 'movies.read'),
('admin', 'shows.read'),
('admin', 'movies.stream'),
('admin', 'shows.stream'),
('admin', 'content.manage'),
('admin', 'users.manage'),
('admin', 'system.admin');

-- Bot configuration defaults
INSERT OR IGNORE INTO bot_config (key, value, description) VALUES 
('max_file_size', '2147483648', 'Maximum file size in bytes (2GB)'),
('command_timeout', '300000', 'Command timeout in milliseconds (5 minutes)'),
('max_concurrent_operations', '5', 'Maximum concurrent bulk operations'),
('rate_limit_requests_per_minute', '30', 'Rate limit for webhook requests'),
('admin_notification_enabled', 'true', 'Enable admin notifications'),
('bulk_operation_batch_size', '10', 'Batch size for bulk operations'),
('file_cleanup_interval', '3600000', 'File cleanup interval in milliseconds (1 hour)'),
('log_retention_days', '30', 'Number of days to retain logs');

-- ======================================
-- TRIGGERS
-- ======================================

-- Update timestamp triggers
CREATE TRIGGER IF NOT EXISTS update_movies_timestamp 
  AFTER UPDATE ON movies
  BEGIN
    UPDATE movies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_shows_timestamp 
  AFTER UPDATE ON shows
  BEGIN
    UPDATE shows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
  AFTER UPDATE ON users
  BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_bot_config_timestamp 
  AFTER UPDATE ON bot_config
  BEGIN
    UPDATE bot_config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
  END;

CREATE TRIGGER IF NOT EXISTS update_admin_session_activity 
  AFTER INSERT ON bot_operation_log
  BEGIN
    UPDATE bot_admin_sessions 
    SET last_activity = CURRENT_TIMESTAMP, 
        operations_count = operations_count + 1
    WHERE chat_id = NEW.chat_id 
    AND session_end IS NULL;
  END;

-- ======================================
-- VIEWS FOR MONITORING
-- ======================================

-- Bot dashboard view
CREATE VIEW IF NOT EXISTS bot_dashboard AS
SELECT 
  (SELECT COUNT(*) FROM webhook_log WHERE timestamp > datetime('now', '-1 hour')) as webhooks_last_hour,
  (SELECT COUNT(*) FROM bot_operation_log WHERE timestamp > datetime('now', '-1 hour')) as operations_last_hour,
  (SELECT COUNT(*) FROM bot_error_log WHERE timestamp > datetime('now', '-1 hour')) as errors_last_hour,
  (SELECT COUNT(*) FROM bot_admin_sessions WHERE session_end IS NULL) as active_sessions,
  (SELECT COUNT(*) FROM bot_bulk_operations WHERE status IN ('queued', 'processing')) as active_bulk_operations,
  (SELECT COUNT(*) FROM bot_file_uploads WHERE processed = FALSE) as pending_file_uploads,
  (SELECT CASE WHEN COUNT(*) > 0 THEN 'unhealthy' ELSE 'healthy' END 
   FROM bot_error_log WHERE timestamp > datetime('now', '-5 minutes')) as system_health;

-- System stats view
CREATE VIEW IF NOT EXISTS system_stats AS
SELECT 
  (SELECT COUNT(*) FROM movies) as total_movies,
  (SELECT COUNT(*) FROM shows) as total_shows,
  (SELECT COUNT(*) FROM episodes) as total_episodes,
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM secure_tickets WHERE expires_at > datetime('now')) as active_tickets,
  (SELECT COUNT(*) FROM ip_blacklist WHERE is_active = 1 AND expires_at > datetime('now', 'unixepoch')) as blacklisted_ips;