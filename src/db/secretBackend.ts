import Dexie, { type Table } from "dexie";
import type { SecretBackend, StoredSecret } from "@shared/claude/keyVault";

interface Row extends StoredSecret {
  name: string;
}

/**
 * A database of its own, separate from the progress data, so the key can never be exported by accident
 * (the progress file only reads the main database).
 */
class SecretsDatabase extends Dexie {
  secrets!: Table<Row, string>;
  constructor() {
    super("inburgering-a2-secrets");
    this.version(1).stores({ secrets: "name" });
  }
}

export function createDexieSecretBackend(): SecretBackend {
  const db = new SecretsDatabase();
  return {
    get: (name) => db.secrets.get(name),
    put: async (name, secret) => {
      await db.secrets.put({ ...secret, name });
    },
    delete: (name) => db.secrets.delete(name),
  };
}
