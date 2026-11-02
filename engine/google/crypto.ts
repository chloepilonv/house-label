/**
 * AES-256-GCM for tokens at rest. Key: HOUSELABEL_ENCRYPTION_KEY, else a
 * generated ~/.houselabel/secret.key. Protects a leaked database dump, not a
 * compromised machine.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_DIR } from "../config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const KEY_PATH = join(CONFIG_DIR, "secret.key");

let cached: Buffer | null = null;

/** 32 bytes from a hex, base64, or arbitrary string. */
function normalize(key: string): Buffer {
  if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) return Buffer.from(key, "hex");
  const b64 = Buffer.from(key, "base64");
  if (b64.length === 32) return b64;
  // Anything else (a passphrase) is hashed rather than rejected.
  return createHash("sha256").update(key).digest();
}

/** The key, generated and persisted on first use. Not called at import, so loading never creates a key file. */
export async function encryptionKey(): Promise<Buffer> {
  if (cached) return cached;

  const fromEnv = process.env.HOUSELABEL_ENCRYPTION_KEY;
  if (fromEnv) return (cached = normalize(fromEnv));

  const onDisk = await readFile(KEY_PATH, "utf8").catch(() => null);
  if (onDisk?.trim()) return (cached = normalize(onDisk.trim()));

  const generated = randomBytes(32);
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(KEY_PATH, `${generated.toString("hex")}\n`, "utf8");
  await chmod(KEY_PATH, 0o600);
  return (cached = generated);
}

/** base64(iv ‖ tag ‖ ciphertext). */
export function encryptWith(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptWith(key: Buffer, ciphertext: string): string {
  const all = Buffer.from(ciphertext, "base64");
  const iv = all.subarray(0, IV_LENGTH);
  const tag = all.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(all.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]).toString("utf8");
}

export const encrypt = async (plaintext: string) => encryptWith(await encryptionKey(), plaintext);
export const decrypt = async (ciphertext: string) => decryptWith(await encryptionKey(), ciphertext);
