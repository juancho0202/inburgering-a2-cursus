import { maskKey } from "./errors.js";

/**
 * Keeps the learner's API key encrypted at rest.
 *
 * The key is encrypted with AES-GCM using a NON-EXTRACTABLE WebCrypto key. Both live in the browser's
 * IndexedDB, so copying the stored files (a backup, a copied browser profile) gives only unreadable data:
 * the encryption key cannot be exported, not even by our own code. This does NOT protect against hostile
 * code running on the page itself (it could simply ask the vault for the key); see docs/production-readiness.md §5
 * for the other layers (CSP, spend limit, dedicated key).
 */

/** What is stored. `cryptoKey` is a non-extractable CryptoKey (structured-cloneable into IndexedDB). */
export interface StoredSecret {
  cryptoKey: CryptoKey;
  iv: Uint8Array;
  data: ArrayBuffer;
  /** Masked form for the Settings screen, so showing it never needs a decrypt. */
  masked: string;
  savedAt: string;
}

export interface SecretBackend {
  get(name: string): Promise<StoredSecret | undefined>;
  put(name: string, secret: StoredSecret): Promise<void>;
  delete(name: string): Promise<void>;
}

const NAME = "anthropic-api-key";

/** A real key looks like sk-ant-…; this only catches obvious pasting mistakes. */
export function isPlausibleKey(key: string): boolean {
  return key.startsWith("sk-ant-") && key.length >= 20 && !/\s/.test(key);
}

export function createKeyVault(backend: SecretBackend, crypto: Crypto = globalThis.crypto) {
  return {
    /** Encrypts and stores the key (replacing an older one). Returns the masked key. */
    async save(apiKey: string): Promise<string> {
      const key = apiKey.trim();
      if (!isPlausibleKey(key)) throw new Error("invalid_key");
      const cryptoKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(key));
      const masked = maskKey(key)!;
      await backend.put(NAME, { cryptoKey, iv, data, masked, savedAt: new Date().toISOString() });
      return masked;
    },

    /** The key in plain text, only for the moment it is sent to Anthropic. Null if none is stored or it cannot be read. */
    async load(): Promise<string | null> {
      const stored = await backend.get(NAME);
      if (!stored) return null;
      try {
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: stored.iv as BufferSource }, stored.cryptoKey, stored.data);
        return new TextDecoder().decode(plain);
      } catch {
        return null; // damaged or from another profile
      }
    },

    async masked(): Promise<string | null> {
      return (await backend.get(NAME))?.masked ?? null;
    },

    async remove(): Promise<void> {
      await backend.delete(NAME);
    },
  };
}

export type KeyVault = ReturnType<typeof createKeyVault>;
