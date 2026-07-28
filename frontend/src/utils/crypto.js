// -----------------------------------------------------------------
// Client-side End-to-End Encryption helpers (Web Crypto API).
//
// Model: all participants share a "room passphrase" out-of-band
// (e.g. they agree on it verbally / over a separate secure channel).
// The passphrase NEVER leaves the browser and is NEVER sent to the
// server. Everyone who knows the passphrase derives the same
// AES-256-GCM key locally, so:
//
//   - The server only ever sees/stores ciphertext + iv.
//   - Anyone without the passphrase (including the server operator,
//     or an attacker who steals the database) cannot read messages.
//
// Limitations (be aware of these):
//   - No forward secrecy: if the passphrase leaks later, all past
//     messages encrypted with it can be decrypted retroactively.
//   - No per-user keys: everyone with the passphrase can read
//     everyone else's messages (fine for a shared room, not for
//     1:1 private chat semantics).
//   - Passphrase distribution is manual/out-of-band by design.
// -----------------------------------------------------------------

// Salt for PBKDF2. This does not need to be secret, only unique
// enough to prevent precomputed rainbow-table attacks. In a more
// advanced version you'd generate a random salt per room and store
// it (non-secretly) on the server so different rooms don't reuse it.
const STATIC_SALT = "chatapp-e2ee-room-salt-v1";

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * Derives an AES-256-GCM CryptoKey from a human-readable passphrase,
 * scoped to a specific conversation (`roomId`). Mixing the room id
 * into the salt means the SAME passphrase used in two different
 * conversations still produces two different encryption keys - so
 * reusing a passphrase across chats (which people will inevitably do)
 * doesn't let one conversation's key decrypt another's messages.
 */
export async function deriveKeyFromPassphrase(passphrase, roomId = "default") {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(`${STATIC_SALT}:${roomId}`),
      iterations: 150000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // not extractable - key material can't be exported/leaked
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts plaintext with the given key. Returns base64 ciphertext
 * and the base64 IV (initialization vector) that must travel
 * alongside it - the IV is not secret, it just needs to be unique
 * per message and is required to decrypt.
 */
export async function encryptMessage(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const enc = new TextEncoder();

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypts base64 ciphertext + base64 iv back to plaintext.
 * Throws if the key is wrong or the data was tampered with
 * (AES-GCM is authenticated, so tampering is detected, not silently
 * accepted).
 */
export async function decryptMessage(key, ciphertextB64, ivB64) {
  const iv = base64ToBuffer(ivB64);
  const ciphertext = base64ToBuffer(ciphertextB64);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plainBuffer);
}
