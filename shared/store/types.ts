import type {
  AttemptRecord,
  ExamRecord,
  ExplanationRecord,
  FlagRecord,
  GeneratedRecord,
  SrsCardRecord,
  UnitRecord,
  WritingRecord,
} from "../schemas/store.js";

export interface Collection<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<void>;
  putMany(items: T[]): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<T[]>;
  clear(): Promise<void>;
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Everything the app saves. Implemented by an in-memory store (tests) and, in step 3,
 * by IndexedDB (Dexie). The API key is NOT part of this store: it has its own encrypted storage.
 */
export interface DataStore {
  attempts: Collection<AttemptRecord>;
  /** id = unit id */
  units: Collection<UnitRecord>;
  srsCards: Collection<SrsCardRecord>;
  writing: Collection<WritingRecord>;
  examResults: Collection<ExamRecord>;
  explanations: Collection<ExplanationRecord>;
  generated: Collection<GeneratedRecord>;
  flags: Collection<FlagRecord>;
  kv: KeyValueStore;
}
