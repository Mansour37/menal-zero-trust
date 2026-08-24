import { createHmac } from "crypto";

/**
 * Generateur TOTP (RFC 6238 / HOTP RFC 4226) autonome, sans dependance npm
 * supplementaire (Node "crypto" suffit) — utilise uniquement par les tests
 * e2e pour produire un code valide pour un compte MFA de test dont le secret
 * base32 est connu (TEST_MFA_SECRET), le meme algorithme que pyotp cote API
 * (app/auth/mfa.py) : SHA1, pas de 30s, 6 chiffres.
 */
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const val = alphabet.indexOf(char);
    if (val === -1) throw new Error(`Caractere base32 invalide: ${char}`);
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotp(
  secretBase32: string,
  { stepSeconds = 30, digits = 6, atMs = Date.now() }: { stepSeconds?: number; digits?: number; atMs?: number } = {},
): string {
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const key = base32Decode(secretBase32);
  const hmac = createHmac("sha1", key).update(counterBuf).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binCode % 10 ** digits).toString().padStart(digits, "0");
}

/** Code a 6 chiffres garanti different du code TOTP valide courant. */
export function wrongTotp(secretBase32: string): string {
  const valid = generateTotp(secretBase32);
  const wrong = (parseInt(valid, 10) + 1) % 1_000_000;
  return wrong.toString().padStart(6, "0");
}
