-- Phase 2.2 Role-Based Access Control System

-- Add role column to users table
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- User permissions table for fine-grained access control
CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                  -- User receiving the permission
  permission TEXT NOT NULL,               -- Permission string (e.g., 'content:read')
  is_granted INTEGER NOT NULL,            -- 1 for granted, 0 for revoked
  granted_by TEXT,                        -- Admin who granted/revoked
  granted_at INTEGER NOT NULL,            -- Timestamp of change
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, permission)             -- One record per user-permission pair
);

-- Content access control table (for future content restrictions)
CREATE TABLE IF NOT EXISTS content_restrictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id TEXT NOT NULL,               -- Movie or show ID
  restriction_type TEXT NOT NULL,         -- 'age', 'geo', 'subscription', etc.
  restriction_value TEXT NOT NULL,        -- Age rating, country code, tier, etc.
  created_at INTEGER NOT NULL
);

-- Admin activity log for sensitive operations
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id TEXT NOT NULL,            -- Admin performing the action
  action_type TEXT NOT NULL,              -- 'role_change', 'permission_grant', etc.
  target_user_id TEXT,                    -- User being acted upon (if applicable)
  target_resource TEXT,                   -- Resource being modified (if applicable)
  old_value TEXT,                         -- Previous value
  new_value TEXT,                         -- New value
  ip_address TEXT,                        -- Admin's IP
  user_agent TEXT,                        -- Admin's user agent
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for RBAC performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission);
CREATE INDEX IF NOT EXISTS idx_content_restrictions_content ON content_restrictions(content_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_timestamp ON admin_activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_admin_activity_target ON admin_activity_log(target_user_id);