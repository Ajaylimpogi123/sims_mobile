import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './Text';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Card header, like the website's CardTitle (section title). */
  title?: string;
  /** Muted line under the title, like CardDescription. */
  description?: string;
  /** Element on the right of the title row (e.g. a link or a badge). */
  right?: ReactNode;
}

export function Card({ children, className = '', title, description, right }: CardProps) {
  return (
    <View className={`rounded-2xl border border-gray-200 bg-white p-4 ${className}`}>
      {title ? (
        <View className="mb-3 flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text accessibilityRole="header" className="text-base font-semibold text-gray-900">
              {title}
            </Text>
            {description ? <Text className="text-sm text-gray-500">{description}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}
