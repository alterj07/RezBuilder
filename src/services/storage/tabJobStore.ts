import { JobPosting } from '../../types/job';

/**
 * Per-tab job registry.
 *
 * The side panel is a single surface shared by every tab, so a lone global
 * `activeJob` key cannot represent "the job for the tab you are looking at".
 * This module keeps one entry per tab id and mirrors the active tab's entry
 * into `activeJob`, which remains the key the side panel renders from.
 */

export const TAB_JOBS_KEY = 'tabJobs';
export const ACTIVE_JOB_KEY = 'activeJob';

type ChromeLike = typeof chrome | undefined;

function getChrome(): ChromeLike {
  return typeof chrome !== 'undefined' ? chrome : undefined;
}

/**
 * Tab ids are meaningless across browser restarts, so the registry belongs in
 * session storage. Falls back to local where session is unavailable (older
 * runtimes and the test harness).
 */
function registryArea(): chrome.storage.StorageArea | null {
  const c = getChrome() as any;
  if (!c?.storage) return null;
  return c.storage.session || c.storage.local || null;
}

function localArea(): chrome.storage.StorageArea | null {
  const c = getChrome() as any;
  return c?.storage?.local || null;
}

export async function getTabJobs(): Promise<Record<string, JobPosting>> {
  const area = registryArea();
  if (!area) return {};
  try {
    const stored = await area.get([TAB_JOBS_KEY]);
    const map = stored?.[TAB_JOBS_KEY];
    return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  } catch {
    return {};
  }
}

export async function getTabJob(tabId: number): Promise<JobPosting | null> {
  const jobs = await getTabJobs();
  return jobs[String(tabId)] || null;
}

export async function setTabJob(tabId: number, job: JobPosting): Promise<void> {
  const area = registryArea();
  if (!area || typeof tabId !== 'number') return;
  const jobs = await getTabJobs();
  jobs[String(tabId)] = job;
  await area.set({ [TAB_JOBS_KEY]: jobs });
}

export async function clearTabJob(tabId: number): Promise<void> {
  const area = registryArea();
  if (!area || typeof tabId !== 'number') return;
  const jobs = await getTabJobs();
  if (jobs[String(tabId)] === undefined) return;
  delete jobs[String(tabId)];
  await area.set({ [TAB_JOBS_KEY]: jobs });
}

/**
 * Publishes a tab's job as the panel-visible active job. Passing null removes
 * the key, which the side panel's storage listener renders as the empty state.
 */
export async function publishActiveJob(job: JobPosting | null): Promise<void> {
  const area = localArea();
  if (!area) return;
  if (job) {
    await area.set({ [ACTIVE_JOB_KEY]: job });
  } else {
    const existing = await area.get([ACTIVE_JOB_KEY]);
    if (existing?.[ACTIVE_JOB_KEY] === undefined) return;
    await area.remove(ACTIVE_JOB_KEY);
  }
}

/** Mirrors the given tab's cached job into `activeJob`, clearing it when absent. */
export async function syncActiveJobFromTab(tabId: number): Promise<JobPosting | null> {
  const job = await getTabJob(tabId);
  await publishActiveJob(job);
  return job;
}

/** Records a detection result for a tab and mirrors it when that tab is active. */
export async function recordDetection(
  tabId: number,
  job: JobPosting | null,
  isActiveTab: boolean
): Promise<void> {
  if (job) {
    await setTabJob(tabId, job);
  } else {
    await clearTabJob(tabId);
  }
  if (isActiveTab) {
    await publishActiveJob(job);
  }
}

/** Appends a job to the rolling recent-jobs list, de-duplicated by url + title. */
export async function appendJobHistory(job: JobPosting, limit = 30): Promise<void> {
  const area = localArea();
  if (!area) return;
  const stored = await area.get(['jobHistory']);
  const history: JobPosting[] = Array.isArray(stored?.jobHistory) ? stored.jobHistory : [];
  if (history.some((j) => j && j.url === job.url && j.title === job.title)) return;
  history.unshift(job);
  await area.set({ jobHistory: history.slice(0, limit) });
}
