import { describe, expect, it } from "vitest";
import { createKeyVault, isPlausibleKey, type SecretBackend, type StoredSecret } from "../../shared/claude/keyVault";

const memoryBackend = () => {
  const map = new Map<string, StoredSecret>();
  const backend: SecretBackend = {
    get: async (n) => map.get(n),
    put: async (n, s) => void map.set(n, s),
    delete: async (n) => void map.delete(n),
  };
  return { backend, map };
};

const KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789-ABCD";

describe("api key vault", () => {
  it("round-trips the key and shows it masked", async () => {
    const vault = createKeyVault(memoryBackend().backend);
    expect(await vault.load()).toBeNull();
    expect(await vault.masked()).toBeNull();
    const masked = await vault.save(`  ${KEY}\n`); // pasted with spaces
    expect(masked).toBe("sk-ant-…ABCD");
    expect(await vault.masked()).toBe("sk-ant-…ABCD");
    expect(await vault.load()).toBe(KEY);
  });

  it("never stores the key in plain text", async () => {
    const { backend, map } = memoryBackend();
    await createKeyVault(backend).save(KEY);
    const stored = map.get("anthropic-api-key")!;
    const bytes = Buffer.from(stored.data).toString("latin1");
    expect(bytes).not.toContain("sk-ant");
    expect(JSON.stringify({ masked: stored.masked })).not.toContain("api03");
    expect(stored.masked).toBe("sk-ant-…ABCD");
  });

  it("uses a non-extractable encryption key, so copied storage cannot be decrypted elsewhere", async () => {
    const { backend, map } = memoryBackend();
    await createKeyVault(backend).save(KEY);
    const { cryptoKey } = map.get("anthropic-api-key")!;
    expect(cryptoKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", cryptoKey)).rejects.toThrow();
  });

  it("uses a fresh encryption key and IV every time", async () => {
    const a = memoryBackend();
    const b = memoryBackend();
    await createKeyVault(a.backend).save(KEY);
    await createKeyVault(b.backend).save(KEY);
    const sa = a.map.get("anthropic-api-key")!;
    const sb = b.map.get("anthropic-api-key")!;
    expect(Buffer.from(sa.iv).equals(Buffer.from(sb.iv))).toBe(false);
    expect(Buffer.from(sa.data).equals(Buffer.from(sb.data))).toBe(false);
  });

  it("rejects things that are not keys and stores nothing", async () => {
    const { backend, map } = memoryBackend();
    const vault = createKeyVault(backend);
    for (const bad of ["", "hallo", "sk-ant-kort", "sk-ant-api03-met spatie in de sleutel-abcdefghij", "sk-proj-abcdefghijklmnopqrstuvwxyz"]) {
      await expect(vault.save(bad)).rejects.toThrow("invalid_key");
    }
    expect(map.size).toBe(0);
    expect(isPlausibleKey(KEY)).toBe(true);
  });

  it("returns null instead of garbage when the stored data was changed", async () => {
    const { backend, map } = memoryBackend();
    const vault = createKeyVault(backend);
    await vault.save(KEY);
    const stored = map.get("anthropic-api-key")!;
    const tampered = new Uint8Array(stored.data.slice(0));
    tampered[0] ^= 0xff;
    map.set("anthropic-api-key", { ...stored, data: tampered.buffer });
    expect(await vault.load()).toBeNull();
  });

  it("replaces an older key and removes cleanly", async () => {
    const vault = createKeyVault(memoryBackend().backend);
    await vault.save(KEY);
    await vault.save(KEY.replace("ABCD", "WXYZ"));
    expect(await vault.masked()).toBe("sk-ant-…WXYZ");
    await vault.remove();
    expect(await vault.load()).toBeNull();
    expect(await vault.masked()).toBeNull();
  });
});
