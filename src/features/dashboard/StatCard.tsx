import Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { formatNumber, TABULAR } from '@/lib/format';
import { openHref } from '@/navigation/targets';
import { colors, kpiTones, type KpiTone } from '@/theme/colors';

export interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: KpiTone;
  /** % change vs last month (website: "↑ 12% vs last month"); null/undefined = not shown */
  trend?: number | null;
  trendLabel?: string;
  /** Where the card leads (null = not tappable); decided by src/navigation/access.ts. */
  href?: Href | null;
}

/** KPI card, the website's StatCard (components/StatCard.jsx) laid out for a 2-column phone grid. */
export function StatCard({ title, value, subtitle, icon, tone, trend, trendLabel, href }: StatCardProps) {
  const t = kpiTones[tone];
  const display = typeof value === 'number' ? formatNumber(value) : value;
  const hasTrend = trend !== null && trend !== undefined;
  const trendText = hasTrend ? `${formatNumber(Math.abs(trend), 1)}%${trendLabel ? ` ${trendLabel}` : ''}` : '';
  const label = [title, display, subtitle, hasTrend ? `${trend >= 0 ? 'up' : 'down'} ${trendText}` : null]
    .filter(Boolean)
    .join(', ');

  const body = (
    <>
      <View className="flex-row items-start justify-between">
        <View className={`h-9 w-9 items-center justify-center rounded-lg ${t.bg}`}>
          <Ionicons name={icon} size={18} color={t.icon} />
        </View>
        {href ? <Ionicons name="chevron-forward" size={16} color={colors.gray400} /> : null}
      </View>
      <Text className="mt-3 text-sm text-gray-600" numberOfLines={2}>
        {title}
      </Text>
      <Text
        className="mt-0.5 text-2xl font-semibold text-gray-900"
        style={TABULAR}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}>
        {display}
      </Text>
      {subtitle ? (
        <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={3}>
          {subtitle}
        </Text>
      ) : null}
      {hasTrend ? (
        <View className="mt-1 flex-row items-center gap-0.5">
          <Ionicons
            name={trend >= 0 ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={trend >= 0 ? colors.emerald600 : colors.red600}
          />
          <Text className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`} style={TABULAR}>
            {trendText}
          </Text>
        </View>
      ) : null}
    </>
  );

  const box = 'flex-1 rounded-2xl border border-gray-200 bg-white p-4';

  if (!href) {
    return (
      <View className={box} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => openHref(href)}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: 'rgba(0,0,0,0.06)', foreground: true }}
      className={`${box} overflow-hidden active:bg-gray-50`}>
      {body}
    </Pressable>
  );
}

/** Two cards per row; cards in a row share the taller one's height. */
export function KpiGrid({ items }: { items: (StatCardProps & { key: string })[] }) {
  return (
    <View className="-m-1.5 flex-row flex-wrap">
      {items.map(({ key, ...item }) => (
        <View key={key} className="w-1/2 p-1.5">
          <StatCard {...item} />
        </View>
      ))}
    </View>
  );
}
