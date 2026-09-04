import { describe, it, expect } from 'vitest';
import { mergeProfileImport } from '../src/services/profile/merge';
import { createEmptyProfile, ProfileImport, UserProfile } from '../src/types/profile';

const NOW = '2026-06-06T00:00:00.000Z';

function baseProfile(): UserProfile {
  const p = createEmptyProfile('2026-01-01T00:00:00.000Z');
  p.contact = { name: 'Alex Rivera', email: 'alex@example.com', phone: '' };
  p.skills = [
    { id: 's1', name: 'React', rating: 2 },
    { id: 's2', name: 'TypeScript', rating: 5 },
  ];
  p.education = [
    { id: 'e1', institution: 'UC Berkeley', degreeLevel: 'bachelor', status: 'graduated', graduationYear: 2016 },
  ];
  p.experiences = [
    { id: 'x1', company: 'CloudScale Inc', title: 'Lead Engineer', bullets: ['Architected microservices.'], startDate: '2021-01' },
  ];
  p.certifications = [{ id: 'c1', name: 'CKA' }];
  p.story = { ...p.story, summary: 'Existing summary', drives: ['impact'] };
  return p;
}

const fullImport: ProfileImport = {
  source: 'resume',
  contact: { name: '', email: 'new@example.com', phone: '555-0100', location: 'SF' },
  skills: [
    { name: 'react', rating: 4 },
    { name: 'typescript' },
    { name: 'Go', rating: 5 },
    { name: 'Docker' },
    { name: 'docker', rating: 1 },
  ],
  education: [
    { institution: 'uc berkeley', degreeLevel: 'bachelor', status: 'graduated', degree: 'B.S.', fieldOfStudy: 'CS' },
    { institution: 'Stanford', degreeLevel: 'master', status: 'in_progress', graduationYear: 2027 },
  ],
  experiences: [
    {
      company: 'cloudscale inc',
      title: 'lead engineer',
      bullets: ['Architected microservices.', 'Deployed Kubernetes clusters.'],
      location: 'San Francisco, CA',
      isCurrent: true,
    },
    { company: 'WebTech', title: 'Engineer', bullets: ['Built frontends.'] },
  ],
  certifications: [{ name: 'cka', issuer: 'CNCF' }, { name: 'AWS SA Pro' }],
  story: { summary: 'Imported summary', drives: ['research'], targetRoles: ['Software Engineer'], remotePreference: 'remote' },
};

describe('mergeProfileImport', () => {
  it('is pure: neither the base profile nor the import is mutated', () => {
    const base = baseProfile();
    const snapshotBase = JSON.parse(JSON.stringify(base));
    const snapshotImport = JSON.parse(JSON.stringify(fullImport));
    mergeProfileImport(base, fullImport, NOW);
    expect(base).toEqual(snapshotBase);
    expect(fullImport).toEqual(snapshotImport);
  });

  it('fills contact fields from the import but never clobbers a filled field with an empty one', () => {
    const merged = mergeProfileImport(baseProfile(), fullImport, NOW);
    expect(merged.contact).toEqual({
      name: 'Alex Rivera',
      email: 'new@example.com',
      phone: '555-0100',
      location: 'SF',
    });
  });

  it('dedupes skills case-insensitively, keeping the base display name', () => {
    const merged = mergeProfileImport(baseProfile(), fullImport, NOW);
    expect(merged.skills.map((s) => s.name)).toEqual(['React', 'TypeScript', 'Go', 'Docker']);
    expect(merged.skills.slice(0, 2).map((s) => s.id)).toEqual(['s1', 's2']);
    expect(merged.skills.slice(2).every((s) => s.id.startsWith('skill_'))).toBe(true);
  });

  it('keeps the higher rating when both sides specify one', () => {
    const merged = mergeProfileImport(baseProfile(), fullImport, NOW);
    expect(merged.skills.find((s) => s.name === 'React')?.rating).toBe(4);
    expect(merged.skills.find((s) => s.name === 'Docker')?.rating).toBe(3);
  });

  it('a base rating always wins over an import default, even when lower than 3', () => {
    const base = baseProfile();
    base.skills = [{ id: 's1', name: 'React', rating: 1 }];
    const merged = mergeProfileImport(base, { source: 'linkedin_export', skills: [{ name: 'REACT' }] }, NOW);
    expect(merged.skills).toHaveLength(1);
    expect(merged.skills[0].rating).toBe(1);
  });

  it('an explicit import rating cannot lower a higher base rating', () => {
    const merged = mergeProfileImport(baseProfile(), { source: 'resume', skills: [{ name: 'TypeScript', rating: 2 }] }, NOW);
    expect(merged.skills.find((s) => s.name === 'TypeScript')?.rating).toBe(5);
  });

  it('imported skills without a rating default to 3 and empty names are dropped', () => {
    const merged = mergeProfileImport(createEmptyProfile(), { source: 'resume', skills: [{ name: 'Rust' }, { name: '  ' }] }, NOW);
    expect(merged.skills).toHaveLength(1);
    expect(merged.skills[0]).toMatchObject({ name: 'Rust', rating: 3 });
  });

  it('dedupes education by institution + degree level and fills empty fields', () => {
    const merged = mergeProfileImport(baseProfile(), fullImport, NOW);
    expect(merged.education).toHaveLength(2);
    expect(merged.education[0]).toMatchObject({
      id: 'e1',
      institution: 'UC Berkeley',
      degree: 'B.S.',
      fieldOfStudy: 'CS',
      graduationYear: 2016,
    });
    expect(merged.education[1]).toMatchObject({ institution: 'Stanford', degreeLevel: 'master' });
    expect(merged.education[1].id).toMatch(/^edu_/);
  });

  it('a different degree level at the same school is a separate entry', () => {
    const merged = mergeProfileImport(
      baseProfile(),
      { source: 'resume', education: [{ institution: 'UC Berkeley', degreeLevel: 'master', status: 'graduated' }] },
      NOW
    );
    expect(merged.education).toHaveLength(2);
  });

  it('dedupes experiences by company + title, unions bullets and fills empty fields', () => {
    const merged = mergeProfileImport(baseProfile(), fullImport, NOW);
    expect(merged.experiences).toHaveLength(2);
    const lead = merged.experiences[0];
    expect(lead.id).toBe('x1');
    expect(lead.bullets).toEqual(['Architected microservices.', 'Deployed Kubernetes clusters.']);
    expect(lead.location).toBe('San Francisco, CA');
    expect(lead.isCurrent).toBe(true);
    expect(lead.startDate).toBe('2021-01');
    expect(merged.experiences[1]).toMatchObject({ company: 'WebTech', title: 'Engineer' });
    expect(merged.experiences[1].id).toMatch(/^exp_/);
  });

  it('dedupes certifications by name and fills the issuer', () => {
    const merged = mergeProfileImport(baseProfile(), fullImport, NOW);
    expect(merged.certifications).toHaveLength(2);
    expect(merged.certifications[0]).toMatchObject({ id: 'c1', name: 'CKA', issuer: 'CNCF' });
    expect(merged.certifications[1].id).toMatch(/^cert_/);
  });

  it('only fills story fields that are empty in the base', () => {
    const merged = mergeProfileImport(baseProfile(), fullImport, NOW);
    expect(merged.story.summary).toBe('Existing summary');
    expect(merged.story.drives).toEqual(['impact']);
    expect(merged.story.targetRoles).toEqual(['Software Engineer']);
    expect(merged.story.remotePreference).toBe('remote');
  });

  it('appends a ProfileSource (with resumeId when given) and bumps updatedAt', () => {
    const merged = mergeProfileImport(baseProfile(), fullImport, NOW, 'res_42');
    expect(merged.sources).toEqual([{ kind: 'resume', importedAt: NOW, resumeId: 'res_42' }]);
    expect(merged.updatedAt).toBe(NOW);
    expect(merged.createdAt).toBe('2026-01-01T00:00:00.000Z');

    const again = mergeProfileImport(merged, { source: 'linkedin_page' }, '2026-07-07T00:00:00.000Z');
    expect(again.sources.map((s) => s.kind)).toEqual(['resume', 'linkedin_page']);
    expect(again.sources[1].resumeId).toBeUndefined();
  });

  it('merging the same import twice is idempotent for every entity list', () => {
    const once = mergeProfileImport(baseProfile(), fullImport, NOW);
    const twice = mergeProfileImport(once, fullImport, NOW);
    expect(twice.skills).toEqual(once.skills);
    expect(twice.education).toEqual(once.education);
    expect(twice.experiences).toEqual(once.experiences);
    expect(twice.certifications).toEqual(once.certifications);
    expect(twice.story).toEqual(once.story);
    expect(twice.sources).toHaveLength(2);
  });

  it('merges into an empty profile, assigning ids to every entity', () => {
    const merged = mergeProfileImport(createEmptyProfile(), fullImport, NOW);
    expect(merged.contact.name).toBe('');
    expect(merged.skills).toHaveLength(4);
    expect(merged.education).toHaveLength(2);
    expect(merged.experiences).toHaveLength(2);
    expect(merged.certifications).toHaveLength(2);
    const ids = [
      ...merged.skills.map((s) => s.id),
      ...merged.education.map((e) => e.id),
      ...merged.experiences.map((x) => x.id),
      ...merged.certifications.map((c) => c.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^(skill|edu|exp|cert)_[0-9a-z]+_[0-9a-z]{6}$/.test(id))).toBe(true);
  });
});
