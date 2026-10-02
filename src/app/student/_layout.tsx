import { RoleTabs } from '@/components/RoleTabs';

/** Student (role 1) tabs; which ones show comes from src/navigation/access.ts. */
export default function StudentLayout() {
  return (
    <RoleTabs
      routes={[
        { name: 'index', feature: 'home' },
        { name: 'attendance', feature: 'attendance' },
        { name: 'reports', feature: 'my-reports' },
        { name: 'feedback', feature: 'feedback' },
        { name: 'profile', feature: 'profile' },
      ]}
    />
  );
}
