import { RoleTabs } from '@/components/RoleTabs';

/** Supervisor (role 3) tabs. */
export default function SupervisorLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Home', icon: 'home-outline', iconFocused: 'home' },
        { name: 'approvals', title: 'Approvals', icon: 'checkmark-done-circle-outline', iconFocused: 'checkmark-done-circle' },
        { name: 'students', title: 'Students', icon: 'people-outline', iconFocused: 'people' },
        { name: 'evaluations', title: 'Evaluations', icon: 'star-outline', iconFocused: 'star' },
        { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
      ]}
    />
  );
}
