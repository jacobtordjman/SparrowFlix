// functions/utils/access-control.js - Role-Based Access Control (Phase 2.2)
// Implements RBAC with permissions stored in D1

export class AccessControl {
  constructor(db) {
    this.db = db;
    
    // Default role permissions
    this.defaultPermissions = {
      'guest': [
        'content:read',
        'search:read'
      ],
      'user': [
        'content:read',
        'search:read', 
        'ticket:create',
        'profile:read',
        'profile:update',
        'watch:read',
        'watch:create'
      ],
      'moderator': [
        'content:read',
        'content:moderate',
        'search:read',
        'ticket:create',
        'ticket:revoke',
        'profile:read', 
        'profile:update',
        'watch:read',
        'watch:create',
        'users:read',
        'reports:read'
      ],
      'admin': [
        'content:*',
        'search:*',
        'ticket:*',
        'profile:*',
        'watch:*',
        'users:*',
        'system:*',
        'reports:*',
        'security:*'
      ]
    };
  }

  // Get user role and permissions
  async getUserPermissions(userId) {
    try {
      // Get user role from database
      const userRole = await this.db.db.prepare(`
        SELECT role FROM users WHERE id = ?
      `).bind(userId).first();

      const role = userRole?.role || 'user';
      
      // Get custom permissions for this user
      const customPerms = await this.db.db.prepare(`
        SELECT permission FROM user_permissions 
        WHERE user_id = ? AND is_granted = 1
      `).bind(userId).all();

      // Get revoked permissions for this user  
      const revokedPerms = await this.db.db.prepare(`
        SELECT permission FROM user_permissions 
        WHERE user_id = ? AND is_granted = 0
      `).bind(userId).all();

      // Combine default role permissions with custom permissions
      let permissions = new Set(this.defaultPermissions[role] || this.defaultPermissions['user']);
      
      // Add custom granted permissions
      customPerms.results?.forEach(perm => permissions.add(perm.permission));
      
      // Remove revoked permissions
      revokedPerms.results?.forEach(perm => permissions.delete(perm.permission));

      return {
        role,
        permissions: Array.from(permissions)
      };
    } catch (error) {
      console.error('Error getting user permissions:', error);
      // Fallback to basic user permissions
      return {
        role: 'user',
        permissions: this.defaultPermissions['user']
      };
    }
  }

  // Check if user has specific permission
  async hasPermission(userId, requiredPermission) {
    if (!userId) {
      // Guest permissions
      const guestPermissions = this.defaultPermissions['guest'];
      return this.checkPermission(guestPermissions, requiredPermission);
    }

    const userPerms = await this.getUserPermissions(userId);
    return this.checkPermission(userPerms.permissions, requiredPermission);
  }

  // Check permission against permission list (supports wildcards)
  checkPermission(userPermissions, requiredPermission) {
    // Direct match
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Wildcard match (e.g., 'content:*' matches 'content:read')
    const [resource, action] = requiredPermission.split(':');
    const wildcardPermission = `${resource}:*`;
    
    if (userPermissions.includes(wildcardPermission)) {
      return true;
    }

    // Super admin wildcard
    if (userPermissions.includes('*:*')) {
      return true;
    }

    return false;
  }

  // Grant permission to user
  async grantPermission(userId, permission, grantedBy) {
    await this.db.db.prepare(`
      INSERT OR REPLACE INTO user_permissions (user_id, permission, is_granted, granted_by, granted_at)
      VALUES (?, ?, 1, ?, ?)
    `).bind(userId, permission, grantedBy, Date.now()).run();
    
    // Log permission change
    await this.logSecurityEvent({
      eventType: 'permission_granted',
      userId: grantedBy,
      targetUserId: userId,
      permission,
      severity: 'medium'
    });
  }

  // Revoke permission from user
  async revokePermission(userId, permission, revokedBy) {
    await this.db.db.prepare(`
      INSERT OR REPLACE INTO user_permissions (user_id, permission, is_granted, granted_by, granted_at)
      VALUES (?, ?, 0, ?, ?)
    `).bind(userId, permission, revokedBy, Date.now()).run();
    
    // Log permission change
    await this.logSecurityEvent({
      eventType: 'permission_revoked',
      userId: revokedBy,
      targetUserId: userId,
      permission,
      severity: 'medium'
    });
  }

  // Update user role
  async updateUserRole(userId, newRole, updatedBy) {
    const validRoles = ['user', 'moderator', 'admin'];
    if (!validRoles.includes(newRole)) {
      throw new Error('Invalid role');
    }

    // Get current role for logging
    const currentUser = await this.db.db.prepare(`
      SELECT role FROM users WHERE id = ?
    `).bind(userId).first();

    await this.db.db.prepare(`
      UPDATE users SET role = ?, updated_at = ? WHERE id = ?
    `).bind(newRole, new Date().toISOString(), userId).run();

    // Log role change
    await this.logSecurityEvent({
      eventType: 'role_changed',
      userId: updatedBy,
      targetUserId: userId,
      details: JSON.stringify({
        oldRole: currentUser?.role || 'user',
        newRole
      }),
      severity: 'high'
    });
  }

  // Get all users with their roles and permissions (admin only)
  async getAllUsersWithRoles(limit = 100, offset = 0) {
    const users = await this.db.db.prepare(`
      SELECT id, username, first_name, role, created_at, updated_at
      FROM users 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    // Get custom permissions for each user
    const usersWithPermissions = await Promise.all(
      users.results.map(async (user) => {
        const permissions = await this.getUserPermissions(user.id);
        return {
          ...user,
          permissions: permissions.permissions
        };
      })
    );

    return usersWithPermissions;
  }

  // Middleware function for API protection
  async requirePermission(userId, requiredPermission) {
    const hasAccess = await this.hasPermission(userId, requiredPermission);
    
    if (!hasAccess) {
      // Log access denied event
      await this.logSecurityEvent({
        eventType: 'access_denied',
        userId,
        requiredPermission,
        severity: 'medium'
      });

      return {
        allowed: false,
        error: 'Insufficient permissions',
        requiredPermission
      };
    }

    return { allowed: true };
  }

  // Content-specific access control
  async canAccessContent(userId, contentId) {
    // Basic permission check
    const canRead = await this.hasPermission(userId, 'content:read');
    if (!canRead) {
      return false;
    }

    // Additional content-specific rules could be added here
    // e.g., age restrictions, geographic restrictions, subscription tiers
    
    return true;
  }

  // Admin panel access control
  async requireAdminAccess(userId) {
    const hasAdmin = await this.hasPermission(userId, 'system:admin');
    
    if (!hasAdmin) {
      await this.logSecurityEvent({
        eventType: 'admin_access_denied',
        userId,
        severity: 'high'
      });
      
      return { allowed: false, error: 'Admin access required' };
    }

    return { allowed: true };
  }

  // Get security audit log
  async getSecurityAuditLog(filters = {}, limit = 100) {
    let query = `
      SELECT se.*, u.username, u.first_name 
      FROM security_events se
      LEFT JOIN users u ON se.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.eventType) {
      query += ` AND se.event_type = ?`;
      params.push(filters.eventType);
    }

    if (filters.userId) {
      query += ` AND se.user_id = ?`;
      params.push(filters.userId);
    }

    if (filters.severity) {
      query += ` AND se.severity = ?`;
      params.push(filters.severity);
    }

    if (filters.since) {
      query += ` AND se.timestamp > ?`;
      params.push(filters.since);
    }

    query += ` ORDER BY se.timestamp DESC LIMIT ?`;
    params.push(limit);

    const result = await this.db.db.prepare(query).bind(...params).all();
    return result.results || [];
  }

  // Security event logging
  async logSecurityEvent(event) {
    try {
      await this.db.db.prepare(`
        INSERT INTO security_events (event_type, user_id, client_ip, user_agent, details, severity, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.eventType,
        event.userId || null,
        event.clientIP || null,
        event.userAgent || null,
        JSON.stringify(event),
        event.severity || 'info',
        Date.now()
      ).run();
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}