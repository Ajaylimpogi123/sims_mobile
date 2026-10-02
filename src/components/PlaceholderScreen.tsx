import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

import { Card } from './ui/Card';

interface PlaceholderScreenProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** e.g. "Module 6 — Attendance" */
  module: string;
  description: string;
  /** Optional content above the placeholder card (e.g. a greeting). */
  header?: ReactNode;
}

/** Stand-in for a tab whose feature arrives in a later module. */
export function PlaceholderScreen({ icon, title, module, description, header }: PlaceholderScreenProps) {
  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="gap-4 p-4">
      {header}
      <Card className="items-center gap-3 py-10">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-50">
          <Ionicons name={icon} size={32} color={colors.brand700} />
        </View>
        <Text className="text-lg font-semibold text-gray-900">{title}</Text>
        <View className="rounded-full bg-brand-100 px-3 py-1">
          <Text className="text-xs font-semibold text-brand-800">Coming in {module}</Text>
        </View>
        <Text className="px-4 text-center text-sm leading-5 text-gray-500">{description}</Text>
      </Card>
    </ScrollView>
  );
}
