import { randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>

const KEY_LEN = 64
const SALT_LEN = 16

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN)
  const derived = await scryptAsync(plain, salt, KEY_LEN)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

export async function verifyPassword(
  plain: string,
  stored: string
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  if (expected.length !== KEY_LEN) return false
  const derived = await scryptAsync(plain, salt, KEY_LEN)
  return timingSafeEqual(derived, expected)
}
