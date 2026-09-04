import { EmploymentPreference, RemotePreference } from '../../types/profile';
import { JobEmploymentType, RemoteMode } from './jobRequirements';
import { FactorContext, FactorOutcome, clamp, weightedAverage } from './common';

const NEUTRAL = 70;

const EMPLOYMENT_LABEL: Record<JobEmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  contract: 'Contract',
  unknown: 'Unspecified',
};

const REMOTE_LABEL: Record<RemoteMode, string> = {
  remote: 'remote',
  hybrid: 'hybrid',
  onsite: 'on-site',
  unknown: 'unspecified',
};

function remoteFit(pref: RemotePreference, mode: RemoteMode): number {
  if (mode === 'unknown') return NEUTRAL;
  if (pref === 'any') return 85;
  if (pref === mode) return 100;
  const table: Record<string, number> = {
    'remote>onsite': 20,
    'remote>hybrid': 55,
    'hybrid>onsite': 65,
    'hybrid>remote': 70,
    'onsite>remote': 60,
    'onsite>hybrid': 75,
  };
  return table[`${pref}>${mode}`] ?? NEUTRAL;
}

const LOCATION_ALIASES: Record<string, string[]> = {
  sf: ['san francisco'],
  nyc: ['new york'],
  la: ['los angeles'],
  'bay area': ['san francisco', 'san jose', 'oakland', 'palo alto', 'mountain view', 'sunnyvale', 'menlo park', 'redwood city', 'cupertino', 'santa clara', 'berkeley', 'fremont', 'south san francisco'],
  'silicon valley': ['san jose', 'palo alto', 'mountain view', 'sunnyvale', 'menlo park', 'cupertino', 'santa clara'],
  dc: ['washington'],
};

const STATE_ABBR: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca', colorado: 'co', connecticut: 'ct', delaware: 'de',
  florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks', kentucky: 'ky',
  louisiana: 'la', maine: 'me', maryland: 'md', massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms', missouri: 'mo',
  montana: 'mt', nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
  'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri',
  'south carolina': 'sc', 'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt', virginia: 'va', washington: 'wa',
  'west virginia': 'wv', wisconsin: 'wi', wyoming: 'wy',
};

function expandLocation(raw: string): string[] {
  const norm = raw.toLowerCase().replace(/[.]/g, '').trim();
  const parts = norm.split(/\s*,\s*/).filter(Boolean);
  const out = new Set<string>();
  for (const part of parts) {
    out.add(part);
    for (const alias of LOCATION_ALIASES[part] || []) out.add(alias);
    if (STATE_ABBR[part]) out.add(STATE_ABBR[part]);
  }
  return Array.from(out);
}

function locationsOverlap(preferred: string[], jobLocations: string[]): string | undefined {
  const jobParts = jobLocations.flatMap(expandLocation);
  for (const pref of preferred) {
    const prefParts = expandLocation(pref);
    for (const p of prefParts) {
      if (p.length < 2) continue;
      if (jobParts.some((j) => j === p || (p.length > 3 && j.includes(p)) || (j.length > 3 && p.includes(j)))) return pref;
    }
  }
  return undefined;
}

/** Remote (40%), employment type (35%) and location (25%). Unknowns are neutral; only clear conflicts are penalised. */
export function scorePreferences(ctx: FactorContext): FactorOutcome {
  const { profile, reqs } = ctx;
  const story = profile.story;
  const evidence: string[] = [];
  const gaps: string[] = [];

  // 1. Remote
  const pref = story?.remotePreference || 'any';
  const remoteScore = remoteFit(pref, reqs.remote);
  if (reqs.remote !== 'unknown' && pref !== 'any') {
    if (pref === reqs.remote) evidence.push(`${REMOTE_LABEL[reqs.remote]} role matches your ${pref} preference`);
    else if (remoteScore <= 60) gaps.push(`Posting is ${REMOTE_LABEL[reqs.remote]}; you prefer ${pref}`);
  }

  // 2. Employment type
  const wanted: EmploymentPreference[] = story?.employmentTypes || [];
  let employmentScore = NEUTRAL;
  if (reqs.employmentType !== 'unknown' && wanted.length > 0) {
    if (wanted.includes(reqs.employmentType as EmploymentPreference)) {
      employmentScore = 100;
      evidence.push(`${EMPLOYMENT_LABEL[reqs.employmentType]} role matches your preferences`);
    } else {
      employmentScore = 15;
      gaps.push(`${EMPLOYMENT_LABEL[reqs.employmentType]} role, but you only want: ${wanted.map((w) => EMPLOYMENT_LABEL[w]).join(', ')}`);
    }
  }

  // 3. Location
  const preferred = (story?.preferredLocations || []).filter((l) => l.trim());
  let locationScore = NEUTRAL;
  if (preferred.length > 0 && reqs.locations.length > 0) {
    const hit = locationsOverlap(preferred, reqs.locations);
    if (hit) {
      locationScore = 100;
      evidence.push(`Located in ${reqs.locations[0]}, one of your preferred locations`);
    } else if (reqs.remote === 'remote') {
      locationScore = 90;
    } else {
      locationScore = 30;
      gaps.push(`Located in ${reqs.locations.slice(0, 2).join(' / ')}, outside your preferred locations`);
    }
  } else if (preferred.length > 0 && reqs.remote === 'remote') {
    locationScore = 90;
  }

  const score = clamp(
    Math.round(
      weightedAverage([
        { score: remoteScore, weight: 40 },
        { score: employmentScore, weight: 35 },
        { score: locationScore, weight: 25 },
      ]),
    ),
  );
  return { score, applicable: true, evidence, gaps };
}
