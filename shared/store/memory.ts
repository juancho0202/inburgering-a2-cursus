import type { Collection, DataStore, KeyValueStore } from "./types.js";

const copy = <T>(v: T): T => structuredClone(v);

class MemoryCollection<T extends { id: string }> implements Collection<T> {
  private items = new Map<string, T>();
  // Values are copied on the way in and out, like IndexedDB does, so callers cannot change stored data by accident.
  async get(id: string) {
    const v = this.items.get(id);
    return v === undefined ? undefined : copy(v);
  }
  async put(item: T) {
    this.items.set(item.id, copy(item));
  }
  async putMany(items: T[]) {
    for (const i of items) this.items.set(i.id, copy(i));
  }
  async delete(id: string) {
    this.items.delete(id);
  }
  async all() {
    return [...this.items.values()].map(copy);
  }
  async clear() {
    this.items.clear();
  }
}

class MemoryKv implements KeyValueStore {
  private map = new Map<string, unknown>();
  async get<T>(key: string) {
    const v = this.map.get(key);
    return v === undefined ? undefined : (copy(v) as T);
  }
  async set<T>(key: string, value: T) {
    this.map.set(key, copy(value));
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async clear() {
    this.map.clear();
  }
}

export function createMemoryStore(): DataStore {
  return {
    attempts: new MemoryCollection(),
    units: new MemoryCollection(),
    srsCards: new MemoryCollection(),
    writing: new MemoryCollection(),
    examResults: new MemoryCollection(),
    explanations: new MemoryCollection(),
    generated: new MemoryCollection(),
    flags: new MemoryCollection(),
    kv: new MemoryKv(),
  };
}
