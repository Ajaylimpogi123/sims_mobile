import { HomeGreeting } from '@/components/HomeGreeting';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function SupervisorHome() {
  return (
    <PlaceholderScreen
      header={<HomeGreeting />}
      icon="speedometer-outline"
      title="Dashboard"
      module="Module 9 — Supervisor Dashboard"
      description="Your students at a glance: pending approvals, attendance today and hours progress."
    />
  );
}
