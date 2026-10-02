import type { ReactNode } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { featureInfo, type FeatureKey } from '@/navigation/access';

import { PlaceholderScreen } from './PlaceholderScreen';

/** Placeholder for a feature whose module isn't built yet; text comes from the navigation catalog. */
export function FeaturePlaceholder({ feature, header }: { feature: FeatureKey; header?: ReactNode }) {
  const { user } = useAuth();
  const info = featureInfo(feature, user?.role_id);
  return (
    <PlaceholderScreen
      header={header}
      icon={info.icon}
      title={info.title}
      module={info.module ?? 'a later module'}
      description={info.description}
    />
  );
}
