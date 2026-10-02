import { RoleTabs } from '@/components/RoleTabs';

/** Student (role 1) tabs. */
export default function StudentLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Home', icon: 'home-outline', iconFocused: 'home' },
        { name: 'attendance', title: 'Attendance', icon: 'time-outline', iconFocused: 'time' },
        { name: 'reports', title: 'Reports', icon: 'document-text-outline', iconFocused: 'document-text' },
        { name: 'feedback', title: 'Feedback', icon: 'chatbox-ellipses-outline', iconFocused: 'chatbox-ellipses' },
        { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
      ]}
    />
  );
}
