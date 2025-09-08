/**
 * Routing utilities for handling URL parameters and navigation
 */

export interface RouteParams {
  student?: boolean;
  code?: string;
  session?: string;
  class?: string;
}

/**
 * Parse URL parameters and return route information
 */
export function parseRouteParams(): RouteParams {
  const urlParams = new URLSearchParams(window.location.search);
  
  return {
    student: urlParams.get('student') === 'true',
    code: urlParams.get('code') || undefined,
    session: urlParams.get('session') || undefined,
    class: urlParams.get('class') || undefined
  };
}

/**
 * Generate student join URL with session code
 */
export function generateStudentJoinUrl(sessionCode: string, baseUrl?: string): string {
  const base = baseUrl || window.location.origin;
  return `${base}?student=true&code=${sessionCode}`;
}

/**
 * Generate teacher session URL
 */
export function generateTeacherSessionUrl(session: string, className?: string, baseUrl?: string): string {
  const base = baseUrl || window.location.origin;
  const params = new URLSearchParams();
  params.set('session', session);
  if (className) {
    params.set('class', className);
  }
  return `${base}?${params.toString()}`;
}

/**
 * Check if current route is student mode
 */
export function isStudentMode(): boolean {
  return parseRouteParams().student === true;
}

/**
 * Get session code from URL
 */
export function getSessionCodeFromUrl(): string | undefined {
  return parseRouteParams().code;
}

/**
 * Navigate to student join page
 */
export function navigateToStudentJoin(sessionCode: string): void {
  const url = generateStudentJoinUrl(sessionCode);
  window.location.href = url;
}

/**
 * Navigate to teacher interface
 */
export function navigateToTeacher(): void {
  window.location.href = window.location.origin;
}
