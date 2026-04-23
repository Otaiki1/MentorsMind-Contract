import { Pool } from 'pg';

export interface EscrowAutoReleaseService {
  tryAutoRelease(escrowId: number): Promise<{ hash: string }>;
}

export class EscrowCheckWorker {
  constructor(
    private readonly pool: Pool,
    private readonly autoReleaseService: EscrowAutoReleaseService
  ) {}

  async processEligibleEscrows(): Promise<void> {
    const eligibleEscrows = await this.pool.query<{ id: number }>(
      `SELECT e.id
       FROM escrows e
       WHERE e.status = 'active'
         AND e.session_end_time < NOW() - INTERVAL '72 hours'
         AND NOT EXISTS (
           SELECT 1 FROM disputes d
           WHERE d.transaction_id = e.id
             AND d.status NOT IN ('resolved', 'closed')
         )`,
      []
    );

    for (const row of eligibleEscrows.rows) {
      try {
        await this.autoReleaseService.tryAutoRelease(row.id);
      } catch (err) {
        console.error(`Auto-release failed for escrow ${row.id}:`, err);
      }
    }
  }
}
