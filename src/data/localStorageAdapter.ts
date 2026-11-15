import {
  ALL_ENTITY_KEYS,
  CURRENT_SCHEMA_VERSION,
  EduflowBackupPayload,
  EduflowMetaMap,
  EntityCollectionsMap,
  EntityKey,
  StorageAdapter,
  createInitialCollections,
  createInitialMeta,
  migrateSnapshot,
} from './storageAdapter';
import { DEFAULT_CENTER_ID } from './seedData';

export const STORAGE_PREFIX = 'eduflow:v1:';
const SCHEMA_VERSION_KEY = `${STORAGE_PREFIX}schemaVersion`;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorageFallback implements StorageLike {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  private storage: StorageLike;
  private cacheCollections: EntityCollectionsMap;
  private cacheMeta: EduflowMetaMap;
  private dirtyKeys = new Map<string, string>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;
  private listeners = new Set<() => void>();
  private onError: ((message: string) => void) | null = null;
  private boundStorageListener: ((e: StorageEvent) => void) | null = null;
  private boundUnloadListener: (() => void) | null = null;

  constructor(options?: { storage?: StorageLike; debounceMs?: number }) {
    this.debounceMs = options?.debounceMs ?? 60;
    this.storage =
      options?.storage ??
      (typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : new MemoryStorageFallback());

    this.cacheCollections = createInitialCollections();
    this.cacheMeta = createInitialMeta();
    this.hydrateAndMigrate();
    this.attachWindowListeners();
  }

  private keyForEntity(entity: EntityKey): string {
    return `${STORAGE_PREFIX}${entity}`;
  }

  private keyForMeta(metaKey: keyof EduflowMetaMap): string {
    return `${STORAGE_PREFIX}meta:${metaKey}`;
  }

  private safeReadJson<T>(fullKey: string): T | null {
    try {
      const raw = this.storage.getItem(fullKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private hydrateAndMigrate(): void {
    const storedVersionRaw = this.storage.getItem(SCHEMA_VERSION_KEY);
    const storedVersion = storedVersionRaw ? Number(storedVersionRaw) || 0 : 0;

    const rawCollections: Partial<EntityCollectionsMap> = {};
    let hasAnyPersisted = false;

    for (const key of ALL_ENTITY_KEYS) {
      const parsed = this.safeReadJson<EntityCollectionsMap[typeof key]>(this.keyForEntity(key));
      if (parsed !== null) {
        (rawCollections as Record<string, unknown>)[key] = parsed;
        hasAnyPersisted = true;
      }
    }

    const rawMeta: Partial<EduflowMetaMap> = {};
    const stages = this.safeReadJson<EduflowMetaMap['stages']>(this.keyForMeta('stages'));
    const templates = this.safeReadJson<EduflowMetaMap['templates']>(this.keyForMeta('templates'));
    const centerSettings = this.safeReadJson<EduflowMetaMap['centerSettings']>(
      this.keyForMeta('centerSettings')
    );
    if (stages) {
      rawMeta.stages = stages;
      hasAnyPersisted = true;
    }
    if (templates) {
      rawMeta.templates = templates;
      hasAnyPersisted = true;
    }
    if (centerSettings) {
      rawMeta.centerSettings = centerSettings;
      hasAnyPersisted = true;
    }

    const migrated = migrateSnapshot(
      rawCollections,
      rawMeta,
      hasAnyPersisted ? storedVersion : CURRENT_SCHEMA_VERSION
    );

    this.cacheCollections = migrated.collections;
    this.cacheMeta = migrated.meta;

    // Persist initial seed or migrated schema version cleanly
    if (!hasAnyPersisted || storedVersion < CURRENT_SCHEMA_VERSION) {
      for (const key of ALL_ENTITY_KEYS) {
        this.writeImmediate(
          this.keyForEntity(key),
          JSON.stringify(this.cacheCollections[key])
        );
      }
      this.writeImmediate(this.keyForMeta('stages'), JSON.stringify(this.cacheMeta.stages));
      this.writeImmediate(this.keyForMeta('templates'), JSON.stringify(this.cacheMeta.templates));
      this.writeImmediate(
        this.keyForMeta('centerSettings'),
        JSON.stringify(this.cacheMeta.centerSettings)
      );
      this.writeImmediate(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
    }
  }

  private attachWindowListeners(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    this.boundStorageListener = (event: StorageEvent) => {
      if (!event.key || !event.key.startsWith(STORAGE_PREFIX)) return;
      this.hydrateAndMigrate();
      this.notifyListeners();
    };
    window.addEventListener('storage', this.boundStorageListener);

    this.boundUnloadListener = () => {
      this.flush();
    };
    window.addEventListener('beforeunload', this.boundUnloadListener);
    window.addEventListener('pagehide', this.boundUnloadListener);
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      if (this.boundStorageListener) {
        window.removeEventListener('storage', this.boundStorageListener);
      }
      if (this.boundUnloadListener) {
        window.removeEventListener('beforeunload', this.boundUnloadListener);
        window.removeEventListener('pagehide', this.boundUnloadListener);
      }
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb());
  }

  private handleStorageError(err: unknown): void {
    const isQuota =
      err instanceof Error &&
      (err.name === 'QuotaExceededError' ||
        err.message.toLowerCase().includes('quota') ||
        err.message.toLowerCase().includes('storage'));
    const msg = isQuota
      ? 'تعذر الحفظ: مساحة التخزين المحلي بالمتصفح ممتلئة. صدّر نسخة احتياطية JSON ثم نظّف البيانات.'
      : 'حدث خطأ أثناء حفظ البيانات محلياً في المتصفح.';
    if (this.onError) {
      this.onError(msg);
    }
  }

  private writeImmediate(fullKey: string, serialized: string): void {
    try {
      this.storage.setItem(fullKey, serialized);
    } catch (err) {
      this.handleStorageError(err);
    }
  }

  private scheduleWrite(fullKey: string, serialized: string): void {
    this.dirtyKeys.set(fullKey, serialized);
    if (this.debounceMs <= 0) {
      this.flush();
      return;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  public flush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.dirtyKeys.size === 0) return;
    const entries = Array.from(this.dirtyKeys.entries());
    this.dirtyKeys.clear();
    for (const [k, v] of entries) {
      this.writeImmediate(k, v);
    }
  }

  public getCollection<K extends EntityKey>(key: K): EntityCollectionsMap[K] {
    return this.cacheCollections[key];
  }

  public setCollection<K extends EntityKey>(key: K, items: EntityCollectionsMap[K]): void {
    this.cacheCollections[key] = items;
    this.scheduleWrite(this.keyForEntity(key), JSON.stringify(items));
    this.notifyListeners();
  }

  public getMeta<K extends keyof EduflowMetaMap>(key: K): EduflowMetaMap[K] {
    return this.cacheMeta[key];
  }

  public setMeta<K extends keyof EduflowMetaMap>(key: K, value: EduflowMetaMap[K]): void {
    this.cacheMeta[key] = value;
    this.scheduleWrite(this.keyForMeta(key), JSON.stringify(value));
    this.notifyListeners();
  }

  public getRawValue<T>(key: string, fallback: T): T {
    const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    const parsed = this.safeReadJson<T>(fullKey);
    return parsed === null ? fallback : parsed;
  }

  public setRawValue<T>(key: string, value: T, immediate = false): void {
    const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    const serialized = JSON.stringify(value);
    if (immediate) {
      this.writeImmediate(fullKey, serialized);
      this.notifyListeners();
    } else {
      this.scheduleWrite(fullKey, serialized);
      this.notifyListeners();
    }
  }

  public removeRawValue(key: string): void {
    const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    this.dirtyKeys.delete(fullKey);
    try {
      this.storage.removeItem(fullKey);
    } catch (err) {
      this.handleStorageError(err);
    }
    this.notifyListeners();
  }

  public exportBackup(): EduflowBackupPayload {
    this.flush();
    return {
      app: 'EDUFLOW',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      centerId: this.cacheCollections.centers[0]?.id || DEFAULT_CENTER_ID,
      collections: JSON.parse(JSON.stringify(this.cacheCollections)) as EntityCollectionsMap,
      meta: JSON.parse(JSON.stringify(this.cacheMeta)) as EduflowMetaMap,
    };
  }

  public validateBackup(payload: unknown): {
    valid: boolean;
    error?: string;
    summary?: {
      students: number;
      teachers: number;
      groups: number;
      invoices: number;
      payments: number;
    };
    parsed?: EduflowBackupPayload;
  } {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'الملف المرفوع لا يحتوي على بنية JSON صالحة.' };
    }
    const obj = payload as Record<string, unknown>;
    if (obj.app !== 'EDUFLOW' || !obj.collections || typeof obj.collections !== 'object') {
      return {
        valid: false,
        error: 'ملف النسخة الاحتياطية غير متوافق مع تنسيق EDUFLOW.',
      };
    }
    const cols = obj.collections as Partial<EntityCollectionsMap>;
    if (
      !Array.isArray(cols.students) ||
      !Array.isArray(cols.teachers) ||
      !Array.isArray(cols.groups) ||
      !Array.isArray(cols.invoices) ||
      !Array.isArray(cols.payments)
    ) {
      return {
        valid: false,
        error: 'بيانات النسخة الاحتياطية ناقصة أو تالفة (جداول أساسية مفقودة).',
      };
    }
    const schemaVer = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0;
    const migrated = migrateSnapshot(
      cols,
      (obj.meta as Partial<EduflowMetaMap>) || {},
      schemaVer
    );
    const parsed: EduflowBackupPayload = {
      app: 'EDUFLOW',
      schemaVersion: migrated.schemaVersion,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      centerId: typeof obj.centerId === 'string' ? obj.centerId : DEFAULT_CENTER_ID,
      collections: migrated.collections,
      meta: migrated.meta,
    };
    return {
      valid: true,
      parsed,
      summary: {
        students: parsed.collections.students.length,
        teachers: parsed.collections.teachers.length,
        groups: parsed.collections.groups.length,
        invoices: parsed.collections.invoices.length,
        payments: parsed.collections.payments.length,
      },
    };
  }

  public importBackup(payload: unknown): EduflowBackupPayload {
    const check = this.validateBackup(payload);
    if (!check.valid || !check.parsed) {
      throw new Error(check.error || 'ملف النسخة الاحتياطية غير صالح.');
    }
    this.cacheCollections = check.parsed.collections;
    this.cacheMeta = check.parsed.meta;

    for (const key of ALL_ENTITY_KEYS) {
      this.writeImmediate(this.keyForEntity(key), JSON.stringify(this.cacheCollections[key]));
    }
    this.writeImmediate(this.keyForMeta('stages'), JSON.stringify(this.cacheMeta.stages));
    this.writeImmediate(this.keyForMeta('templates'), JSON.stringify(this.cacheMeta.templates));
    this.writeImmediate(
      this.keyForMeta('centerSettings'),
      JSON.stringify(this.cacheMeta.centerSettings)
    );
    this.writeImmediate(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));

    this.notifyListeners();
    return check.parsed;
  }

  public resetToSeed(): void {
    this.dirtyKeys.clear();
    this.cacheCollections = createInitialCollections();
    this.cacheMeta = createInitialMeta();

    for (const key of ALL_ENTITY_KEYS) {
      this.writeImmediate(this.keyForEntity(key), JSON.stringify(this.cacheCollections[key]));
    }
    this.writeImmediate(this.keyForMeta('stages'), JSON.stringify(this.cacheMeta.stages));
    this.writeImmediate(this.keyForMeta('templates'), JSON.stringify(this.cacheMeta.templates));
    this.writeImmediate(
      this.keyForMeta('centerSettings'),
      JSON.stringify(this.cacheMeta.centerSettings)
    );
    this.writeImmediate(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));

    this.notifyListeners();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setErrorHandler(handler: ((message: string) => void) | null): void {
    this.onError = handler;
  }
}
