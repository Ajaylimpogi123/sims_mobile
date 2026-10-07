import { View } from 'react-native';

import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';

/** Dashboard loading state: a KPI grid (staff, supervisors) or the hours card (students), then list cards. */
export function DashboardSkeleton({ grid = true }: { grid?: boolean }) {
  return (
    <SkeletonPulse label="Loading dashboard">
      <View className="gap-4">
        {grid ? (
          <View className="-m-1.5 flex-row flex-wrap">
            {[0, 1, 2, 3].map((i) => (
              <View key={i} className="w-1/2 p-1.5">
                <View className="gap-3 rounded-xl border border-gray-200 bg-white p-4">
                  <SkeletonBlock className="h-9 w-9 rounded-lg" />
                  <SkeletonBlock className="h-3 w-2/3" />
                  <SkeletonBlock className="h-6 w-1/3" />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-8 w-1/2" />
            <SkeletonBlock className="h-2 w-full rounded-full" />
          </View>
        )}
        {[0, 1].map((i) => (
          <View key={i} className="gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <SkeletonBlock className="h-4 w-1/2" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-5/6" />
            <SkeletonBlock className="h-3 w-2/3" />
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}
