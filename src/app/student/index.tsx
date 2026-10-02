import { HomeGreeting } from '@/components/HomeGreeting';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function StudentHome() {
  return (
    <PlaceholderScreen
      header={<HomeGreeting />}
      icon="speedometer-outline"
      title="Dashboard"
      module="Module 5 — Student Dashboard"
      description="Your internship status, company, supervisor, rendered and remaining hours, today's attendance and recent reports."
    />
  );
}
