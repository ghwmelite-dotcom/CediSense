import { generateId } from './db.js';

interface AuditEntry {
  adminId: string;
  action: string;
  targetType: 'user' | 'group' | 'member' | 'message' | 'claim';
  targetId: string;
  details?: Record<string, unknown>;
}

/**
 * Log an admin action to the audit trail.
 */
export async function logAuditAction(db: D1Database, entry: AuditEntry): Promise<void> {
  await db.prepare(
    `INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    generateId(),
    entry.adminId,
    entry.action,
    entry.targetType,
    entry.targetId,
    entry.details ? JSON.stringify(entry.details) : null,
  ).run();
}
