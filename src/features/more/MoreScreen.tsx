import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth, useNavigationAccess } from '@/auth/AuthProvider';
import { Card } from '@/components/ui/Card';
import { colors } from '@/theme/colors';

/** "More" tab for Coordinators and Administrators: the features that aren't bottom tabs. */
export function MoreScreen() {
  const { user } = useAuth();
  const navigation = useNavigationAccess();

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="gap-3 p-4 pb-10">
      {user ? (
        <Text className="px-1 text-sm text-slate-500">
          Signed in as <Text className="font-semibold text-slate-700">{user.name}</Text> · {user.role}
        </Text>
      ) : null}

      <Card className="p-0">
        {navigation.more.map((item, index) => (
          <Link key={item.key} href={item.href} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.title}
              className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-slate-50 ${
                index < navigation.more.length - 1 ? 'border-b border-slate-100' : ''
              }`}>
              <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                <Ionicons name={item.icon} size={20} color={colors.brand700} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-slate-900">{item.title}</Text>
                {item.module ? <Text className="text-xs text-slate-400">{item.module}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
            </Pressable>
          </Link>
        ))}
      </Card>
    </ScrollView>
  );
}
