import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';

import {
  ROLE_ADMIN,
  ROLE_COORDINATOR,
  ROLE_STUDENT,
  ROLE_SUPERVISOR,
  type MeResponse,
  type RoleId,
  type StaffPermissions,
} from '@/api/types';

/**
 * THE one place that maps a signed-in user (role + GET /me staff flags) to navigation:
 * which route group they land in, which bottom tabs they get, and what the "More" screen lists.
 * Layouts and screens only read from here; nothing else decides visibility.
 *
 * This is UX only. The API enforces every role / ownership rule and answers 403 regardless
 * of what the app shows.
 */

type IconName = keyof typeof Ionicons.glyphMap;

export type FeatureKey =
  | 'home'
  | 'attendance'
  | 'my-reports'
  | 'feedback'
  | 'approvals'
  | 'students'
  | 'evaluations'
  | 'report-reviews'
  | 'companies'
  | 'users'
  | 'criteria'
  | 'attendance-monitoring'
  | 'progress'
  | 'notifications'
  | 'analytics'
  | 'profile'
  | 'more';

export interface FeatureInfo {
  /** Screen / list title */
  title: string;
  /** Short bottom-tab label (defaults to title) */
  tabLabel?: string;
  icon: IconName;
  iconFocused: IconName;
  /** Roadmap module that delivers it, e.g. "Module 13 — User Management" (placeholders only). */
  module?: string;
  description: string;
}

/** Route groups under src/app. Coordinator and Admin share "staff". */
export type NavGroup = 'student' | 'supervisor' | 'staff';

// ---------------------------------------------------------------------------
// Catalog: what each feature is called and which module builds it.
// `byRole` overrides the base text where a role sees the feature differently.
// ---------------------------------------------------------------------------

type CatalogEntry = FeatureInfo & { byRole?: Partial<Record<RoleId, Partial<FeatureInfo>>> };

const CATALOG: Record<FeatureKey, CatalogEntry> = {
  home: {
    // Same page titles as the website's Dashboard (ROLE_TITLES in Dashboard/Index.jsx).
    title: 'Dashboard',
    tabLabel: 'Home',
    icon: 'home-outline',
    iconFocused: 'home',
    description: 'System-wide KPIs, action items, recent activity and analytics charts.',
    byRole: {
      [ROLE_STUDENT]: {
        title: 'My Dashboard',
        description: "Your internship status, company, supervisor, rendered and remaining hours, today's attendance and recent reports.",
      },
      [ROLE_SUPERVISOR]: {
        title: 'Supervisor Dashboard',
        description: "Your students at a glance: pending approvals, today's attendance and hours progress.",
      },
      [ROLE_COORDINATOR]: { title: 'Coordinator Dashboard' },
      [ROLE_ADMIN]: { title: 'Administrator Dashboard' },
    },
  },
  attendance: {
    title: 'My Attendance',
    tabLabel: 'Attendance',
    icon: 'time-outline',
    iconFocused: 'time',
    module: 'Module 6 — Attendance (Time In/Out)',
    description: 'Time in and time out with a live photo and your GPS location, plus your attendance history.',
  },
  'my-reports': {
    title: 'My Reports',
    tabLabel: 'Reports',
    icon: 'document-text-outline',
    iconFocused: 'document-text',
    module: 'Module 7 — Reports',
    description: "Submit daily and weekly reports with attachments and read your reviewer's comments.",
  },
  feedback: {
    title: 'My Feedback',
    tabLabel: 'Feedback',
    icon: 'chatbox-ellipses-outline',
    iconFocused: 'chatbox-ellipses',
    module: 'Module 8 — My Feedback',
    description: "Your supervisor's evaluations: ratings, strengths, areas for improvement and recommendations.",
  },
  approvals: {
    title: 'Pending Approvals',
    tabLabel: 'Approvals',
    icon: 'checkmark-done-circle-outline',
    iconFocused: 'checkmark-done-circle',
    module: 'Module 9 — Pending Approvals',
    description: 'Review time-ins and time-outs with photo and location, then approve or reject.',
    byRole: {
      [ROLE_SUPERVISOR]: {
        description: "Review your students' time-ins and time-outs with photo and location, then approve or reject.",
      },
    },
  },
  students: {
    title: 'Internship Assignment',
    tabLabel: 'Students',
    icon: 'people-outline',
    iconFocused: 'people',
    module: 'Module 15 — Internship Assignment',
    description: 'All students: assign a company, a supervisor from its roster, status and schedule.',
    byRole: {
      [ROLE_SUPERVISOR]: {
        // Same page as the website's supervisor menu item.
        title: 'Attendance Monitoring',
        module: 'Module 10 — Attendance & Progress Monitoring',
        description: "Your assigned students: attendance logs with evidence, manual entries and hours progress.",
      },
    },
  },
  evaluations: {
    title: 'Supervisor Monitoring & Feedback',
    tabLabel: 'Evaluations',
    icon: 'star-outline',
    iconFocused: 'star',
    module: 'Module 12 — Supervisor Evaluations',
    description: 'Supervisor evaluations of students.',
    byRole: {
      [ROLE_SUPERVISOR]: { description: 'Rate your students 1–5 per category, save drafts and submit evaluations.' },
      [ROLE_COORDINATOR]: { description: "View supervisors' evaluations of students (view only)." },
      [ROLE_ADMIN]: { description: 'All supervisor evaluations, including locking and reopening them.' },
    },
  },
  'report-reviews': {
    title: 'Report Reviews',
    tabLabel: 'Reports',
    icon: 'document-text-outline',
    iconFocused: 'document-text',
    module: 'Module 11 — Report Reviews',
    description: "Read students' daily and weekly reports and attachments, comment and mark them reviewed.",
    byRole: {
      [ROLE_SUPERVISOR]: { description: "Read your students' daily and weekly reports and attachments (view only)." },
    },
  },
  companies: {
    title: 'Company Management',
    tabLabel: 'Companies',
    icon: 'business-outline',
    iconFocused: 'business',
    module: 'Module 14 — Company Management & Supervisor Roster',
    description: 'Host companies: add, edit, activate or deactivate, and manage each company’s supervisor roster.',
  },
  users: {
    title: 'User Management',
    icon: 'person-add-outline',
    iconFocused: 'person-add',
    module: 'Module 13 — User Management',
    description: 'Search accounts, create and edit users, and activate or deactivate them.',
  },
  criteria: {
    title: 'Evaluation Criteria',
    icon: 'list-outline',
    iconFocused: 'list',
    module: 'Module 12 — Evaluation Criteria',
    description: 'Manage the categories and criteria supervisors rate students on.',
  },
  'attendance-monitoring': {
    title: 'Attendance Monitoring',
    icon: 'calendar-outline',
    iconFocused: 'calendar',
    module: 'Module 10 — Attendance Monitoring',
    description: "Each student's attendance log with photo and location evidence.",
    byRole: {
      [ROLE_COORDINATOR]: { description: "Each student's attendance log with photo and location evidence (view only)." },
      [ROLE_ADMIN]: { description: "Each student's attendance log with evidence, manual entries and required hours." },
    },
  },
  progress: {
    title: 'Progress Monitoring',
    icon: 'trending-up-outline',
    iconFocused: 'trending-up',
    module: 'Module 10 — Progress Monitoring',
    description: 'Rendered vs required hours for every student.',
  },
  notifications: {
    title: 'Notifications',
    icon: 'notifications-outline',
    iconFocused: 'notifications',
    // Same subtitle as the website's Notifications page.
    description: 'Stay on top of approvals, reviews, and assignment updates',
  },
  analytics: {
    // The website's Dashboard "Analytics" tab; here its own screen, opened from Home.
    title: 'Analytics',
    icon: 'bar-chart-outline',
    iconFocused: 'bar-chart',
    description: 'Charts for internships, attendance, evaluations and reports.',
    byRole: {
      [ROLE_SUPERVISOR]: { description: 'Charts for your students: internships, attendance, evaluations and reports.' },
    },
  },
  profile: {
    title: 'Profile',
    icon: 'person-circle-outline',
    iconFocused: 'person-circle',
    description: 'Your account details and log out.',
  },
  more: {
    title: 'More',
    icon: 'menu-outline',
    iconFocused: 'menu',
    description: 'Everything else you can use in SIMS.',
  },
};

export function featureInfo(key: FeatureKey, roleId: RoleId | null | undefined): FeatureInfo {
  const { byRole, ...base } = CATALOG[key];
  return { ...base, ...(roleId ? byRole?.[roleId] : undefined) };
}

// ---------------------------------------------------------------------------
// Who can use what (same as the website's access table).
// ---------------------------------------------------------------------------

function flag(staff: StaffPermissions | null, name: keyof StaffPermissions): boolean {
  return staff?.[name] === true;
}

export function canUse(key: FeatureKey, me: MeResponse): boolean {
  const role = me.user.role_id;
  const student = role === ROLE_STUDENT;
  const supervisor = role === ROLE_SUPERVISOR;
  const staff = role === ROLE_COORDINATOR || role === ROLE_ADMIN ? me.staff : null;
  const isStaff = staff !== null;

  switch (key) {
    case 'home':
    case 'notifications':
    case 'profile':
      return student || supervisor || isStaff;
    case 'attendance':
    case 'my-reports':
    case 'feedback':
      return student;
    case 'approvals':
      return supervisor || flag(staff, 'can_approve_attendance');
    case 'students':
      return supervisor || flag(staff, 'can_assign_internships');
    case 'companies':
      return flag(staff, 'can_manage_companies');
    case 'users':
      return flag(staff, 'can_manage_users');
    case 'criteria':
      return flag(staff, 'can_manage_criteria');
    // Viewing needs no flag for staff; write actions inside are gated by flags in their modules.
    case 'evaluations':
    case 'report-reviews':
    case 'attendance-monitoring':
    case 'progress':
    case 'analytics':
      return supervisor || isStaff;
    case 'more':
      return isStaff;
  }
}

// ---------------------------------------------------------------------------
// Navigation per role.
// ---------------------------------------------------------------------------

/** Preferred bottom tabs per role, in order. Unavailable ones are dropped. */
const TABS_BY_ROLE: Record<RoleId, FeatureKey[]> = {
  [ROLE_STUDENT]: ['home', 'attendance', 'my-reports', 'feedback', 'profile'],
  [ROLE_SUPERVISOR]: ['home', 'approvals', 'students', 'evaluations', 'profile'],
  [ROLE_COORDINATOR]: ['home', 'students', 'report-reviews', 'companies', 'more'],
  [ROLE_ADMIN]: ['home', 'approvals', 'students', 'companies', 'more'],
};

/** Everything the More screen may list, in order. Anything already a tab is skipped. */
const MORE_ORDER: FeatureKey[] = [
  'users',
  'report-reviews',
  'students',
  'companies',
  'approvals',
  'evaluations',
  'criteria',
  'attendance-monitoring',
  'progress',
  'notifications',
  'profile',
];

const GROUP_BY_ROLE: Record<RoleId, NavGroup> = {
  [ROLE_STUDENT]: 'student',
  [ROLE_SUPERVISOR]: 'supervisor',
  [ROLE_COORDINATOR]: 'staff',
  [ROLE_ADMIN]: 'staff',
};

/** Route of each feature as a bottom tab, per group. */
const TAB_HREF: Record<NavGroup, Partial<Record<FeatureKey, Href>>> = {
  student: {
    home: '/student',
    attendance: '/student/attendance',
    'my-reports': '/student/reports',
    feedback: '/student/feedback',
    profile: '/student/profile',
  },
  supervisor: {
    home: '/supervisor',
    approvals: '/supervisor/approvals',
    students: '/supervisor/students',
    evaluations: '/supervisor/evaluations',
    profile: '/supervisor/profile',
  },
  staff: {
    home: '/staff',
    approvals: '/staff/approvals',
    students: '/staff/students',
    'report-reviews': '/staff/report-reviews',
    companies: '/staff/companies',
    more: '/staff/more',
  },
};

/** Route of each feature opened from the More screen (pushed inside the More tab's stack). */
const MORE_HREF: Partial<Record<FeatureKey, Href>> = {
  users: '/staff/more/users',
  'report-reviews': '/staff/more/report-reviews',
  students: '/staff/more/students',
  companies: '/staff/more/companies',
  approvals: '/staff/more/approvals',
  evaluations: '/staff/more/evaluations',
  criteria: '/staff/more/criteria',
  'attendance-monitoring': '/staff/more/attendance-monitoring',
  progress: '/staff/more/progress',
  // The one Notifications screen (src/app/notifications.tsx), also opened by the header bell.
  notifications: '/notifications',
  profile: '/staff/more/profile',
};

/**
 * Screens in the root stack, above every role's tabs (src/app/<name>.tsx), reached the same way
 * from any group. Each is mounted only for users who canUse() it (src/app/_layout.tsx).
 */
const ROOT_HREF: Partial<Record<FeatureKey, Href>> = {
  analytics: '/analytics',
};

export interface NavItem extends FeatureInfo {
  key: FeatureKey;
  href: Href;
}

export interface Navigation {
  roleId: RoleId;
  group: NavGroup;
  /** Where the app opens after login. */
  home: Href;
  /** Bottom tabs, in order (at most 5). */
  tabs: NavItem[];
  /** Items listed on the More screen (staff only; empty otherwise). */
  more: NavItem[];
  /** Feature keys reachable at all (tabs + more); used to guard routes. */
  allowed: ReadonlySet<FeatureKey>;
}

export function isKnownRole(roleId: unknown): roleId is RoleId {
  return roleId === ROLE_STUDENT || roleId === ROLE_COORDINATOR || roleId === ROLE_SUPERVISOR || roleId === ROLE_ADMIN;
}

/** Navigation for a signed-in user, or null for a role the app doesn't know. */
export function navigationFor(me: MeResponse | null | undefined): Navigation | null {
  if (!me || !isKnownRole(me.user.role_id)) return null;
  const roleId = me.user.role_id;
  const group = GROUP_BY_ROLE[roleId];

  const item = (key: FeatureKey, href: Href): NavItem => ({ key, href, ...featureInfo(key, roleId) });

  const tabs = TABS_BY_ROLE[roleId]
    .filter((key) => canUse(key, me) && TAB_HREF[group][key])
    .map((key) => item(key, TAB_HREF[group][key]!));
  const tabKeys = new Set(tabs.map((t) => t.key));

  const more = tabKeys.has('more')
    ? MORE_ORDER.filter((key) => !tabKeys.has(key) && canUse(key, me) && MORE_HREF[key]).map((key) =>
        item(key, MORE_HREF[key]!),
      )
    : [];

  return {
    roleId,
    group,
    home: TAB_HREF[group].home!,
    tabs,
    more,
    allowed: new Set<FeatureKey>([...tabKeys, ...more.map((m) => m.key)]),
  };
}

// ---------------------------------------------------------------------------
// Opening a feature from elsewhere (notification taps now; push taps in Module 16).
// ---------------------------------------------------------------------------

/**
 * Features a group has no screen of its own for, shown inside another of its screens instead
 * (`query` picks the view there). Supervisors have no More: their Attendance Monitoring tab
 * ("students") also has the Progress Monitoring view and, view only, their students' reports
 * (Modules 10/11).
 */
const HOSTED_IN: Record<NavGroup, Partial<Record<FeatureKey, { host: FeatureKey; query?: string }>>> = {
  student: {},
  supervisor: {
    'attendance-monitoring': { host: 'students', query: 'view=attendance' },
    progress: { host: 'students', query: 'view=progress' },
    'report-reviews': { host: 'students' },
  },
  staff: {},
};

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATALOG, value);
}

/**
 * The route where this user opens a feature (its tab, its More item, or the screen hosting it),
 * or null if the role can't use it or the app has no screen for it. Never returns a route that
 * isn't in the user's own navigation.
 */
export function hrefForFeature(key: string, me: MeResponse | null | undefined): Href | null {
  const navigation = navigationFor(me);
  if (!me || !navigation || !isFeatureKey(key) || key === 'more' || !canUse(key, me)) return null;

  const find = (k: FeatureKey) => navigation.tabs.find((t) => t.key === k) ?? navigation.more.find((m) => m.key === k);
  const direct = find(key);
  if (direct) return direct.href;
  const root = ROOT_HREF[key];
  if (root) return root;
  const hosted = HOSTED_IN[navigation.group][key];
  const hostHref = hosted ? find(hosted.host)?.href : undefined;
  if (!hosted || typeof hostHref !== 'string') return null;
  return (hosted.query ? `${hostHref}?${hosted.query}` : hostHref) as Href;
}
