import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/errors';
import type { ManagedUser, RoleOption } from '@/api/types';
import { USER_EMAIL_MAX, USER_NAME_MAX, useCreateUser, userFromLists, userKeys, useUpdateUser, useUser, useUserRoles, type UserInput } from '@/api/users';
import { notifySessionEnded } from '@/auth/session-events';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/theme/colors';

import { USER_NOT_FOUND } from './UserDetailScreen';
import { setUserDetailFlash, setUsersFlash } from './flash';
import { Text, TextInput } from '@/components/ui/Text';

type Field = keyof UserInput;
const FIELDS: Field[] = ['name', 'email', 'role_id', 'password', 'password_confirmation'];

/** Laravel's wording for the same rules (the server's message wins when it answers). */
const RULE_MESSAGES = {
  name: 'The name field is required.',
  email: 'The email field is required.',
  role: 'The role id field is required.',
  password: 'The password field is required.',
  passwordMin: 'The password field must be at least 8 characters.',
  confirmation: 'The password field confirmation does not match.',
} as const;

const SELF_SIGNED_OUT = 'Your account was updated. Please log in again.';

// ---------------------------------------------------------------------------
// Role picker (website: the Role <select>), limited to the roles the API allows
// ---------------------------------------------------------------------------

function RolePicker({
  roles,
  value,
  onChange,
  error,
  disabled,
}: {
  roles: RoleOption[];
  value: number | null;
  onChange: (id: number) => void;
  error?: string;
  disabled: boolean;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">Role</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Role" className={`overflow-hidden rounded-xl border bg-white ${error ? 'border-red-500' : 'border-gray-300'}`}>
        {roles.map((role, index) => {
          const selected = role.id === value;
          return (
            <Pressable
              key={role.id}
              onPress={() => onChange(role.id)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={role.role_name}
              accessibilityState={{ checked: selected, disabled }}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              className={`min-h-12 flex-row items-center gap-3 px-3 py-3 ${index > 0 ? 'border-t border-gray-200' : ''}`}>
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.brand700 : colors.gray400} />
              <Text className={`flex-1 text-base ${selected ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{role.role_name}</Text>
            </Pressable>
          );
        })}
        {roles.length === 0 ? <Text className="px-3 py-3 text-sm text-gray-500">No roles available.</Text> : null}
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}

function FormSkeleton() {
  return (
    <SkeletonPulse label="Loading form">
      <View className="gap-5 p-4">
        {[0, 1, 2].map((i) => (
          <View key={i} className="gap-2">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-12 w-full rounded-xl" />
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// Screen: loads what the form needs, then mounts it with fixed starting values
// ---------------------------------------------------------------------------

/**
 * User Registration (create) and Edit User (website: RegistrationForm / EditModal): Name, Email,
 * Role, Password + Confirm Password. Create needs a password; edit keeps the current one when it's
 * left blank. Roles come from the API (create_roles / the user's assignable_roles).
 */
export function UserFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = params.id !== undefined;
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const title = editing ? 'Edit User' : 'User Registration';

  // Edit: the cached account at once, then the fresh one (the form only reads it when it mounts).
  const [cached] = useState<ManagedUser | undefined>(() =>
    id === null ? undefined : (queryClient.getQueryData<ManagedUser>(userKeys.detail(id)) ?? userFromLists(queryClient, id)),
  );
  const userQuery = useUser(editing ? id : null);
  const rolesQuery = useUserRoles(!editing);

  if (editing) {
    const error = userQuery.isError ? toApiError(userQuery.error) : null;
    const user = userQuery.data ?? cached;
    if (id === null || error?.kind === 'not_found') {
      return <Gone title={title} onBack={() => router.back()} />;
    }
    if (!user) {
      return (
        <View className="flex-1 bg-gray-50">
          <Stack.Screen options={{ title }} />
          {error ? (
            <View className="p-4">
              <ErrorState message={error.message} onRetry={() => void userQuery.refetch()} retrying={userQuery.isFetching} />
            </View>
          ) : (
            <FormSkeleton />
          )}
        </View>
      );
    }
    if (!user.can_edit) {
      return (
        <View className="flex-1 gap-3 bg-gray-50 p-4">
          <Stack.Screen options={{ title }} />
          <EmptyState icon="lock-closed-outline" message="You can't edit this account." />
          <Button label="Back" variant="outline" onPress={() => router.back()} />
        </View>
      );
    }
    return <UserForm key={user.id} title={title} user={user} roles={user.assignable_roles} />;
  }

  if (!rolesQuery.data) {
    return (
      <View className="flex-1 bg-gray-50">
        <Stack.Screen options={{ title }} />
        {rolesQuery.isError ? (
          <View className="p-4">
            <ErrorState message={toApiError(rolesQuery.error).message} onRetry={() => void rolesQuery.refetch()} retrying={rolesQuery.isFetching} />
          </View>
        ) : (
          <FormSkeleton />
        )}
      </View>
    );
  }
  return <UserForm title={title} user={null} roles={rolesQuery.data.create_roles} />;
}

function Gone({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="flex-1 gap-3 bg-gray-50 p-4">
      <Stack.Screen options={{ title }} />
      <EmptyState icon="alert-circle-outline" message={USER_NOT_FOUND} />
      <Button label="Back" variant="outline" onPress={onBack} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function UserForm({ title, user, roles }: { title: string; user: ManagedUser | null; roles: RoleOption[] }) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const editing = user !== null;

  const [start] = useState<UserInput>(() => ({
    name: user?.name ?? '',
    email: user?.email ?? '',
    // Keep the current role only if the API still lets this form pick it.
    role_id: user && roles.some((r) => r.id === user.role_id) ? user.role_id : null,
    password: '',
    password_confirmation: '',
  }));
  const [values, setValues] = useState<UserInput>(start);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const saved = useRef(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const create = useCreateUser();
  const update = useUpdateUser();

  const dirty = JSON.stringify(values) !== JSON.stringify(start);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (inFlight.current) {
          event.preventDefault();
          return;
        }
        if (saved.current || !dirtyRef.current) return;
        event.preventDefault();
        Alert.alert('Discard changes?', editing ? 'Your changes to this account will be lost.' : 'This user will not be registered.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
        ]);
      }),
    [navigation, editing],
  );

  const set = <K extends Field>(field: K, value: UserInput[K]) => {
    setValues((old) => ({ ...old, [field]: value }));
    setErrors((old) => (old[field] ? { ...old, [field]: undefined } : old));
  };

  /** Website edit form: the confirmation field appears once a new password is typed. */
  const showConfirmation = !editing || values.password !== '';

  const validate = () => {
    const found: Partial<Record<Field, string>> = {};
    if (!values.name.trim()) found.name = RULE_MESSAGES.name;
    if (!values.email.trim()) found.email = RULE_MESSAGES.email;
    if (values.role_id === null) found.role_id = RULE_MESSAGES.role;
    if (!editing && !values.password) found.password = RULE_MESSAGES.password;
    else if (values.password && values.password.length < 8) found.password = RULE_MESSAGES.passwordMin;
    if (values.password && values.password !== values.password_confirmation) found.password = found.password ?? RULE_MESSAGES.confirmation;
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  /** Editing yourself with a new role or password revokes this phone's token too (like the website's sessions). */
  const signsSelfOut = !!user?.is_self && (values.role_id !== user.role_id || values.password !== '');

  const send = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const response = user ? await update.mutateAsync({ id: user.id, input: values }) : await create.mutateAsync(values);
      saved.current = true;
      if (signsSelfOut) {
        // The server already revoked this token; leave cleanly instead of waiting for a 401.
        inFlight.current = false;
        notifySessionEnded(SELF_SIGNED_OUT);
        return;
      }
      setUsersFlash(response.message);
      if (user) setUserDetailFlash(response.message);
      router.back();
    } catch (error) {
      const apiError = toApiError(error);
      const fields: Partial<Record<Field, string>> = {};
      for (const field of FIELDS) {
        if (apiError.fieldErrors[field]) fields[field] = apiError.fieldErrors[field];
      }
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(apiError.kind === 'not_found' ? USER_NOT_FOUND : apiError.message);
      // Website create form: the password fields are cleared after a refused submit.
      else if (!editing) setValues((old) => ({ ...old, password: '', password_confirmation: '' }));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const submit = () => {
    if (inFlight.current || !validate()) return;
    if (signsSelfOut) {
      Alert.alert(
        'Update your own account?',
        values.role_id !== user?.role_id
          ? 'Changing your own role signs you out of the app. You will need to log in again.'
          : 'Setting a new password signs you out of the app. You will need to log in again with the new password.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Changes', onPress: () => void send() },
        ],
      );
      return;
    }
    void send();
  };

  const eye = (
    <Pressable
      onPress={() => setShowPassword((v) => !v)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.gray500} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title }} />
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
        {user ? <Text className="text-sm text-gray-600">Update account details for {user.name}</Text> : null}
        {formError ? <Banner tone="error" message={formError} /> : null}
        <TextField
          label="Name"
          value={values.name}
          onChangeText={(text) => set('name', text)}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          maxLength={USER_NAME_MAX}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          editable={!submitting}
          error={errors.name}
        />
        <TextField
          ref={emailRef}
          label="Email"
          value={values.email}
          onChangeText={(text) => set('email', text)}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={USER_EMAIL_MAX}
          editable={!submitting}
          error={errors.email}
        />
        <RolePicker roles={roles} value={values.role_id} onChange={(roleId) => set('role_id', roleId)} error={errors.role_id} disabled={submitting} />
        <View className="gap-1">
          <TextField
            ref={passwordRef}
            label={editing ? 'New Password' : 'Password'}
            value={values.password}
            onChangeText={(text) => set('password', text)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType={showConfirmation ? 'next' : 'done'}
            submitBehavior={showConfirmation ? 'submit' : 'blurAndSubmit'}
            onSubmitEditing={() => confirmRef.current?.focus()}
            editable={!submitting}
            error={errors.password}
            right={eye}
          />
          {editing ? <Text className="text-xs text-gray-500">Leave blank to keep the current password</Text> : null}
        </View>
        {showConfirmation ? (
          <TextField
            ref={confirmRef}
            label={editing ? 'Confirm New Password' : 'Confirm Password'}
            value={values.password_confirmation}
            onChangeText={(text) => set('password_confirmation', text)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            editable={!submitting}
            error={errors.password_confirmation}
          />
        ) : null}
      </ScrollView>
      <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button label="Cancel" variant="outline" onPress={() => router.back()} disabled={submitting} className="flex-1" />
        <Button
          label={editing ? 'Save Changes' : 'Register User'}
          onPress={submit}
          loading={submitting}
          loadingLabel="Saving…"
          className="flex-1"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
