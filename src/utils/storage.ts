import type { AppPreferences } from '../types/config';
import type { PortfolioSnapshot } from '../types/portfolio';
import type { TrackedWallet } from '../types/wallet';

const WALLETS_STORAGE_KEY = 'meridian.tracked_wallets.v1';
const PREFS_STORAGE_KEY = 'meridian.preferences.v1';
const SNAPSHOT_FALLBACK_KEY = 'meridian.snapshots.v1';

const DB_NAME = 'meridian_portfolio_db';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';

const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'dark',
  dustThresholdUsd: 0.01,
  customBaseTokens: [],
};

export function loadTrackedWallets(): TrackedWallet[] {
  try {
    const raw = localStorage.getItem(WALLETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrackedWallets(wallets: TrackedWallet[]): void {
  try {
    localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(wallets));
  } catch {
    // ignore storage quota errors
  }
}

export function loadPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      theme: parsed?.theme === 'light' ? 'light' : 'dark',
      dustThresholdUsd:
        typeof parsed?.dustThresholdUsd === 'number' && parsed.dustThresholdUsd >= 0.01
          ? parsed.dustThresholdUsd
          : 0.01,
      customBaseTokens: Array.isArray(parsed?.customBaseTokens)
        ? parsed.customBaseTokens.filter((x: unknown) => typeof x === 'string')
        : [],
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: AppPreferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function openSnapshotDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const store = db.createObjectStore(SNAPSHOT_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('walletSignature', 'walletSignature', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  try {
    const db = await openSnapshotDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      store.add(snapshot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback to localStorage if IndexedDB is blocked
    try {
      const existing = JSON.parse(localStorage.getItem(SNAPSHOT_FALLBACK_KEY) || '[]');
      const next = Array.isArray(existing) ? [...existing, snapshot].slice(-250) : [snapshot];
      localStorage.setItem(SNAPSHOT_FALLBACK_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
}

export async function loadPortfolioSnapshots(walletSignature: string): Promise<PortfolioSnapshot[]> {
  try {
    const db = await openSnapshotDb();
    const items = await new Promise<PortfolioSnapshot[]>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const index = store.index('walletSignature');
      const req = index.getAll(IDBKeyRange.only(walletSignature));
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    try {
      const existing = JSON.parse(localStorage.getItem(SNAPSHOT_FALLBACK_KEY) || '[]');
      if (!Array.isArray(existing)) return [];
      return existing
        .filter((s: PortfolioSnapshot) => s.walletSignature === walletSignature)
        .sort((a: PortfolioSnapshot, b: PortfolioSnapshot) => a.timestamp - b.timestamp);
    } catch {
      return [];
    }
  }
}

export async function clearPortfolioSnapshots(): Promise<void> {
  try {
    const db = await openSnapshotDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      tx.objectStore(SNAPSHOT_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(SNAPSHOT_FALLBACK_KEY);
  } catch {
    // ignore
  }
}
