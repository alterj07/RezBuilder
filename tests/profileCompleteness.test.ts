import { describe, it, expect } from 'vitest';
import { checkProfileCompleteness } from '../src/services/profile/completeness';
import { createEmptyProfile, UserProfile } from '../src/types/profile';

function fullProfile(): UserProfile {
  const p = createEmptyProfile('2026-01-01T00:00:00.000Z');
  p.contact = { name: 'Alex Rivera', email: 'alex@example.com' };
  p.education = [{ id: 'e1', institution: 'UC Berkeley', degreeLevel: 'bachelor', status: 'graduated', graduationYear: 2016 }];
  p.skills = ['React', 'TypeScript', 'Node.js', 'Go', 'Docker'].map((name, i) => ({ id: 's' + i, name, rating: 3 as const }));
  p.experiences = [
    { id: 'x1', company: 'CloudScale', title: 'Engineer', bullets: [] },
    { id: 'x2', company: 'Platform', title: 'Senior Engineer', bullets: [] },
  ];
  p.certifications = [{ id: 'c1', name: 'CKA' }];
  p.story = { ...p.story, summary: 'I build things', drives: ['impact'], targetRoles: ['SWE'] };
  return p;
}

describe('checkProfileCompleteness', () => {
  it('treats a null profile as empty with score 0 and every requirement missing', () => {
    const result = checkProfileCompleteness(null);
    expect(result.isComplete).toBe(false);
    expect(result.score).toBe(0);
    expect(result.missing).toHaveLength(4);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(5);
  });

  it('an empty profile is incomplete with all four requirements listed in order', () => {
    const result = checkProfileCompleteness(createEmptyProfile());
    expect(result.isComplete).toBe(false);
    expect(result.score).toBe(0);
    expect(result.missing).toEqual([
      'Add your name',
      'Add at least one education entry with a school and graduating year',
      'Add at least 3 skills',
      'Add at least one experience or project with an organization and title',
    ]);
  });

  it('a fully filled profile is complete with score 100 and no suggestions', () => {
    const result = checkProfileCompleteness(fullProfile());
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
    expect(result.suggestions).toEqual([]);
  });

  it('weights each factor as specified (name 15, education 20, skills 25, experiences 25, summary 10, certs 5)', () => {
    const p = fullProfile();
    p.certifications = [];
    p.story.summary = '';
    expect(checkProfileCompleteness(p).score).toBe(85);
    p.contact.name = '';
    expect(checkProfileCompleteness(p).score).toBe(70);
    p.education = [];
    expect(checkProfileCompleteness(p).score).toBe(50);
  });

  it('scales skills by min(count, 5) / 5 and experiences by min(count, 2) / 2', () => {
    const p = fullProfile();
    p.skills = p.skills.slice(0, 3);
    p.experiences = p.experiences.slice(0, 1);
    // 15 + 20 + 25*(3/5) + 25*(1/2) + 10 + 5 = 77.5 -> 78
    const result = checkProfileCompleteness(p);
    expect(result.score).toBe(78);
    expect(result.isComplete).toBe(true);

    p.skills = [...p.skills, ...Array.from({ length: 10 }, (_, i) => ({ id: 'extra' + i, name: 'Skill ' + i, rating: 2 as const }))];
    expect(checkProfileCompleteness(p).score).toBe(88);
  });

  it('requires at least three named skills and reports the current count', () => {
    const p = fullProfile();
    p.skills = [
      { id: 's1', name: 'React', rating: 3 },
      { id: 's2', name: '   ', rating: 3 },
      { id: 's3', name: 'Go', rating: 3 },
    ];
    const result = checkProfileCompleteness(p);
    expect(result.isComplete).toBe(false);
    expect(result.missing).toEqual(['Add at least 3 skills (you have 2)']);
  });

  it('education needs both an institution and a graduating year', () => {
    const p = fullProfile();
    p.education = [{ id: 'e1', institution: 'UC Berkeley', degreeLevel: 'bachelor', status: 'in_progress' }];
    expect(checkProfileCompleteness(p).isComplete).toBe(false);
    p.education = [{ id: 'e1', institution: '', degreeLevel: 'bachelor', status: 'in_progress', graduationYear: 2027 }];
    expect(checkProfileCompleteness(p).isComplete).toBe(false);
    p.education = [{ id: 'e1', institution: 'UC Berkeley', degreeLevel: 'bachelor', status: 'in_progress', graduationYear: 2027 }];
    expect(checkProfileCompleteness(p).isComplete).toBe(true);
  });

  it('a project counts as an experience, but an experience needs both company and title', () => {
    const p = fullProfile();
    p.experiences = [{ id: 'x1', company: 'Distributed KV Store', title: 'Project', type: 'project', bullets: [] }];
    expect(checkProfileCompleteness(p).isComplete).toBe(true);
    p.experiences = [{ id: 'x1', company: 'CloudScale', title: '', bullets: [] }];
    const result = checkProfileCompleteness(p);
    expect(result.isComplete).toBe(false);
    expect(result.missing).toEqual(['Add at least one experience or project with an organization and title']);
  });

  it('lists optional gaps as suggestions in display order without affecting isComplete', () => {
    const p = fullProfile();
    p.story = { ...p.story, summary: '', drives: [], targetRoles: [] };
    p.certifications = [];
    p.contact.email = '';
    const result = checkProfileCompleteness(p);
    expect(result.isComplete).toBe(true);
    expect(result.suggestions).toEqual([
      'Write a short summary about yourself',
      'Add what drives you (e.g. impact, mentorship, fast-paced teams)',
      'Add the roles you are targeting',
      'Add certifications, if you have any',
      'Add an email address so applications can be auto-filled',
    ]);
  });
});
