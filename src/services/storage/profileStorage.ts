import { ProfileImport, UserProfile, createEmptyProfile } from '../../types/profile';
import { checkProfileCompleteness } from '../profile/completeness';
import { mergeProfileImport } from '../profile/merge';

export const PROFILE_STORAGE_KEY = 'rezbuilder_profile';

// In-memory fallback for test and non-extension environments
let memoryStore: Record<string, any> = {};

async function storageGet<T>(key: string, defaultValue: T): Promise<T> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch {
      return memoryStore[key] !== undefined ? memoryStore[key] : defaultValue;
    }
  }
  return memoryStore[key] !== undefined ? memoryStore[key] : defaultValue;
}

async function storageSet(key: string, value: any): Promise<void> {
  memoryStore[key] = value;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch {
      // Handled via memoryStore
    }
  }
}

export interface MergeImportOptions {
  /** Recorded on the `ProfileSource` when the import came from a stored resume. */
  resumeId?: string;
  /** ISO timestamp override, mainly for tests. */
  now?: string;
}

/**
 * Persists the single Candidate Profile under `rezbuilder_profile`
 * (chrome.storage.local with an in-memory fallback).
 */
export class ProfileStorageService {
  async getProfile(): Promise<UserProfile | null> {
    const stored = await storageGet<UserProfile | null>(PROFILE_STORAGE_KEY, null);
    return stored && typeof stored === 'object' ? stored : null;
  }

  /**
   * Saves the profile, bumping `updatedAt` and stamping `completedAt` the first
   * time it passes the completeness gate. Returns the persisted copy.
   */
  async saveProfile(profile: UserProfile, now: string = new Date().toISOString()): Promise<UserProfile> {
    const toSave: UserProfile = { ...profile, updatedAt: now };
    if (!toSave.completedAt && checkProfileCompleteness(toSave).isComplete) {
      toSave.completedAt = now;
    } else if (toSave.completedAt === undefined) {
      toSave.completedAt = null;
    }
    await storageSet(PROFILE_STORAGE_KEY, toSave);
    return toSave;
  }

  /** Shallow-merges `partial` into the stored profile, creating an empty one if needed. */
  async updateProfile(partial: Partial<UserProfile>): Promise<UserProfile> {
    const existing = (await this.getProfile()) ?? createEmptyProfile();
    // Identity fields are owned by the stored profile and never patched.
    return this.saveProfile({
      ...existing,
      ...partial,
      version: 1,
      id: existing.id,
      createdAt: existing.createdAt,
    });
  }

  /** Merges an importer's result into the stored profile (creating one if needed) and saves it. */
  async mergeImport(imp: ProfileImport, options: MergeImportOptions = {}): Promise<UserProfile> {
    const now = options.now ?? new Date().toISOString();
    const base = (await this.getProfile()) ?? createEmptyProfile(now);
    const merged = mergeProfileImport(base, imp, now, options.resumeId);
    return this.saveProfile(merged, now);
  }

  async clearProfile(): Promise<void> {
    await storageSet(PROFILE_STORAGE_KEY, null);
  }
}

export const profileStorage = new ProfileStorageService();
