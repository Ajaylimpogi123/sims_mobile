import { RoleTabs } from '@/components/RoleTabs';

/**
 * Coordinator (role 2) and Administrator (role 4) tabs. Every possible staff tab is listed here
 * in display order; which ones show comes from src/navigation/access.ts (role + /me staff flags):
 * Coordinator: Home, Students, Reports, Companies, More · Admin: Home, Approvals, Students, Companies, More.
 */
export default function StaffLayout() {
  return (
    <RoleTabs
      routes={[
        { name: 'index', feature: 'home' },
        { name: 'approvals', feature: 'approvals' },
        { name: 'students', feature: 'students' },
        { name: 'report-reviews', feature: 'report-reviews' },
        { name: 'companies', feature: 'companies' },
        { name: 'more', feature: 'more', headerShown: false },
      ]}
    />
  );
}
