/**
 * Request/response types for the SIMS mobile API v1.
 * Source of truth: docs/api/v1.md in the Laravel repo. Field names match it exactly.
 */

/** 1 = Student, 3 = Supervisor. The API never returns other roles to the app. */
export type RoleId = 1 | 3;

export const ROLE_STUDENT = 1 as const;
export const ROLE_SUPERVISOR = 3 as const;

export interface User {
  id: number;
  name: string;
  email: string;
  role_id: RoleId;
  role: 'Student' | 'Supervisor';
}

export type InternshipStatus = 'not_started' | 'ongoing' | 'completed';

export interface IdName {
  id: number;
  name: string;
}

export interface StudentProfile {
  /** Student record id (not the user id). */
  id: number;
  student_number: string;
  course: string;
  section: string;
  internship_status: InternshipStatus;
  /** null = not set yet */
  required_hours: number | null;
  /** null = not assigned to a company yet */
  company: IdName | null;
  /** null = no supervisor assigned yet */
  supervisor: IdName | null;
}

export interface SupervisorSummary {
  students_count: number;
}

// POST /login
export interface LoginRequest {
  email: string;
  password: string;
  device_name: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// GET /me
export interface MeResponse {
  user: User;
  /** Set for students (null if the profile isn't set up yet); always null for supervisors. */
  student: StudentProfile | null;
  /** Set for supervisors; always null for students. */
  supervisor: SupervisorSummary | null;
}

// Errors
export type SessionBlockedCode = 'role_not_allowed' | 'account_inactive';

export interface ApiErrorBody {
  message?: string;
  /** 403 from the auth layer */
  code?: SessionBlockedCode | string;
  /** 422 */
  errors?: Record<string, string[]>;
}
