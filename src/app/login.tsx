import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { rateLimitMessage, toApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/theme/colors';

type Field = 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

/** Seconds left until `until` (epoch ms), ticking every second. */
function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

export default function LoginScreen() {
  const { signIn, notice, clearNotice } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const secondsLocked = useCountdown(lockedUntil);
  const locked = secondsLocked > 0;

  const submit = async () => {
    if (submitting || locked) return;

    // Quick required-field check so an empty tap doesn't use one of the 5 login attempts per minute.
    // The server still validates everything.
    const missing: FieldErrors = {};
    if (!email.trim()) missing.email = 'Enter your email address.';
    if (!password) missing.password = 'Enter your password.';
    setFormError(null);
    clearNotice();
    setFieldErrors(missing);
    if (missing.email || missing.password) return;

    setSubmitting(true);
    try {
      await signIn(email, password);
      // Navigation happens automatically once the auth state changes.
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.kind === 'validation') {
        const { email: emailError, password: passwordError, ...others } = apiError.fieldErrors;
        setFieldErrors({ email: emailError, password: passwordError });
        const other = Object.values(others)[0];
        if (other) setFormError(other);
        else if (!emailError && !passwordError) setFormError(apiError.message);
      } else if (apiError.kind === 'rate_limited') {
        setLockedUntil(Date.now() + (apiError.retryAfterSeconds ?? 60) * 1000);
        setFormError(null);
      } else {
        setFormError(apiError.message);
      }
      setSubmitting(false);
    }
  };

  const banner = locked ? rateLimitMessage(secondsLocked) : formError ?? notice;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled">
          <View className="items-center">
            <Image
              source={require('@/assets/images/bcc-logo.png')}
              style={{ width: 112, height: 112 }}
              contentFit="contain"
              accessibilityLabel="Bacolod City College logo"
            />
            <Text className="mt-4 text-3xl font-bold text-brand-800">SIMS</Text>
            <Text className="mt-1 text-center text-sm text-gray-500">Student Internship Management System</Text>
            <Text className="text-center text-sm font-medium text-brand-700">Bacolod City College</Text>
          </View>

          <View className="mt-10 gap-4">
            <Text className="text-xl font-semibold text-gray-900">Log in</Text>

            {banner ? <Banner message={banner} tone={locked ? 'warning' : 'error'} /> : null}

            <TextField
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: undefined }));
              }}
              error={fieldErrors.email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!submitting}
            />

            <TextField
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
              }}
              error={fieldErrors.password}
              placeholder="Your password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              editable={!submitting}
              right={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.gray500} />
                </Pressable>
              }
            />

            <Button
              label={locked ? `Try again in ${secondsLocked}s` : 'Log in'}
              onPress={() => void submit()}
              loading={submitting}
              loadingLabel="Logging in…"
              disabled={locked}
              className="mt-2"
            />
          </View>

          <Text className="mt-8 text-center text-xs leading-5 text-gray-400">
            Use the same account you use on the SIMS website.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
