export interface TeachingAssistantJobTemplate {
  id: string;
  title: string;
  description?: string;
}

export interface TeachingAssistantJobConfig {
  globalJobs: TeachingAssistantJobTemplate[];
  classJobs: TeachingAssistantJobTemplate[];
}

const GLOBAL_KEY = 'ta_jobs_global';
const CLASS_KEY_PREFIX = 'ta_jobs_class_';

function getClassKey(className?: string | null): string {
  if (!className) return `${CLASS_KEY_PREFIX}default`;
  return `${CLASS_KEY_PREFIX}${className}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadTeachingAssistantJobConfig(className?: string | null): TeachingAssistantJobConfig {
  if (typeof window === 'undefined') {
    return { globalJobs: [], classJobs: [] };
  }

  const globalRaw = window.localStorage.getItem(GLOBAL_KEY);
  const classRaw = window.localStorage.getItem(getClassKey(className));

  const globalJobs = safeParse<TeachingAssistantJobTemplate[]>(globalRaw, []);
  const classJobs = safeParse<TeachingAssistantJobTemplate[]>(classRaw, []);

  return { globalJobs, classJobs };
}

export function saveGlobalTeachingAssistantJobs(jobs: TeachingAssistantJobTemplate[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GLOBAL_KEY, JSON.stringify(jobs));
}

export function saveClassTeachingAssistantJobs(className: string | null | undefined, jobs: TeachingAssistantJobTemplate[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getClassKey(className || undefined), JSON.stringify(jobs));
}

export function mergeTeachingAssistantJobs(config: TeachingAssistantJobConfig): TeachingAssistantJobTemplate[] {
  // Class jobs override global jobs with the same id; otherwise they are appended
  const byId: Record<string, TeachingAssistantJobTemplate> = {};

  config.globalJobs.forEach(job => {
    byId[job.id] = job;
  });

  config.classJobs.forEach(job => {
    byId[job.id] = job;
  });

  return Object.values(byId);
}

