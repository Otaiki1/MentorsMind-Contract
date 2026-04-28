import { Pool } from 'pg';

const RELEASE_WINDOW_HOURS = 48;
const MAX_ESCROW_AGE_DAYS = 30; // FIX #260: Upper bound on escrow age
const MAX_RELEASE_ATTEMPTS = 5; // FIX #260: Max retry attempts
const RETRY_COOLDOWN_HOURS = 1; // FIX #260: Cooldown between retry attempts

export class EscrowCheckWorker {
  constructor(private readonly pool: Pool) {}

  /**
   * Checks for escrows that have exceeded the release window and triggers auto-release.
   * 
   * FIX #260: Added upper age bound, retry limits, and cooldown to prevent:
   * - Processing ancient escrows indefinitely
   * - Hammering the RPC with repeated failed attempts
   * - Duplicate on-chain operations
   */
  async checkAutoRelease(): Promise<void> {
    // FIX #260: Query now includes:
    // 1. Upper age bound (30 days)
    // 2. Max attempts check (release_attempts < 5)
    // 3. Cooldown period (last_release_attempt_at is NULL or > 1 hour ago)
    const sql = `
      SELECT id, mentor_id, learner_id, amount, 
             COALESCE(release_attempts, 0) as release_attempts
      FROM escrows
      WHERE status IN ('funded', 'pending')
      AND created_at < NOW() - ($1 * INTERVAL '1 hour')
      AND created_at > NOW() - ($2 * INTERVAL '1 day')
      AND COALESCE(release_attempts, 0) < $3
      AND (last_release_attempt_at IS NULL 
           OR last_release_attempt_at < NOW() - ($4 * INTERVAL '1 hour'))
    `;

    try {
      const result = await this.pool.query(sql, [
        RELEASE_WINDOW_HOURS,
        MAX_ESCROW_AGE_DAYS,
        MAX_RELEASE_ATTEMPTS,
        RETRY_COOLDOWN_HOURS
      ]);
      
      if (result.rows.length === 0) {
        return;
      }

      console.log(`[EscrowCheckWorker] Found ${result.rows.length} escrows for auto-release.`);

      for (const row of result.rows) {
        await this.processAutoRelease(row);
      }
      
      // FIX #260: Alert on stuck escrows that exceeded max attempts
      await this.alertStuckEscrows();
    } catch (error) {
      console.error('[EscrowCheckWorker] Error checking auto-release:', error);
      throw error;
    }
  }

  private async processAutoRelease(escrow: any): Promise<void> {
    console.log(`[EscrowCheckWorker] Processing auto-release for escrow ${escrow.id} (attempt ${escrow.release_attempts + 1})`);
    
    try {
      // FIX #260: Increment release_attempts and update last_release_attempt_at
      await this.pool.query(
        `UPDATE escrows 
         SET release_attempts = COALESCE(release_attempts, 0) + 1,
             last_release_attempt_at = NOW()
         WHERE id = $1`,
        [escrow.id]
      );
      
      // TODO: Actual Soroban contract call here
      // const result = await sorobanClient.releaseEscrow(escrow.id);
      
      // On success, update status
      // await this.pool.query("UPDATE escrows SET status = 'released' WHERE id = $1", [escrow.id]);
    } catch (error) {
      console.error(`[EscrowCheckWorker] Failed to release escrow ${escrow.id}:`, error);
      
      // Check if max attempts reached
      const attempts = escrow.release_attempts + 1;
      if (attempts >= MAX_RELEASE_ATTEMPTS) {
        console.error(`[EscrowCheckWorker] Escrow ${escrow.id} exceeded max attempts (${MAX_RELEASE_ATTEMPTS}). Flagging as stuck.`);
        // TODO: Alert admins about stuck escrow
      }
    }
  }

  /**
   * FIX #260: Identifies and alerts on escrows that have exceeded max retry attempts.
   * These escrows are stuck and require manual intervention.
   */
  private async alertStuckEscrows(): Promise<void> {
    const sql = `
      SELECT id, mentor_id, learner_id, amount, release_attempts, created_at
      FROM escrows
      WHERE status IN ('funded', 'pending')
      AND COALESCE(release_attempts, 0) >= $1
      AND created_at > NOW() - ($2 * INTERVAL '1 day')
    `;
    
    try {
      const result = await this.pool.query(sql, [
        MAX_RELEASE_ATTEMPTS,
        MAX_ESCROW_AGE_DAYS
      ]);
      
      if (result.rows.length > 0) {
        console.error(
          `[EscrowCheckWorker] ALERT: ${result.rows.length} stuck escrows require manual intervention:`,
          result.rows.map(r => ({ id: r.id, attempts: r.release_attempts, age_days: Math.floor((Date.now() - r.created_at.getTime()) / (1000 * 60 * 60 * 24)) }))
        );
        // TODO: Send alert to admin monitoring system (email, Slack, PagerDuty, etc.)
      }
    } catch (error) {
      console.error('[EscrowCheckWorker] Error checking stuck escrows:', error);
    }
  }
}
