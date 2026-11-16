// Server-only staff PIN gate. The PIN itself is never stored — only its
// SHA-256 hash (STAFF_PIN_HASH secret). A correct PIN earns a short-lived
// HMAC-signed token; every staff action re-validates that token server-side.
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmac(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function pinHash() {
  const hash = process.env["STAFF_PIN_HASH"];
  if (!hash) throw new Error("Staff access is not configured.");
  return hash;
}

export async function verifyStaffPin(pin: string) {
  const digest = await sha256(pin);
  if (!timingSafeEqual(digest, pinHash())) return null;
  const expiry = Date.now() + TOKEN_TTL_MS;
  const signature = await hmac(pinHash(), String(expiry));
  return `${expiry}.${signature}`;
}

export async function requireStaffToken(token: string) {
  const [expiryText, signature] = token.split(".");
  const expiry = Number(expiryText);
  if (!expiryText || !signature || !Number.isFinite(expiry) || expiry < Date.now()) throw new Error("Staff session expired. Enter the PIN again.");
  const expected = await hmac(pinHash(), expiryText);
  if (!timingSafeEqual(signature, expected)) throw new Error("Staff session is invalid. Enter the PIN again.");
}
