import { Pool } from 'pg';

export type EscrowStatus = 'active' | 'released' | 'disputed' | 'refunded' | 'partial_refund' | 'resolved';

export interface UpdateStatusOptions {
  status: EscrowStatus;
  additionalFields?: {
    stellar_tx_hash?: string;
    dispute_reason?: string;
    resolved_at?: Date;
    released_at?: Date;
    mentor_payout_amount?: string;
    learner_refund_amount?: string;
  };
}

export class EscrowModel {
  constructor(private readonly pool: Pool) {}

  async updateStatus(escrowId: number, options: UpdateStatusOptions): Promise<void> {
    const { status, additionalFields = {} } = options;

    let paramIndex = 1;
    const fields: string[] = [];
    const values: unknown[] = [];

    fields.push(`status = $${paramIndex++}`);
    values.push(status);

    if (additionalFields.stellar_tx_hash !== undefined) {
      fields.push(`stellar_tx_hash = $${paramIndex++}`);
      values.push(additionalFields.stellar_tx_hash);
    }
    if (additionalFields.dispute_reason !== undefined) {
      fields.push(`dispute_reason = $${paramIndex++}`);
      values.push(additionalFields.dispute_reason);
    }
    if (additionalFields.resolved_at !== undefined) {
      fields.push(`resolved_at = $${paramIndex++}`);
      values.push(additionalFields.resolved_at);
    }
    if (additionalFields.released_at !== undefined) {
      fields.push(`released_at = $${paramIndex++}`);
      values.push(additionalFields.released_at);
    }
    if (additionalFields.mentor_payout_amount !== undefined) {
      fields.push(`mentor_payout_amount = $${paramIndex++}`);
      values.push(additionalFields.mentor_payout_amount);
    }
    if (additionalFields.learner_refund_amount !== undefined) {
      fields.push(`learner_refund_amount = $${paramIndex++}`);
      values.push(additionalFields.learner_refund_amount);
    }

    values.push(escrowId);
    const sql = `UPDATE escrows SET ${fields.join(', ')} WHERE id = $${paramIndex}`;

    await this.pool.query(sql, values);
  }

  /**
   * Returns the total volume and count of finalized escrows.
   * Finalized statuses are: 'released', 'refunded', 'resolved'.
   * 'completed' is not a valid EscrowStatus and is intentionally excluded.
   */
  async getTotalVolume(): Promise<{ total_volume: string; count: string }> {
    const FINALIZED_STATUSES: EscrowStatus[] = ['released', 'refunded', 'resolved'];
    const result = await this.pool.query<{ total_volume: string; count: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total_volume, COUNT(*) AS count FROM escrows WHERE status = ANY($1)`,
      [FINALIZED_STATUSES]
    );
    return result.rows[0];
  }
}
