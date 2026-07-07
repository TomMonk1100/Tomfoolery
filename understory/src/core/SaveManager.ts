/**
 * SaveManager — persists MetaSave to localStorage under a single key.
 * No Phaser dependency. Falls back to an in-memory object if localStorage
 * is unavailable (private browsing, disabled storage, etc.) so callers
 * never need to know the difference.
 */
import {
  CodexState,
  META_SAVE_VERSION,
  MetaSave,
  QualityPref,
  defaultMeta,
} from "./types";

const STORAGE_KEY = "understory:meta:v1";

/** Narrow shape check — verifies only the v1 core fields, so that pre-
 * Update-3 saves (no version/codex/quality) still validate and get migrated. */
function isValidMetaSave(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sunseeds === "number" &&
    typeof v.keepsakes === "object" &&
    v.keepsakes !== null &&
    Array.isArray(v.unlockedNodes)
  );
}

function isValidCodex(value: unknown): value is CodexState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.evolutions) &&
    Array.isArray(v.fusions) &&
    Array.isArray(v.synergies)
  );
}

/**
 * Update 3 migration: upgrades any older valid save to META_SAVE_VERSION by
 * filling missing fields with defaults. Returns null if `parsed` isn't a
 * MetaSave shape at all (caller falls back to defaultMeta()).
 */
export function migrateMeta(parsed: unknown): MetaSave | null {
  if (!isValidMetaSave(parsed)) return null;
  const v = parsed as MetaSave & Record<string, unknown>;
  return {
    version: META_SAVE_VERSION,
    sunseeds: v.sunseeds,
    keepsakes: v.keepsakes,
    unlockedNodes: v.unlockedNodes,
    codex: isValidCodex(v.codex)
      ? v.codex
      : { evolutions: [], fusions: [], synergies: [] },
    quality:
      v.quality === "auto" || v.quality === "high" || v.quality === "low"
        ? (v.quality as QualityPref)
        : "auto",
  };
}

export class SaveManager {
  /** In-memory fallback used when localStorage throws or is unavailable. */
  private memoryStore: string | null = null;
  private readonly storageAvailable: boolean;

  constructor() {
    this.storageAvailable = SaveManager.detectStorage();
  }

  private static detectStorage(): boolean {
    try {
      const testKey = "understory:__storage_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private readRaw(): string | null {
    if (this.storageAvailable) {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return this.memoryStore;
      }
    }
    return this.memoryStore;
  }

  private writeRaw(raw: string): void {
    if (this.storageAvailable) {
      try {
        window.localStorage.setItem(STORAGE_KEY, raw);
        return;
      } catch {
        // Fall through to in-memory fallback if a quota/security error
        // occurs after construction (e.g., storage revoked mid-session).
      }
    }
    this.memoryStore = raw;
  }

  load(): MetaSave {
    const raw = this.readRaw();
    if (!raw) return defaultMeta();

    try {
      const migrated = migrateMeta(JSON.parse(raw));
      return migrated ?? defaultMeta();
    } catch {
      return defaultMeta();
    }
  }

  save(meta: MetaSave): void {
    try {
      this.writeRaw(JSON.stringify(meta));
    } catch {
      // JSON.stringify should not throw for MetaSave's plain-data shape,
      // but never let a save attempt crash the caller.
    }
  }

  addSunseeds(n: number): void {
    const meta = this.load();
    meta.sunseeds = Math.max(0, meta.sunseeds + n);
    this.save(meta);
  }

  addKeepsake(type: string, n: number): void {
    const meta = this.load();
    meta.keepsakes[type] = Math.max(0, (meta.keepsakes[type] ?? 0) + n);
    this.save(meta);
  }

  unlockNode(id: string): void {
    const meta = this.load();
    if (!meta.unlockedNodes.includes(id)) {
      meta.unlockedNodes.push(id);
      this.save(meta);
    }
  }

  isUnlocked(id: string): boolean {
    return this.load().unlockedNodes.includes(id);
  }
}
