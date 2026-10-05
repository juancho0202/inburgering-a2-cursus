import Dexie, { type Table } from "dexie";
import type {
  AttemptRecord,
  ExamRecord,
  ExplanationRecord,
  FlagRecord,
  GeneratedRecord,
  SrsCardRecord,
  UnitRecord,
  WritingRecord,
} from "@shared/schemas/store";
import type { Collection, DataStore, KeyValueStore } from "@shared/store/types";

interface KvRow {
  key: string;
  value: unknown;
}

/** The browser database. Version numbers are for schema changes; data is never thrown away on upgrade. */
export class AppDatabase extends Dexie {
  attempts!: Table<AttemptRecord, string>;
  units!: Table<UnitRecord, string>;
  srsCards!: Table<SrsCardRecord, string>;
  writing!: Table<WritingRecord, string>;
  examResults!: Table<ExamRecord, string>;
  explanations!: Table<ExplanationRecord, string>;
  generated!: Table<GeneratedRecord, string>;
  flags!: Table<FlagRecord, string>;
  kv!: Table<KvRow, string>;

  constructor(name = "inburgering-a2") {
    super(name);
    this.version(1).stores({
      attempts: "id, itemId, at",
      units: "id",
      srsCards: "id, refId, due",
      writing: "id, exerciseId",
      examResults: "id, examId",
      explanations: "id",
      generated: "id, unitId",
      flags: "id, itemId",
      kv: "key",
    });
  }
}

class TableCollection<T extends { id: string }> implements Collection<T> {
  constructor(private table: Table<T, string>) {}
  get(id: string) {
    return this.table.get(id);
  }
  async put(item: T) {
    await this.table.put(item);
  }
  async putMany(items: T[]) {
    await this.table.bulkPut(items);
  }
  async delete(id: string) {
    await this.table.delete(id);
  }
  all() {
    return this.table.toArray();
  }
  async clear() {
    await this.table.clear();
  }
}

class DexieKv implements KeyValueStore {
  constructor(private table: Table<KvRow, string>) {}
  async get<T>(key: string) {
    return (await this.table.get(key))?.value as T | undefined;
  }
  async set<T>(key: string, value: T) {
    await this.table.put({ key, value });
  }
  async delete(key: string) {
    await this.table.delete(key);
  }
  async clear() {
    await this.table.clear();
  }
}

export function createDexieStore(db: AppDatabase = new AppDatabase()): DataStore {
  return {
    attempts: new TableCollection(db.attempts),
    units: new TableCollection(db.units),
    srsCards: new TableCollection(db.srsCards),
    writing: new TableCollection(db.writing),
    examResults: new TableCollection(db.examResults),
    explanations: new TableCollection(db.explanations),
    generated: new TableCollection(db.generated),
    flags: new TableCollection(db.flags),
    kv: new DexieKv(db.kv),
  };
}
