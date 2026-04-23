import { Pool, QueryResult } from 'pg';
import { EscrowCheckWorker } from '../src/jobs/escrowCheck.worker';

/**
 * Integration tests for EscrowCheckWorker - Dispute Guard
 * 
 * These tests can run in two modes:
 * 1. MOCK MODE (default): Uses mocked database for fast unit testing
 * 2. INTEGRATION MODE: Uses real database when DATABASE_URL is set
 * 
 * To run with real database:
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/testdb npm test -- escrowCheck.worker.test.ts
 */

const USE_REAL_DB = !!process.env.DATABASE_URL;

describe('EscrowCheckWorker - Dispute Guard', () => {
  let pool: Pool;
  let mockPool: jest.Mocked<Pool>;
  let worker: EscrowCheckWorker;
  let mockAutoReleaseService: jest.Mocked<any>;

  beforeAll(async () => {
    if (USE_REAL_DB) {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      // Create test tables if they don't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS escrows (
          id SERIAL PRIMARY KEY,
          status VARCHAR(50) NOT NULL,
          session_end_time TIMESTAMP NOT NULL,
          learner_id VARCHAR(255) NOT NULL,
          mentor_id VARCHAR(255) NOT NULL,
          amount INTEGER NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS disputes (
          id SERIAL PRIMARY KEY,
          transaction_id INTEGER REFERENCES escrows(id) ON DELETE CASCADE,
          status VARCHAR(50) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }
  });

  beforeEach(() => {
    if (USE_REAL_DB) {
      mockAutoReleaseService = {
        tryAutoRelease: jest.fn().mockResolvedValue({ hash: 'mock-hash' }),
      };
      worker = new EscrowCheckWorker(pool, mockAutoReleaseService);
    } else {
      mockPool = {
        query: jest.fn(),
      } as any;
      
      mockAutoReleaseService = {
        tryAutoRelease: jest.fn().mockResolvedValue({ hash: 'mock-hash' }),
      };
      
      worker = new EscrowCheckWorker(mockPool, mockAutoReleaseService);
    }
  });

  afterEach(async () => {
    if (USE_REAL_DB) {
      // Clean up test data
      await pool.query('DELETE FROM disputes');
      await pool.query('DELETE FROM escrows');
    }
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (USE_REAL_DB) {
      // Drop test tables
      await pool.query('DROP TABLE IF EXISTS disputes CASCADE');
      await pool.query('DROP TABLE IF EXISTS escrows CASCADE');
      await pool.end();
    }
  });

  it('should NOT auto-release escrow with active dispute', async () => {
    if (USE_REAL_DB) {
      // Real database test
      const escrowResult = await pool.query(
        `INSERT INTO escrows (status, session_end_time, learner_id, mentor_id, amount)
         VALUES ('active', NOW() - INTERVAL '73 hours', 'learner1', 'mentor1', 100)
         RETURNING id`
      );
      const escrowId = escrowResult.rows[0].id;

      await pool.query(
        `INSERT INTO disputes (transaction_id, status, created_at)
         VALUES ($1, 'open', NOW())`,
        [escrowId]
      );

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).not.toHaveBeenCalled();
    } else {
      // Mock test
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).not.toHaveBeenCalled();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('d.transaction_id = e.id'),
        []
      );
    }
  });

  it('should auto-release escrow with resolved dispute', async () => {
    if (USE_REAL_DB) {
      const escrowResult = await pool.query(
        `INSERT INTO escrows (status, session_end_time, learner_id, mentor_id, amount)
         VALUES ('active', NOW() - INTERVAL '73 hours', 'learner2', 'mentor2', 100)
         RETURNING id`
      );
      const escrowId = escrowResult.rows[0].id;

      await pool.query(
        `INSERT INTO disputes (transaction_id, status, created_at)
         VALUES ($1, 'resolved', NOW())`,
        [escrowId]
      );

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(escrowId);
    } else {
      const escrowId = 2;
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: escrowId }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(escrowId);
    }
  });

  it('should auto-release escrow with closed dispute', async () => {
    if (USE_REAL_DB) {
      const escrowResult = await pool.query(
        `INSERT INTO escrows (status, session_end_time, learner_id, mentor_id, amount)
         VALUES ('active', NOW() - INTERVAL '73 hours', 'learner3', 'mentor3', 100)
         RETURNING id`
      );
      const escrowId = escrowResult.rows[0].id;

      await pool.query(
        `INSERT INTO disputes (transaction_id, status, created_at)
         VALUES ($1, 'closed', NOW())`,
        [escrowId]
      );

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(escrowId);
    } else {
      const escrowId = 3;
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: escrowId }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(escrowId);
    }
  });

  it('should auto-release escrow with no disputes', async () => {
    if (USE_REAL_DB) {
      const escrowResult = await pool.query(
        `INSERT INTO escrows (status, session_end_time, learner_id, mentor_id, amount)
         VALUES ('active', NOW() - INTERVAL '73 hours', 'learner4', 'mentor4', 100)
         RETURNING id`
      );
      const escrowId = escrowResult.rows[0].id;

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(escrowId);
    } else {
      const escrowId = 4;
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: escrowId }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as QueryResult);

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(escrowId);
    }
  });

  it('should NOT auto-release escrow with pending dispute', async () => {
    if (USE_REAL_DB) {
      const escrowResult = await pool.query(
        `INSERT INTO escrows (status, session_end_time, learner_id, mentor_id, amount)
         VALUES ('active', NOW() - INTERVAL '73 hours', 'learner5', 'mentor5', 100)
         RETURNING id`
      );
      const escrowId = escrowResult.rows[0].id;

      await pool.query(
        `INSERT INTO disputes (transaction_id, status, created_at)
         VALUES ($1, 'pending', NOW())`,
        [escrowId]
      );

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).not.toHaveBeenCalled();
    } else {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).not.toHaveBeenCalled();
    }
  });

  it('should NOT auto-release escrow with under_review dispute', async () => {
    if (USE_REAL_DB) {
      const escrowResult = await pool.query(
        `INSERT INTO escrows (status, session_end_time, learner_id, mentor_id, amount)
         VALUES ('active', NOW() - INTERVAL '73 hours', 'learner6', 'mentor6', 100)
         RETURNING id`
      );
      const escrowId = escrowResult.rows[0].id;

      await pool.query(
        `INSERT INTO disputes (transaction_id, status, created_at)
         VALUES ($1, 'under_review', NOW())`,
        [escrowId]
      );

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).not.toHaveBeenCalled();
    } else {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).not.toHaveBeenCalled();
    }
  });

  it('should process multiple eligible escrows', async () => {
    if (USE_REAL_DB) {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const result = await pool.query(
          `INSERT INTO escrows (status, session_end_time, learner_id, mentor_id, amount)
           VALUES ('active', NOW() - INTERVAL '73 hours', $1, $2, 100)
           RETURNING id`,
          [`learner${10 + i}`, `mentor${10 + i}`]
        );
        ids.push(result.rows[0].id);
      }

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledTimes(3);
      ids.forEach(id => {
        expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(id);
      });
    } else {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 10 }, { id: 20 }, { id: 30 }],
        command: 'SELECT',
        rowCount: 3,
        oid: 0,
        fields: [],
      } as QueryResult);

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledTimes(3);
      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(10);
      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(20);
      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(30);
    }
  });

  it('should continue processing if one auto-release fails', async () => {
    if (USE_REAL_DB) {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const result = await pool.query(
          `INSERT INTO escrows (status, session_end_time, learner_id, mentor_id, amount)
           VALUES ('active', NOW() - INTERVAL '73 hours', $1, $2, 100)
           RETURNING id`,
          [`learner${20 + i}`, `mentor${20 + i}`]
        );
        ids.push(result.rows[0].id);
      }

      mockAutoReleaseService.tryAutoRelease
        .mockResolvedValueOnce({ hash: 'hash1' })
        .mockRejectedValueOnce(new Error('Release failed'))
        .mockResolvedValueOnce({ hash: 'hash3' });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledTimes(3);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-release failed for escrow'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    } else {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 10 }, { id: 20 }, { id: 30 }],
        command: 'SELECT',
        rowCount: 3,
        oid: 0,
        fields: [],
      } as QueryResult);

      mockAutoReleaseService.tryAutoRelease
        .mockResolvedValueOnce({ hash: 'hash1' })
        .mockRejectedValueOnce(new Error('Release failed'))
        .mockResolvedValueOnce({ hash: 'hash3' });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await worker.processEligibleEscrows();

      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledTimes(3);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Auto-release failed for escrow 20:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    }
  });

  it('should use correct SQL query with transaction_id column', async () => {
    if (USE_REAL_DB) {
      // This test verifies the query works with real database
      const escrowResult = await pool.query(
        `INSERT INTO escrows (status, session_end_time, learner_id, mentor_id, amount)
         VALUES ('active', NOW() - INTERVAL '73 hours', 'learner7', 'mentor7', 100)
         RETURNING id`
      );
      const escrowId = escrowResult.rows[0].id;

      // Add an active dispute - should block auto-release
      await pool.query(
        `INSERT INTO disputes (transaction_id, status, created_at)
         VALUES ($1, 'open', NOW())`,
        [escrowId]
      );

      await worker.processEligibleEscrows();

      // Should NOT be called because of active dispute
      expect(mockAutoReleaseService.tryAutoRelease).not.toHaveBeenCalled();

      // Now resolve the dispute
      await pool.query(
        `UPDATE disputes SET status = 'resolved' WHERE transaction_id = $1`,
        [escrowId]
      );

      await worker.processEligibleEscrows();

      // Should NOW be called
      expect(mockAutoReleaseService.tryAutoRelease).toHaveBeenCalledWith(escrowId);
    } else {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as QueryResult);

      await worker.processEligibleEscrows();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE d\.transaction_id = e\.id/),
        []
      );
      expect(mockPool.query).not.toHaveBeenCalledWith(
        expect.stringMatching(/d\.escrow_id/),
        []
      );
    }
  });
});
