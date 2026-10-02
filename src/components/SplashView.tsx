import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

import { Banner } from './ui/Banner';
import { Button } from './ui/Button';

interface SplashViewProps {
  /** Shown instead of the spinner, e.g. "Can't reach the server". */
  error?: string | null;
  onRetry?: () => void;
  onSignOut?: () => void;
}

/**
 * In-app splash: matches the native splash (BCC logo on white) while the stored session
 * is checked with GET /me, and offers Retry / Log out if that check can't complete.
 */
export function SplashView({ error, onRetry, onSignOut }: SplashViewProps) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <View className="flex-1 items-center justify-center px-8">
        <Image
          source={require('@/assets/images/bcc-logo.png')}
          style={{ width: 160, height: 160 }}
          contentFit="contain"
          accessibilityLabel="Bacolod City College logo"
        />
        <Text className="mt-6 text-2xl font-bold text-brand-800">SIMS</Text>
        <Text className="mt-1 text-center text-sm text-slate-500">Student Internship Management System</Text>

        {error ? (
          <View className="mt-8 w-full gap-3">
            <Banner message={error} />
            {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
            {onSignOut ? <Button label="Log out" variant="outline" onPress={onSignOut} /> : null}
          </View>
        ) : (
          <View className="mt-8">
            <ActivityIndicator size="large" color={colors.brand700} accessibilityLabel="Loading" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
