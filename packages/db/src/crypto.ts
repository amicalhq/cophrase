import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const envKey = process.env.PROVIDER_ENCRYPTION_KEY
  if (!envKey) {
    throw new Error("PROVIDER_ENCRYPTION_KEY environment variable is not set")
  }
  // Derive a 32-byte key using HMAC-SHA256 with a fixed info string
  return createHmac("sha256", Buffer.from(envKey, "base64"))
    .update("cophrase-provider-keys")
    .digest()
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey()
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(":")
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Invalid encrypted value format")
  }

  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const ciphertext = Buffer.from(ciphertextB64, "base64")

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8")
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••"
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}
