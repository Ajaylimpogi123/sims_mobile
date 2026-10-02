import { RoleTabs } from '@/components/RoleTabs';

/** Supervisor (role 3) tabs; which ones show comes from src/navigation/access.ts. */
export default function SupervisorLayout() {
  return (
    <RoleTabs
      routes={[
        { name: 'index', feature: 'home' },
        { name: 'approvals', feature: 'approvals' },
        { name: 'students', feature: 'students' },
        { name: 'evaluations', feature: 'evaluations' },
        { name: 'profile', feature: 'profile' },
      ]}
    />
  );
}
