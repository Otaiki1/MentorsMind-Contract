import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('ENCRYPTION_KEY environment variable is not set');
  return createHash('sha256').update(secret).digest();
}

interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

function parseEncryptedValue(value: string): EncryptedPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Invalid encrypted payload: not valid JSON');
  }
  const p = parsed as Record<string, unknown>;
  if (typeof p.iv !== 'string' || typeof p.tag !== 'string' || typeof p.data !== 'string') {
    throw new Error('Invalid encrypted payload: missing required fields');
  }
  return { iv: p.iv, tag: p.tag, data: p.data };
}

export class EncryptionUtil {
  static encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload: EncryptedPayload = {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted.toString('hex'),
    };
    return JSON.stringify(payload);
  }

  static decrypt(value: string): string {
    const key = getKey();
    const { iv, tag, data } = parseEncryptedValue(value);
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8');
  }

  /**
   * Safe variant of decrypt — returns null instead of throwing when the
   * encrypted value is missing, corrupted, or fails authentication.
   */
  static decryptSafe(value: string | null | undefined): string | null {
    if (value == null) return null;
    try {
      return EncryptionUtil.decrypt(value);
    } catch {
      return null;
    }
  }
}
