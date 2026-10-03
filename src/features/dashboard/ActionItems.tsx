import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import type { ActionItem, MeResponse } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { hrefForTarget, openHref } from '@/navigation/targets';
import { colors } from '@/theme/colors';

/** The website's "Alerts & Action Items" card. Rows with a target this role can open are tappable. */
export function ActionItems({ items, me }: { items: ActionItem[]; me: MeResponse | null }) {
  return (
    <Card title="Alerts & Action Items">
      {items.length === 0 ? (
        <EmptyState icon="warning-outline" title="Nothing needs your attention" message="You're all caught up." />
      ) : (
        <View>
          {items.map((item, index) => {
            const href = hrefForTarget(item.target, me);
            const content = (
              <>
                <Ionicons name="warning" size={18} color={colors.amber500} />
                <Text className="flex-1 text-sm text-gray-900">{item.label}</Text>
                {href ? <Ionicons name="chevron-forward" size={16} color={colors.gray400} /> : null}
              </>
            );
            const row = `min-h-12 flex-row items-center gap-3 py-3 ${index > 0 ? 'border-t border-gray-100' : ''}`;
            return href ? (
              <Pressable
                key={item.key}
                onPress={() => openHref(href)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                className={`${row} active:bg-gray-50`}>
                {content}
              </Pressable>
            ) : (
              <View key={item.key} className={row} accessible accessibilityLabel={item.label}>
                {content}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
