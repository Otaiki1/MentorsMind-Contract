# Architecture Notes

## Audit Log Hash Algorithm

Each audit log record carries a `record_hash` that commits to its content, and a `previous_hash` that chains it to the prior record.

### `record_hash` computation

```
SHA-256( id | action | user_id | createdAt.toISOString() | previous_hash )
```

Fields are joined with the `|` separator. `previous_hash` is the empty string for the first record.

The implementation lives in `mentorminds-backend/src/services/audit-log.service.ts` (`computeRecordHash`).

### Chain verification

`AuditLogService.verifyChainIntegrity` checks two things per record:

1. **Content integrity** — recomputes `record_hash` from the record's fields and compares with the stored value. A mismatch means the record was tampered with after creation.
2. **Chain link** — verifies `current.previous_hash === previous.record_hash`. A mismatch means a record was inserted, deleted, or reordered.
