-- migrations/add-bot-logging.sql - Bot Logging and Webhook Security Schema (Phase 5.2)

-- Webhook request logging
CREATE TABLE IF NOT EXISTS webhook_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    update_id TEXT NOT NULL,
    source_ip TEXT NOT NULL,
    status TEXT NOT NULL, -- success, failed, duplicate
    error_message TEXT,
    processing_time INTEGER, -- milliseconds
    retry_count INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot error logging
CREATE TABLE IF NOT EXISTS bot_error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context TEXT, -- JSON context data
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot operation logging
CREATE TABLE IF NOT EXISTS bot_operation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL, -- add_movie, add_show, upload, etc.
    operation_id TEXT,
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL, -- started, completed, failed, cancelled
    data TEXT, -- JSON operation data
    duration INTEGER, -- milliseconds
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

-- Bot configuration and settings
CREATE TABLE IF NOT EXISTS bot_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
);

-- Rate limiting tracking
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
    operation_type TEXT NOT NULL, -- bulk_movie_add, bulk_show_add, etc.
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    successful_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    status TEXT NOT NULL, -- queued, processing, completed, failed
    data TEXT, -- JSON operation data
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
    upload_type TEXT, -- movie, episode, image, subtitle, etc.
    processed BOOLEAN DEFAULT FALSE,
    content_id TEXT, -- Associated movie/show ID after processing
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bot statistics cache
CREATE TABLE IF NOT EXISTS bot_stats_cache (
    metric_name TEXT PRIMARY KEY,
    metric_value TEXT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_log_timestamp ON webhook_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_log_status ON webhook_log(status);
CREATE INDEX IF NOT EXISTS idx_bot_error_log_timestamp ON bot_error_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_operation_log_timestamp ON bot_operation_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_operation_log_chat_id ON bot_operation_log(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_admin_sessions_chat_id ON bot_admin_sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_rate_limits_window ON bot_rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_bot_bulk_operations_status ON bot_bulk_operations(status);
CREATE INDEX IF NOT EXISTS idx_bot_file_uploads_processed ON bot_file_uploads(processed);

-- Create triggers for automatic updates
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

-- Initialize default bot configuration
INSERT OR IGNORE INTO bot_config (key, value, description) VALUES 
('max_file_size', '2147483648', 'Maximum file size in bytes (2GB)'),
('command_timeout', '300000', 'Command timeout in milliseconds (5 minutes)'),
('max_concurrent_operations', '5', 'Maximum concurrent bulk operations'),
('rate_limit_requests_per_minute', '30', 'Rate limit for webhook requests'),
('admin_notification_enabled', 'true', 'Enable admin notifications'),
('bulk_operation_batch_size', '10', 'Batch size for bulk operations'),
('file_cleanup_interval', '3600000', 'File cleanup interval in milliseconds (1 hour)'),
('log_retention_days', '30', 'Number of days to retain logs');

-- Create view for bot dashboard
CREATE VIEW IF NOT EXISTS bot_dashboard AS
SELECT 
    -- Recent activity
    (SELECT COUNT(*) FROM webhook_log WHERE timestamp > datetime('now', '-1 hour')) as webhooks_last_hour,
    (SELECT COUNT(*) FROM bot_operation_log WHERE timestamp > datetime('now', '-1 hour')) as operations_last_hour,
    (SELECT COUNT(*) FROM bot_error_log WHERE timestamp > datetime('now', '-1 hour')) as errors_last_hour,
    
    -- Active sessions
    (SELECT COUNT(*) FROM bot_admin_sessions WHERE session_end IS NULL) as active_sessions,
    
    -- Bulk operations
    (SELECT COUNT(*) FROM bot_bulk_operations WHERE status IN ('queued', 'processing')) as active_bulk_operations,
    
    -- File uploads
    (SELECT COUNT(*) FROM bot_file_uploads WHERE processed = FALSE) as pending_file_uploads,
    
    -- System health
    (SELECT CASE WHEN COUNT(*) > 0 THEN 'unhealthy' ELSE 'healthy' END 
     FROM bot_error_log WHERE timestamp > datetime('now', '-5 minutes')) as system_health;

-- Create view for recent bot activity
CREATE VIEW IF NOT EXISTS bot_recent_activity AS
SELECT 
    'webhook' as activity_type,
    update_id as activity_id,
    source_ip as source,
    status,
    error_message,
    timestamp
FROM webhook_log
WHERE timestamp > datetime('now', '-24 hours')

UNION ALL

SELECT 
    'operation' as activity_type,
    operation_id as activity_id,
    chat_id as source,
    status,
    NULL as error_message,
    timestamp
FROM bot_operation_log
WHERE timestamp > datetime('now', '-24 hours')

UNION ALL

SELECT 
    'error' as activity_type,
    operation as activity_id,
    'system' as source,
    'error' as status,
    error_message,
    timestamp
FROM bot_error_log
WHERE timestamp > datetime('now', '-24 hours')

ORDER BY timestamp DESC
LIMIT 100;

-- Clean up old data procedure (to be run periodically)
-- This is a comment since D1 doesn't support stored procedures,
-- but the logic can be implemented in the application:
--
-- DELETE FROM webhook_log WHERE timestamp < datetime('now', '-30 days');
-- DELETE FROM bot_error_log WHERE timestamp < datetime('now', '-30 days');
-- DELETE FROM bot_operation_log WHERE timestamp < datetime('now', '-90 days');
-- DELETE FROM bot_rate_limits WHERE window_start < datetime('now', '-1 day');
-- DELETE FROM bot_file_uploads WHERE timestamp < datetime('now', '-7 days') AND processed = TRUE;