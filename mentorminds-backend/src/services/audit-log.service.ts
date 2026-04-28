import { createHash } from 'crypto';

export interface AuditLogEntry {
  id: string;
  action: string;
  user_id: string;
  txHash: string;
  walletAddress: string;
  sequenceNumber: string;
  record_hash: string;
  previous_hash: string | null;
  createdAt: Date;
}

// In-memory store — replace with DB in production
const logs: AuditLogEntry[] = [];

/**
 * Computes the canonical SHA-256 hash for an audit log record.
 * Algorithm: SHA-256( id + action + user_id + createdAt.toISOString() + (previous_hash ?? '') )
 */
export function computeRecordHash(entry: Pick<AuditLogEntry, 'id' | 'action' | 'user_id' | 'createdAt' | 'previous_hash'>): string {
  const content = [
    entry.id,
    entry.action,
    entry.user_id,
    entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
    entry.previous_hash ?? '',
  ].join('|');
  return createHash('sha256').update(content).digest('hex');
}

export class AuditLogService {
  create(data: Omit<AuditLogEntry, 'id' | 'createdAt' | 'record_hash' | 'previous_hash'>): AuditLogEntry {
    const previous = logs.length > 0 ? logs[logs.length - 1] : null;
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      ...data,
      previous_hash: previous?.record_hash ?? null,
      createdAt: new Date(),
      record_hash: '',
    };
    entry.record_hash = computeRecordHash(entry);
    logs.push(entry);
    return entry;
  }

  findByWallet(walletAddress: string): AuditLogEntry[] {
    return logs.filter(e => e.walletAddress === walletAddress);
  }

  findByTxHash(txHash: string): AuditLogEntry | undefined {
    return logs.find(e => e.txHash === txHash);
  }

  getAll(): AuditLogEntry[] {
    return [...logs];
  }

  /**
   * Verifies the integrity of the audit log chain.
   * Checks both chain links (previous_hash) and content hashes (record_hash).
   */
  verifyChainIntegrity(entries: AuditLogEntry[] = logs): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const current = entries[i];

      // 1. Verify content hash
      const expectedHash = computeRecordHash(current);
      if (current.record_hash !== expectedHash) {
        errors.push(`Content tampered at record ${current.id}: hash mismatch`);
      }

      // 2. Verify chain link
      if (i > 0) {
        const previous = entries[i - 1];
        if (current.previous_hash !== previous.record_hash) {
          errors.push(`Chain break at record ${current.id}: previous_hash mismatch`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const auditLogService = new AuditLogService();
