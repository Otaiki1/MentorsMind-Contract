import { pool } from '../config/database';
import { EncryptionUtil } from '../utils/encryption.utils';

export interface UserPrivate {
  id: string;
  email: string;
  phone_number: string | null;
  address: string | null;
  date_of_birth: string | null;
  national_id: string | null;
  created_at: Date;
}

/**
 * Maps a raw DB row to UserPrivate, safely decrypting PII fields.
 * If any encrypted field is corrupted, it is returned as null rather than
 * crashing the request — preventing a single bad row from locking a user out.
 */
function mapPrivateRow(row: Record<string, unknown>): UserPrivate {
  return {
    id: row.id as string,
    email: row.email as string,
    phone_number: EncryptionUtil.decryptSafe(row.phone_number_encrypted as string | null),
    address: EncryptionUtil.decryptSafe(row.address_encrypted as string | null),
    date_of_birth: EncryptionUtil.decryptSafe(row.date_of_birth_encrypted as string | null),
    national_id: EncryptionUtil.decryptSafe(row.national_id_encrypted as string | null),
    created_at: row.created_at as Date,
  };
}

export class UsersService {
  async findById(id: string): Promise<UserPrivate | null> {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    if (rows.length === 0) return null;
    return mapPrivateRow(rows[0]);
  }
}

export const usersService = new UsersService();
