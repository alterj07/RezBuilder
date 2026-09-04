import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupMockChrome, SetupMockChromeResult } from './helpers/mockChrome';
import { profileStorage, PROFILE_STORAGE_KEY } from '../src/services/storage/profileStorage';
import { createEmptyProfile, ProfileImport, UserProfile } from '../src/types/profile';

function completeProfile(): UserProfile {
  const p = createEmptyProfile('2026-01-01T00:00:00.000Z');
  p.contact = { name: 'Alex Rivera', email: 'alex@example.com' };
  p.education = [
    { id: 'edu_1', institution: 'UC Berkeley', degreeLevel: 'bachelor', status: 'graduated', graduationYear: 2016 },
  ];
  p.skills = [
    { id: 's1', name: 'React', rating: 4 },
    { id: 's2', name: 'TypeScript', rating: 4 },
    { id: 's3', name: 'Node.js', rating: 3 },
  ];
  p.experiences = [{ id: 'x1', company: 'CloudScale', title: 'Engineer', bullets: ['Built things'] }];
  return p;
}

describe('profileStorage', () => {
  let harness: SetupMockChromeResult;

  beforeEach(async () => {
    harness = setupMockChrome();
    await profileStorage.clearProfile();
  });

  afterEach(() => {
    harness.resetStore();
  });

  it('returns null when nothing has been saved', async () => {
    expect(await profileStorage.getProfile()).toBeNull();
  });

  it('persists under the rezbuilder_profile key in chrome.storage.local', async () => {
    const saved = await profileStorage.saveProfile(createEmptyProfile('2026-01-01T00:00:00.000Z'));
    expect(PROFILE_STORAGE_KEY).toBe('rezbuilder_profile');
    expect(harness.store.local[PROFILE_STORAGE_KEY]).toEqual(saved);
    expect(await profileStorage.getProfile()).toEqual(saved);
  });

  it('saveProfile bumps updatedAt and leaves completedAt null while incomplete', async () => {
    const saved = await profileStorage.saveProfile(createEmptyProfile('2026-01-01T00:00:00.000Z'), '2026-02-02T00:00:00.000Z');
    expect(saved.updatedAt).toBe('2026-02-02T00:00:00.000Z');
    expect(saved.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(saved.completedAt).toBeNull();
  });

  it('saveProfile stamps completedAt on first completion and never re-stamps it', async () => {
    const first = await profileStorage.saveProfile(completeProfile(), '2026-03-03T00:00:00.000Z');
    expect(first.completedAt).toBe('2026-03-03T00:00:00.000Z');

    const second = await profileStorage.saveProfile(first, '2026-04-04T00:00:00.000Z');
    expect(second.completedAt).toBe('2026-03-03T00:00:00.000Z');
    expect(second.updatedAt).toBe('2026-04-04T00:00:00.000Z');
  });

  it('updateProfile creates an empty profile when none exists', async () => {
    const updated = await profileStorage.updateProfile({ contact: { name: 'Cher' } });
    expect(updated.contact.name).toBe('Cher');
    expect(updated.version).toBe(1);
    expect(updated.id).toMatch(/^profile_/);
    expect(updated.skills).toEqual([]);
    expect(await profileStorage.getProfile()).toEqual(updated);
  });

  it('updateProfile shallow-merges and keeps identity fields', async () => {
    const original = await profileStorage.saveProfile(completeProfile());
    const updated = await profileStorage.updateProfile({
      id: 'hijacked',
      createdAt: '1999-01-01T00:00:00.000Z',
      story: { ...original.story, summary: 'Hello' },
    });
    expect(updated.id).toBe(original.id);
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.story.summary).toBe('Hello');
    expect(updated.contact.name).toBe('Alex Rivera');
  });

  it('mergeImport creates a profile, records the source and persists the merge', async () => {
    const imp: ProfileImport = {
      source: 'resume',
      contact: { name: 'Alex Rivera' },
      skills: [{ name: 'React' }, { name: 'Go', rating: 5 }],
    };
    const merged = await profileStorage.mergeImport(imp, { resumeId: 'res_1', now: '2026-05-05T00:00:00.000Z' });
    expect(merged.contact.name).toBe('Alex Rivera');
    expect(merged.skills.map((s) => [s.name, s.rating])).toEqual([
      ['React', 3],
      ['Go', 5],
    ]);
    expect(merged.sources).toEqual([{ kind: 'resume', importedAt: '2026-05-05T00:00:00.000Z', resumeId: 'res_1' }]);
    expect(merged.updatedAt).toBe('2026-05-05T00:00:00.000Z');
    expect(await profileStorage.getProfile()).toEqual(merged);
  });

  it('mergeImport into an existing profile keeps the stored data and appends the source', async () => {
    await profileStorage.saveProfile(completeProfile());
    const merged = await profileStorage.mergeImport({ source: 'linkedin_export', skills: [{ name: 'react', rating: 2 }] });
    expect(merged.contact.name).toBe('Alex Rivera');
    expect(merged.skills.find((s) => s.name === 'React')?.rating).toBe(4);
    expect(merged.sources.map((s) => s.kind)).toEqual(['linkedin_export']);
    expect(merged.completedAt).toBeTruthy();
  });

  it('clearProfile removes the stored profile', async () => {
    await profileStorage.saveProfile(completeProfile());
    await profileStorage.clearProfile();
    expect(await profileStorage.getProfile()).toBeNull();
  });

  it('falls back to in-memory storage when chrome is unavailable', async () => {
    delete (globalThis as any).chrome;
    await profileStorage.clearProfile();
    expect(await profileStorage.getProfile()).toBeNull();
    const saved = await profileStorage.saveProfile(completeProfile());
    expect(await profileStorage.getProfile()).toEqual(saved);
  });
});
