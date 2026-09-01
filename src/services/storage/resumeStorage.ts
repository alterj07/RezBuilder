import { Resume } from '../../types/resume';

const RESUMES_STORAGE_KEY = 'rezbuilder_resumes';
const ACTIVE_RESUME_ID_KEY = 'rezbuilder_active_resume_id';

// In-memory fallback for test and non-extension environments
let memoryStore: Record<string, any> = {};

async function storageGet<T>(key: string, defaultValue: T): Promise<T> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const result = await chrome.storage.local.get([key]);
    return result[key] !== undefined ? result[key] : defaultValue;
  }
  return memoryStore[key] !== undefined ? memoryStore[key] : defaultValue;
}

async function storageSet(key: string, value: any): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [key]: value });
  } else {
    memoryStore[key] = value;
  }
}

export class ResumeStorageService {
  /**
   * Retrieve all saved resumes
   */
  async getAllResumes(): Promise<Resume[]> {
    return await storageGet<Resume[]>(RESUMES_STORAGE_KEY, []);
  }

  /**
   * Get single resume by ID
   */
  async getResumeById(id: string): Promise<Resume | null> {
    const resumes = await this.getAllResumes();
    return resumes.find((r) => r.id === id) || null;
  }

  /**
   * Save a new or existing resume
   */
  async saveResume(resume: Resume): Promise<void> {
    const resumes = await this.getAllResumes();
    const index = resumes.findIndex((r) => r.id === resume.id);
    if (index >= 0) {
      resumes[index] = resume;
    } else {
      // If first resume, make default
      if (resumes.length === 0) {
        resume.isDefault = true;
      }
      resumes.unshift(resume);
    }
    await storageSet(RESUMES_STORAGE_KEY, resumes);

    // Set as active resume if it's default or the only one
    if (resume.isDefault || resumes.length === 1) {
      await this.setActiveResume(resume.id);
    }
  }

  /**
   * Delete a resume by ID
   */
  async deleteResume(id: string): Promise<void> {
    let resumes = await this.getAllResumes();
    resumes = resumes.filter((r) => r.id !== id);
    await storageSet(RESUMES_STORAGE_KEY, resumes);

    const activeId = await this.getActiveResumeId();
    if (activeId === id) {
      const nextActive = resumes[0]?.id || null;
      if (nextActive) {
        await this.setActiveResume(nextActive);
      } else {
        await storageSet(ACTIVE_RESUME_ID_KEY, null);
      }
    }
  }

  /**
   * Set a resume as the default
   */
  async setDefaultResume(id: string): Promise<void> {
    const resumes = await this.getAllResumes();
    resumes.forEach((r) => {
      r.isDefault = r.id === id;
    });
    await storageSet(RESUMES_STORAGE_KEY, resumes);
    await this.setActiveResume(id);
  }

  /**
   * Update resume metadata or content
   */
  async updateResume(id: string, updates: Partial<Resume>): Promise<Resume | null> {
    const resumes = await this.getAllResumes();
    const index = resumes.findIndex((r) => r.id === id);
    if (index === -1) return null;

    resumes[index] = { ...resumes[index], ...updates };
    await storageSet(RESUMES_STORAGE_KEY, resumes);
    return resumes[index];
  }

  /**
   * Active resume ID methods
   */
  async getActiveResumeId(): Promise<string | null> {
    return await storageGet<string | null>(ACTIVE_RESUME_ID_KEY, null);
  }

  async setActiveResume(id: string): Promise<void> {
    await storageSet(ACTIVE_RESUME_ID_KEY, id);
  }

  async getActiveResume(): Promise<Resume | null> {
    const activeId = await this.getActiveResumeId();
    if (activeId) {
      const res = await this.getResumeById(activeId);
      if (res) return res;
    }
    const resumes = await this.getAllResumes();
    return resumes.find((r) => r.isDefault) || resumes[0] || null;
  }

  /**
   * Clear all stored resumes
   */
  async clearAllResumes(): Promise<void> {
    await storageSet(RESUMES_STORAGE_KEY, []);
    await storageSet(ACTIVE_RESUME_ID_KEY, null);
  }
}

export const resumeStorage = new ResumeStorageService();
