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
  /** Endpoint-specific extras, e.g. attendance 422 code attendance_rule carries `today`. */
  [extra: string]: unknown;
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

// Dashboards & Analytics (Module 5)

/** One KPI number; `trend` is the month-over-month % change where the web shows one, else null. */
export interface Kpi {
  value: number;
  trend: number | null;
}

export interface AttendanceSummaryKpi {
  present: number;
  rejected: number;
}

export type AttendanceStatus = 'pending' | 'approved' | 'rejected';

export interface DashboardHours {
  rendered: number;
  /** null = not set yet */
  required: number | null;
  remaining: number | null;
  /** min(round(rendered / required * 100), 100); null when required is not set */
  progress_percent: number | null;
}

export interface TodayAttendance {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  /** ISO 8601 (+08:00) */
  time_in: string | null;
  time_in_status: AttendanceStatus | null;
  time_out: string | null;
  time_out_status: AttendanceStatus | null;
}

export interface DashboardReportRow {
  id: number;
  type: 'daily' | 'weekly' | string;
  /** YYYY-MM-DD */
  period_start: string;
  period_end: string;
  status: 'pending' | 'reviewed' | string;
}

export interface StudentDashboard {
  internship: {
    status: InternshipStatus;
    company: IdName | null;
    supervisor: IdName | null;
  };
  hours: DashboardHours;
  today_attendance: TodayAttendance | null;
  reports: { pending: number; reviewed: number };
  /** Latest 5 by period_start */
  recent_reports: DashboardReportRow[];
}

export interface SupervisorKpis {
  assigned_students: Kpi;
  active_internships: Kpi;
  todays_attendance: Kpi;
  pending_attendance_approvals: Kpi;
  reports_awaiting_review: Kpi;
  pending_evaluations: Kpi;
  completed_evaluations: Kpi;
  students_requiring_attention: Kpi;
}

export interface CoordinatorKpis {
  total_students: Kpi;
  active_internship_assignments: Kpi;
  companies: Kpi;
  active_supervisors: Kpi;
  students_without_company: Kpi;
  pending_approvals: Kpi;
  attendance_summary: AttendanceSummaryKpi;
  /** value = percent with 1 decimal */
  internship_completion_progress: Kpi;
  reports_awaiting_review: Kpi;
  students_requiring_attention: Kpi;
}

export interface AdminKpis {
  total_students: Kpi;
  total_companies: Kpi;
  total_supervisors: Kpi;
  active_internship_assignments: Kpi;
  completed_internships: Kpi;
  pending_approvals: Kpi;
  attendance_summary: AttendanceSummaryKpi;
  students_nearing_completion: Kpi;
  students_with_attendance_issues: Kpi;
  pending_supervisor_evaluations: Kpi;
}

export interface SupervisedStudentRow {
  id: number;
  name: string | null;
  internship_status: InternshipStatus;
  rendered_hours: number;
  required_hours: number | null;
  progress_percent: number | null;
}

export interface ActionItem {
  key: string;
  /** Same text as the website, e.g. "3 attendance approval(s) awaiting your action" */
  label: string;
  count: number;
  target: NotificationTarget | null;
}

/** A notification on the dashboard feed; a supervisor also sees their students' ones (is_own = false). */
export interface ActivityItem extends AppNotification {
  is_own: boolean;
}

interface DashboardBase {
  action_items: ActionItem[];
  recent_activity: ActivityItem[];
}

// GET /dashboard — every key is always present; the ones that don't apply to the role are null / [].
export type DashboardResponse =
  | (DashboardBase & { role_id: 1; student: StudentDashboard | null; kpis: null; supervised_students: null })
  | (DashboardBase & { role_id: 3; student: null; kpis: SupervisorKpis; supervised_students: SupervisedStudentRow[] })
  | (DashboardBase & { role_id: 2; student: null; kpis: CoordinatorKpis; supervised_students: null })
  | (DashboardBase & { role_id: 4; student: null; kpis: AdminKpis; supervised_students: null });

export interface AnalyticsFilters {
  /** YYYY-MM-DD */
  date_from: string | null;
  date_to: string | null;
  company_id: number | null;
  supervisor_id: number | null;
  student_id: number | null;
}

export interface ChartPoint {
  key: string;
  label: string;
  value: number;
}

// GET /analytics?date_from=&date_to=&company_id=&supervisor_id=&student_id= (roles 2, 3, 4)
export interface AnalyticsResponse {
  /** As resolved by the server (supervisor_id = self for supervisors). */
  filters: AnalyticsFilters;
  internship: {
    status_breakdown: ChartPoint[];
    /** Top 10 */
    students_by_company: ChartPoint[];
    /** Always 5 buckets: 0-25%, 25-50%, 50-75%, 75-100%, 100%+ */
    completion_progress: ChartPoint[];
  };
  attendance: {
    outcomes: ChartPoint[];
    /** Only days with rows; default range = last 30 days */
    trend: { date: string; present: number; rejected: number }[];
    frequent_rejections: { student_id: number; name: string | null; rejection_count: number }[];
  };
  evaluation: {
    /** draft | submitted | locked */
    completion: ChartPoint[];
    /** value = average rating (1–5), 2 decimals */
    by_category: ChartPoint[];
  };
  reports: {
    /** pending | reviewed */
    funnel: ChartPoint[];
    submission_trend: { date: string; value: number }[];
  };
}

// GET /analytics/filter-options (already scoped for a supervisor)
export interface AnalyticsFilterOptions {
  companies: IdName[];
  supervisors: IdName[];
  students: { id: number; name: string | null; student_number: string }[];
}

// Attendance (Module 6, Student)

export type AttendanceLeg = 'time_in' | 'time_out';
export type AttendanceAction = 'time_in' | 'time_out' | 'emergency_time_out';

/** One day's attendance record, flat like the website's (GET /attendance, /attendance/today). */
export interface AttendanceRecord {
  id: number;
  /** YYYY-MM-DD (Manila) */
  date: string;
  /** ISO 8601 with +08:00 */
  time_in: string | null;
  time_in_status: AttendanceStatus | null;
  time_in_rejection_reason: string | null;
  time_in_latitude: number | null;
  time_in_longitude: number | null;
  /** metres */
  time_in_accuracy: number | null;
  /** Android's fake-GPS flag; null = unknown (website, staff entry, or not reported) */
  time_in_mocked: boolean | null;
  /** Absolute API URL; fetch with the Bearer header. */
  time_in_photo_url: string | null;
  time_out: string | null;
  time_out_status: AttendanceStatus | null;
  time_out_rejection_reason: string | null;
  time_out_latitude: number | null;
  time_out_longitude: number | null;
  time_out_accuracy: number | null;
  time_out_mocked: boolean | null;
  time_out_photo_url: string | null;
  /** Set only when both legs are approved. */
  rendered_hours: number | null;
  is_emergency: boolean;
  note: string | null;
}

export interface AttendanceActionState {
  allowed: boolean;
  /** null when allowed; otherwise the server's rule message, shown as-is */
  reason: string | null;
}

export interface AttendanceToday {
  /** YYYY-MM-DD (Manila) */
  date: string;
  record: AttendanceRecord | null;
  actions: Record<AttendanceAction, AttendanceActionState>;
  hours: { rendered: number; required: number | null; remaining: number | null };
}

/** POST /attendance/{time-in|time-out|emergency-time-out} → message + the fresh today state. */
export interface AttendanceSubmitResponse extends AttendanceToday {
  message: string;
}

export interface AttendancePage {
  data: AttendanceRecord[];
  meta: { per_page: number; next_cursor: string | null; has_more: boolean };
}

// Reports (Module 7, Student)

export type ReportType = 'daily' | 'weekly';
export type ReportStatus = 'pending' | 'reviewed';

export interface ReportAttachment {
  /** Original file name, e.g. "proof.pdf" */
  name: string;
  /** image/jpeg, image/png or application/pdf */
  mime: string;
  /** 'file' is a fallback for any other stored type (validation only lets images and PDFs in). */
  kind: 'image' | 'pdf' | 'file';
  /** bytes */
  size: number;
  /** Absolute API URL with a ?v= fingerprint that changes when the file is replaced; fetch with the Bearer header. */
  url: string;
}

export interface Report {
  id: number;
  type: ReportType;
  /** YYYY-MM-DD; for a daily report period_end equals period_start */
  period_start: string;
  period_end: string;
  content: string;
  status: ReportStatus;
  reviewer_comment: string | null;
  /** null when not reviewed (or the reviewer's account was deleted) */
  reviewer: IdName | null;
  /** ISO 8601 (+08:00) */
  reviewed_at: string | null;
  attachment: ReportAttachment | null;
  created_at: string;
  updated_at: string;
  /** From the server's policy (own + pending). UI hints only; the server re-checks. */
  can_edit: boolean;
  can_delete: boolean;
}

export interface ReportFilters {
  type: ReportType | null;
  status: ReportStatus | null;
}

// GET /reports?type=&status=&per_page=&cursor= — period_start desc, then id desc.
export interface ReportsPage {
  data: Report[];
  meta: {
    per_page: number;
    next_cursor: string | null;
    has_more: boolean;
  };
}

// POST /reports, POST /reports/{id} (_method=PATCH)
export interface ReportSaveResponse {
  message: string;
  report: Report;
}
