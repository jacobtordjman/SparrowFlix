-- migrations/add-cdn-system.sql - CDN System Database Schema (Phase 4.1)

-- Add CDN fields to movies table
ALTER TABLE movies ADD COLUMN cdn_available BOOLEAN DEFAULT FALSE;
ALTER TABLE movies ADD COLUMN cdn_path TEXT;

-- CDN-specific metadata table
CREATE TABLE IF NOT EXISTS movie_cdn_data (
    movie_id TEXT PRIMARY KEY,
    qualities TEXT, -- JSON array of available qualities
    thumbnails TEXT, -- JSON array of thumbnail data
    total_size INTEGER, -- Total size of all CDN files in bytes
    segment_count INTEGER, -- Number of HLS segments
    hls_duration INTEGER, -- Total duration in seconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS cdn_migration (
    movie_id TEXT PRIMARY KEY,
    status TEXT NOT NULL, -- pending, in_progress, completed, failed, rolled_back
    last_attempt DATETIME,
    attempt_count INTEGER DEFAULT 0,
    metadata TEXT, -- JSON metadata about migration process
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

-- Movie statistics for migration priority
CREATE TABLE IF NOT EXISTS movie_stats (
    movie_id TEXT PRIMARY KEY,
    view_count INTEGER DEFAULT 0,
    last_viewed DATETIME,
    bandwidth_used INTEGER DEFAULT 0, -- Total bytes served
    avg_quality TEXT, -- Most requested quality
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

-- CDN usage tracking for free tier limits
CREATE TABLE IF NOT EXISTS cdn_usage (
    date TEXT, -- YYYY-MM-DD format
    movie_id TEXT,
    quality TEXT,
    requests INTEGER DEFAULT 0,
    bytes_served INTEGER DEFAULT 0,
    PRIMARY KEY (date, movie_id, quality),
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

-- Content delivery endpoints tracking
CREATE TABLE IF NOT EXISTS cdn_endpoints (
    id TEXT PRIMARY KEY,
    movie_id TEXT NOT NULL,
    quality TEXT NOT NULL,
    endpoint_type TEXT NOT NULL, -- hls_master, hls_segment, thumbnail
    cdn_url TEXT NOT NULL,
    telegram_fallback_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

-- Transcoding jobs queue
CREATE TABLE IF NOT EXISTS transcoding_jobs (
    id TEXT PRIMARY KEY,
    movie_id TEXT NOT NULL,
    status TEXT NOT NULL, -- queued, processing, completed, failed
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    input_path TEXT,
    output_path TEXT,
    qualities TEXT, -- JSON array of target qualities
    progress INTEGER DEFAULT 0, -- 0-100
    started_at DATETIME,
    completed_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

-- Image assets tracking (posters, thumbnails, etc.)
CREATE TABLE IF NOT EXISTS image_assets (
    id TEXT PRIMARY KEY,
    movie_id TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- poster, backdrop, thumbnail
    size TEXT NOT NULL, -- small, medium, large
    cdn_url TEXT NOT NULL,
    file_size INTEGER,
    dimensions TEXT, -- WxH format
    format TEXT, -- webp, jpg, png
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

-- CDN health monitoring
CREATE TABLE IF NOT EXISTS cdn_health (
    timestamp DATETIME PRIMARY KEY DEFAULT CURRENT_TIMESTAMP,
    service TEXT NOT NULL, -- pages, kv, workers
    status TEXT NOT NULL, -- healthy, degraded, down
    response_time INTEGER, -- milliseconds
    error_message TEXT,
    metadata TEXT -- JSON additional data
);

-- Bandwidth usage tracking for free tier monitoring
CREATE TABLE IF NOT EXISTS bandwidth_usage (
    date TEXT PRIMARY KEY, -- YYYY-MM-DD format
    total_requests INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    peak_concurrent INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cdn_migration_status ON cdn_migration(status);
CREATE INDEX IF NOT EXISTS idx_movie_stats_view_count ON movie_stats(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_cdn_usage_date ON cdn_usage(date);
CREATE INDEX IF NOT EXISTS idx_transcoding_jobs_status ON transcoding_jobs(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_image_assets_movie ON image_assets(movie_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_cdn_health_timestamp ON cdn_health(timestamp DESC);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_movie_cdn_data_timestamp 
    AFTER UPDATE ON movie_cdn_data
    BEGIN
        UPDATE movie_cdn_data SET updated_at = CURRENT_TIMESTAMP WHERE movie_id = NEW.movie_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_cdn_migration_timestamp 
    AFTER UPDATE ON cdn_migration
    BEGIN
        UPDATE cdn_migration SET updated_at = CURRENT_TIMESTAMP WHERE movie_id = NEW.movie_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_movie_stats_timestamp 
    AFTER UPDATE ON movie_stats
    BEGIN
        UPDATE movie_stats SET updated_at = CURRENT_TIMESTAMP WHERE movie_id = NEW.movie_id;
    END;

-- Initialize default data
INSERT OR IGNORE INTO cdn_health (service, status, response_time) VALUES 
('pages', 'unknown', 0),
('kv', 'unknown', 0),
('workers', 'unknown', 0);

-- Create view for migration dashboard
CREATE VIEW IF NOT EXISTS migration_dashboard AS
SELECT 
    m.id,
    m.title,
    m.file_size,
    m.created_at,
    COALESCE(cm.status, 'pending') as migration_status,
    cm.attempt_count,
    cm.last_attempt,
    COALESCE(ms.view_count, 0) as popularity,
    mcd.qualities,
    mcd.total_size as cdn_size,
    CASE 
        WHEN m.cdn_available = 1 THEN 'Available'
        WHEN cm.status = 'failed' THEN 'Failed'
        WHEN cm.status = 'in_progress' THEN 'Processing'
        ELSE 'Pending'
    END as cdn_status
FROM movies m
LEFT JOIN cdn_migration cm ON m.id = cm.movie_id
LEFT JOIN movie_stats ms ON m.id = ms.movie_id
LEFT JOIN movie_cdn_data mcd ON m.id = mcd.movie_id
ORDER BY 
    COALESCE(ms.view_count, 0) DESC,
    m.created_at DESC;