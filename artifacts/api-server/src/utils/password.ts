import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

const SALT_LEN = 16;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const key = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedKey] = hash.split(":");
  if (!salt || !storedKey) return false;
  const key = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  const storedBuf = Buffer.from(storedKey, "hex");
  if (key.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(key, storedBuf);
}
