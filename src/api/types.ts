/**
 * Request/response types for the SIMS mobile API v1.
 * Source of truth: docs/api/v1.md in the Laravel repo. Field names match it exactly.
 */

/** Role ids from the roles table (RoleSeeder): 1 Student, 2 Internship Coordinator, 3 Supervisor, 4 Administrator. */
export type RoleId = 1 | 2 | 3 | 4;

export const ROLE_STUDENT = 1 as const;
export const ROLE_COORDINATOR = 2 as const;
export const ROLE_SUPERVISOR = 3 as const;
export const ROLE_ADMIN = 4 as const;

export type RoleName = 'Student' | 'Internship Coordinator' | 'Supervisor' | 'Administrator';

export interface User {
  id: number;
  name: string;
  email: string;
  role_id: RoleId;
  role: RoleName;
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

/**
 * Coordinator (2) / Administrator (4) permission flags, mirroring the website's route roles.
 * UI hints only: the API still answers 403 for anything not allowed. New flags may be added
 * within v1 (none are removed or renamed); treat a missing flag as false.
 */
export interface StaffPermissions {
  /** User Management */
  can_manage_users: boolean;
  /** Company Management + Supervisor Roster */
  can_manage_companies: boolean;
  /** Internship Assignment */
  can_assign_internships: boolean;
  /** Pending Approvals (approve / reject) */
  can_approve_attendance: boolean;
  /** Attendance Monitoring manual entries / required hours (otherwise view only) */
  can_edit_attendance: boolean;
  /** Report Reviews: the review action (viewing needs no flag) */
  can_review_reports: boolean;
  /** Create / edit / submit evaluations (otherwise view only) */
  can_write_evaluations: boolean;
  /** Lock / reopen evaluations */
  can_lock_evaluations: boolean;
  /** Evaluation Criteria screen */
  can_manage_criteria: boolean;
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

// GET /me — exactly one of student / supervisor / staff is relevant to the role; the other two are null.
export interface MeResponse {
  user: User;
  /** Students only (null if the student profile isn't set up yet). */
  student: StudentProfile | null;
  /** Supervisors only. */
  supervisor: SupervisorSummary | null;
  /** Coordinators and Administrators only. */
  staff: StaffPermissions | null;
}

// Errors
/** role_not_allowed is now only sent for accounts with no / an unknown role. */
export type SessionBlockedCode = 'role_not_allowed' | 'account_inactive';

export interface ApiErrorBody {
  message?: string;
  /** 403 from the auth layer */
  code?: SessionBlockedCode | string;
  /** 422 */
  errors?: Record<string, string[]>;
}

// Notifications (Module 4)

/**
 * Where tapping a notification leads, resolved by the server for the viewer's current role.
 * `screen` is a FeatureKey from src/navigation/access.ts (new keys may appear; unknown ones are
 * ignored). `params` holds int ids that are only highlight hints (the record may be gone),
 * e.g. { attendance_id: 12 } or { report_id: 7 }; {} when there's nothing to highlight.
 */
export interface NotificationTarget {
  screen: string;
  params: Record<string, number>;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  /** ISO 8601 (+08:00); null = unread */
  read_at: string | null;
  /** ISO 8601 (+08:00) */
  created_at: string;
  /** null = nothing to open for this type / role */
  target: NotificationTarget | null;
}

// GET /notifications?unread=&per_page=&cursor= — cursor pagination, newest first.
export interface NotificationsPage {
  data: AppNotification[];
  meta: {
    per_page: number;
    next_cursor: string | null;
    has_more: boolean;
  };
}

// GET /notifications/unread-count
export interface UnreadCountResponse {
  count: number;
}

// POST /notifications/{id}/read
export interface MarkReadResponse {
  notification: AppNotification;
  unread_count: number;
}

// POST /notifications/read-all
export interface MarkAllReadResponse {
  marked: number;
  unread_count: number;
}
