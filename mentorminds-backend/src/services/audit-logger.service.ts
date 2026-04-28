import { Pool } from 'pg';

export interface AuditLogRecord {
  id: number;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  created_at: Date;
}

export class AuditLoggerService {
  constructor(private readonly pool: Pool) {}

  async log(action: string, actor: string, details: Record<string, unknown> = {}): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (action, actor, details, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [action, actor, JSON.stringify(details)],
    );
  }

  async getRecentLogs(limit = 100): Promise<AuditLogRecord[]> {
    const { rows } = await this.pool.query<AuditLogRecord>(
      `SELECT id, action, actor, details, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  }

  /**
   * Deletes audit log entries older than `retentionDays` days.
   *
   * Uses arithmetic multiplication ($1 * INTERVAL '1 day') instead of
   * string concatenation to prevent SQL injection — PostgreSQL only
   * accepts a numeric left-hand operand for this form.
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    if (!Number.isInteger(retentionDays) || retentionDays < 1) {
      throw new Error('Invalid retention days: must be a positive integer');
    }

    const { rowCount } = await this.pool.query(
      `DELETE FROM audit_logs
       WHERE created_at < NOW() - ($1 * INTERVAL '1 day')`,
      [retentionDays],
    );

    return rowCount ?? 0;
  }
}
