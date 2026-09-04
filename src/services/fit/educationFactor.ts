import { DegreeLevel } from '../../types/profile';
import { DEGREE_LABEL, DEGREE_RANK, degreeLevelForRank, highestDegreeRank } from './profileSignals';
import { FactorContext, FactorOutcome, clamp, weightedAverage } from './common';

interface FieldGroup {
  id: string;
  label: string;
  pattern: RegExp;
}

const FIELD_GROUPS: FieldGroup[] = [
  { id: 'cs', label: 'Computer Science', pattern: /\bcomputer\s+science\b|\bcomp\s*sci\b|\bcs\b|\bsoftware\s+engineering\b|\bcomputer\s+engineering\b|\binformatics\b|\binformation\s+(?:technology|systems|science)\b|\bcomputing\b|\bcomputer\s+programming\b/i },
  { id: 'data', label: 'Data / Math / Statistics', pattern: /\bdata\s+science\b|\bstatistics\b|\bmathematics\b|\bmath\b|\bapplied\s+math|\banalytics\b|\bactuarial\b|\bmachine\s+learning\b|\bartificial\s+intelligence\b/i },
  { id: 'ee', label: 'Electrical Engineering', pattern: /\belectrical\s+engineering\b|\bcomputer\s+engineering\b|\belectronics\b|\bece\b/i },
  { id: 'engineering', label: 'Engineering', pattern: /\bengineering\b/i },
  { id: 'business', label: 'Business / Finance', pattern: /\bbusiness\b|\bfinance\b|\beconomics\b|\baccounting\b|\bmarketing\b|\bmba\b|\bcommerce\b/i },
  { id: 'design', label: 'Design / HCI', pattern: /\bdesign\b|\bhci\b|\bhuman[- ]computer\b|\bfine\s+arts?\b/i },
  { id: 'science', label: 'Science', pattern: /\bphysics\b|\bchemistry\b|\bbiology\b|\bneuroscience\b|\bstem\b|\bquantitative\b|\bscientific\b|\bnatural\s+sciences?\b/i },
];

const TECHNICAL_FIELDS = new Set(['cs', 'data', 'ee', 'engineering', 'science']);
const RELATED_FIELD_RE = /\brelated\s+(?:technical\s+)?(?:field|discipline|area|major)|\bsimilar\s+(?:field|discipline)|\bstem\b|\bquantitative\s+(?:field|discipline)|\btechnical\s+(?:field|discipline)|\bor\s+equivalent|\bany\s+(?:field|major|discipline)/i;
const DEGREE_CONTEXT_RE = /\bdegree|\bbachelor|\bmaster|\bph\.?d|\bdoctor|\bundergraduate|\bgraduate\b|\bmajor(?:ing)?\b|\bfield\s+of\s+study|\bstudying\b|\bstudents?\b|\b(?:BS|BA|MS)\b|\bcoursework\b/i;

function fieldsIn(text: string): string[] {
  if (!text) return [];
  return FIELD_GROUPS.filter((g) => g.pattern.test(text)).map((g) => g.id);
}

function fieldLabel(id: string): string {
  return FIELD_GROUPS.find((g) => g.id === id)?.label || id;
}

function degreeContextText(job: FactorContext['job']): string {
  const text = [job.title || '', job.description || '', ...(job.qualifications || [])].join('\n');
  return text
    .split(/\r?\n+|(?<=[.!?;:])\s+|\s*[•·●▪‣◦∙]\s*/)
    .filter((s) => DEGREE_CONTEXT_RE.test(s))
    .join('\n');
}

/**
 * Degree level vs minimum (40%), field of study vs job (25%) and graduation
 * window fit for student-level postings (35%). Not applicable when the posting
 * gives no degree / field / graduation signal.
 */
export function scoreEducation(ctx: FactorContext): FactorOutcome {
  const { job, profile, reqs } = ctx;
  const degreeText = degreeContextText(job);
  const jobFields = fieldsIn(degreeText);
  const relatedOk = RELATED_FIELD_RE.test(degreeText);
  const applicable = reqs.minDegree !== undefined || reqs.graduationWindow !== undefined || jobFields.length > 0;
  if (!applicable) return { score: 0, applicable: false, evidence: [], gaps: [] };

  const evidence: string[] = [];
  const gaps: string[] = [];
  const studentLevel = reqs.roleLevel === 'internship' || reqs.roleLevel === 'new_grad';
  const education = profile.education || [];

  // 1. Degree level
  let degreeScore: number | undefined;
  if (reqs.minDegree) {
    const minRank = DEGREE_RANK[reqs.minDegree];
    const minLabel = DEGREE_LABEL[reqs.minDegree];
    const attainedRank = highestDegreeRank(profile, studentLevel);
    const anyRank = highestDegreeRank(profile, true);
    if (education.length === 0) {
      degreeScore = 0;
      gaps.push('Add your education');
    } else if (attainedRank >= minRank) {
      degreeScore = 100;
      const have = degreeLevelForRank(attainedRank) as DegreeLevel | undefined;
      evidence.push(`Your ${have ? DEGREE_LABEL[have] : 'degree'} meets the ${minLabel} requirement`);
    } else if (anyRank >= minRank) {
      degreeScore = 60;
      gaps.push(`Posting asks for a ${minLabel}; yours is still in progress`);
    } else {
      const diff = minRank - Math.max(attainedRank, anyRank);
      degreeScore = diff <= 1 ? 50 : 15;
      const have = degreeLevelForRank(Math.max(attainedRank, anyRank)) as DegreeLevel | undefined;
      gaps.push(`Posting asks for a ${minLabel}; your highest is ${have ? DEGREE_LABEL[have] : 'not listed'}`);
    }
    if (!reqs.degreeRequired) degreeScore = Math.max(degreeScore, 60);
  }

  // 2. Field of study
  let fieldScore: number | undefined;
  if (jobFields.length > 0) {
    const userFieldText = education.map((e) => `${e.fieldOfStudy || ''} ${e.degree || ''}`).join('\n');
    const userFields = fieldsIn(userFieldText);
    const overlap = jobFields.filter((f) => userFields.includes(f));
    if (education.length === 0) {
      fieldScore = 0;
    } else if (overlap.length > 0) {
      fieldScore = 100;
      evidence.push(`Your ${fieldLabel(overlap[0])} background matches the posting's field`);
    } else if (relatedOk && userFields.some((f) => TECHNICAL_FIELDS.has(f)) && jobFields.some((f) => TECHNICAL_FIELDS.has(f))) {
      fieldScore = 85;
      evidence.push('Your field of study counts as a related technical field');
    } else if (userFields.length === 0 && !userFieldText.trim()) {
      fieldScore = 60;
      gaps.push('Add your field of study');
    } else {
      fieldScore = 40;
      gaps.push(`Posting looks for ${jobFields.slice(0, 2).map(fieldLabel).join(' or ')}; your field differs`);
    }
  }

  // 3. Graduation window
  let gradScore: number | undefined;
  if (reqs.graduationWindow) {
    const { minYear, maxYear } = reqs.graduationWindow;
    const inProgress = education.filter((e) => e.status === 'in_progress' && e.graduationYear);
    const dated = education.filter((e) => e.graduationYear);
    const pick = inProgress[0] || dated.sort((a, b) => (b.graduationYear || 0) - (a.graduationYear || 0))[0];
    const year = pick?.graduationYear;
    const label = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`;
    if (year === undefined) {
      gradScore = 50;
      gaps.push('Add your expected graduating class');
    } else if (year >= minYear && year <= maxYear) {
      gradScore = 100;
      evidence.push(`Graduating ${year} — inside the posting's window (${label})`);
    } else if (year === minYear - 1 || year === maxYear + 1) {
      gradScore = 60;
      gaps.push(`Posting targets ${label} graduates; you graduate ${year}`);
    } else {
      gradScore = 20;
      gaps.push(`Posting targets ${label} graduates; you graduate ${year}`);
    }
  }

  const score = clamp(
    Math.round(
      weightedAverage([
        { score: degreeScore ?? 0, weight: degreeScore === undefined ? 0 : 40 },
        { score: fieldScore ?? 0, weight: fieldScore === undefined ? 0 : 25 },
        { score: gradScore ?? 0, weight: gradScore === undefined ? 0 : 35 },
      ]),
    ),
  );
  return { score, applicable: true, evidence, gaps };
}
