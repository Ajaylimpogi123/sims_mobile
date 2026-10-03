import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isNoStudentProfile, ruleRefusalToday, useAttendanceToday, useSubmitAttendance } from '@/api/attendance';
import { MESSAGES, toApiError, type ApiError } from '@/api/errors';
import type { AttendanceAction } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';

import { setAttendanceFlash } from './flash';
import { LocationPanel } from './LocationPanel';
import { PermissionPrimer } from './PermissionPrimer';
import { preparePhoto, type PreparedPhoto } from './photo';
import { useCapturePermissions } from './useCapturePermissions';
import { useLocationFix } from './useLocationFix';

/** Same titles, descriptions and submit labels as the website's CaptureDialog. */
export const CAPTURE_MODES: Record<AttendanceAction, { title: string; description: string; submitLabel: string }> = {
  time_in: {
    title: 'Time In',
    description: 'Take a photo of yourself and share your current location to record your time in.',
    submitLabel: 'Submit Time In',
  },
  time_out: {
    title: 'Time Out',
    description: 'Take a photo of yourself and share your current location to record your time out.',
    submitLabel: 'Submit Time Out',
  },
  emergency_time_out: {
    title: 'Emergency Time Out',
    description:
      'Explain the emergency, take a photo of yourself, and share your current location. Your supervisor will review it.',
    submitLabel: 'Submit Emergency Time Out',
  },
};

const CAMERA_MESSAGES = {
  mountError: "The camera couldn't be started. Close other apps that are using the camera, then press Try again.",
  captureError: "The photo couldn't be taken. Press Take photo again.",
} as const;

const KEPT_EVIDENCE = 'Your photo and location are kept, so you can submit again.';

export function isAttendanceAction(value: unknown): value is AttendanceAction {
  return value === 'time_in' || value === 'time_out' || value === 'emergency_time_out';
}

/** Route entry: /attendance-capture?action=time_in|time_out|emergency_time_out */
export function CaptureScreen() {
  const { action } = useLocalSearchParams<{ action?: string }>();
  const router = useRouter();

  if (!isAttendanceAction(action)) {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title: 'My Attendance' }} />
        <Banner message="That attendance action doesn't exist." />
        <Button label="Back to My Attendance" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }
  return <Capture key={action} action={action} />;
}

function Capture({ action }: { action: AttendanceAction }) {
  const mode = CAPTURE_MODES[action];
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const permissions = useCapturePermissions();
  const [requesting, setRequesting] = useState(false);
  const today = useAttendanceToday();
  const location = useLocationFix();
  const submit = useSubmitAttendance();

  const camera = useRef<CameraView>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [note, setNote] = useState('');
  const [submitError, setSubmitError] = useState<ApiError | null>(null);

  // Start the GPS as soon as location is allowed, while the student lines up the photo.
  const locationAllowed = permissions.location === 'granted';
  const locationStatus = location.state.status;
  const startLocation = location.start;
  useEffect(() => {
    if (locationAllowed && locationStatus === 'idle') void startLocation();
  }, [locationAllowed, locationStatus, startLocation]);

  // Back from turning Location on in Settings: try again by itself.
  useEffect(() => {
    if (locationStatus !== 'off') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void startLocation();
    });
    return () => sub.remove();
  }, [locationStatus, startLocation]);

  // Don't let Back or a swipe abandon an upload half-way. A ref, not state: on success the screen
  // closes before React re-renders, and the listener must already see the upload as finished.
  const submitting = submit.isPending;
  const uploading = useRef(false);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (uploading.current) event.preventDefault();
      }),
    [navigation],
  );

  const requestPermissions = async () => {
    setRequesting(true);
    try {
      await permissions.request();
    } finally {
      setRequesting(false);
    }
  };

  if (!permissions.allGranted) {
    return (
      <>
        <Stack.Screen options={{ title: mode.title }} />
        <PermissionPrimer
          camera={permissions.camera}
          location={permissions.location}
          onRequest={() => void requestPermissions()}
          requesting={requesting}
        />
      </>
    );
  }

  const takePhoto = async () => {
    if (!camera.current || capturing) return;
    setCapturing(true);
    setCameraError(null);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.9 });
      if (!picture) throw new Error('No picture');
      setPhoto(await preparePhoto(picture));
      setCameraReady(false); // the camera unmounts while the preview shows
    } catch {
      setCameraError(CAMERA_MESSAGES.captureError);
    } finally {
      setCapturing(false);
    }
  };

  const retake = () => {
    setPhoto(null);
    setCameraError(null);
    setSubmitError(null);
  };

  const restartCamera = () => {
    setCameraError(null);
    setCameraReady(false);
    setCameraKey((key) => key + 1);
  };

  // What the server says about this action today (null until loaded; the server re-checks on submit anyway).
  const noProfile = isNoStudentProfile(today.error);
  const actionState = today.data?.actions[action];
  const refusedReason = actionState && !actionState.allowed ? actionState.reason : null;

  const fix = location.state.status === 'ready' ? location.state.fix : null;
  const noteMissing = action === 'emergency_time_out' && note.trim() === '';
  const canSubmit = !!photo && !!fix && !noteMissing && !refusedReason && !noProfile && !submitting;

  const doSubmit = () => {
    if (!photo || !fix || !canSubmit || uploading.current) return;
    uploading.current = true;
    setSubmitError(null);
    submit.mutate(
      {
        action,
        photoUri: photo.uri,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        mocked: fix.mocked,
        note: action === 'emergency_time_out' ? note.trim() : undefined,
      },
      {
        onSuccess: (response) => {
          uploading.current = false;
          setAttendanceFlash(response.message);
          router.back();
        },
        onError: (error) => {
          uploading.current = false;
          const apiError = toApiError(error);
          // A state-rule refusal updates today, which shows its reason above; 401 is handled app-wide.
          if (ruleRefusalToday(apiError) || apiError.endsSession) return;
          setSubmitError(apiError);
        },
      },
    );
  };

  const fieldErrors = submitError?.kind === 'validation' ? submitError.fieldErrors : {};
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const submitMessage = submitError
    ? hasFieldErrors
      ? MESSAGES.validation
      : submitError.kind === 'network' || submitError.kind === 'timeout'
        ? `${submitError.message} ${KEPT_EVIDENCE}`
        : submitError.message
    : null;

  const waitingFor = !photo
    ? null
    : !fix
      ? location.state.status === 'locating' || location.state.status === 'idle'
        ? 'Waiting for your location…'
        : 'Your location is needed to submit.'
      : noteMissing
        ? 'Describe the emergency to submit.'
        : null;

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-50" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: mode.title, gestureEnabled: !submitting, headerBackVisible: !submitting }} />
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-4 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="text-sm leading-5 text-gray-600">{mode.description}</Text>

        {noProfile ? <Banner tone="warning" message={toApiError(today.error).message} /> : null}
        {refusedReason ? <Banner message={refusedReason} /> : null}
        {submitMessage ? <Banner message={submitMessage} /> : null}

        {action === 'emergency_time_out' ? (
          <TextField
            label="What happened?"
            placeholder="Explain the emergency..."
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            multiline
            editable={!submitting}
            error={fieldErrors.note}
          />
        ) : null}

        {/* Photo: live front camera only, no gallery. */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Photo</Text>
          <View className="aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-black">
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
                accessibilityLabel="Captured photo"
              />
            ) : cameraError && !cameraReady ? (
              <Text className="px-4 text-center text-sm text-white/80">Camera unavailable</Text>
            ) : (
              <>
                <CameraView
                  key={cameraKey}
                  ref={camera}
                  facing="front"
                  style={{ width: '100%', height: '100%' }}
                  onCameraReady={() => setCameraReady(true)}
                  onMountError={() => {
                    setCameraReady(false);
                    setCameraError(CAMERA_MESSAGES.mountError);
                  }}
                />
                {!cameraReady ? (
                  <View className="absolute inset-0 flex-row items-center justify-center gap-2">
                    <ActivityIndicator size="small" color="#ffffffcc" />
                    <Text className="text-sm text-white/80">Starting camera…</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
          {cameraError ? <Banner message={cameraError} /> : null}
          {photo ? (
            <Button label="Retake" icon="refresh" variant="outline" onPress={retake} disabled={submitting} />
          ) : cameraError && !cameraReady ? (
            <Button label="Try again" icon="refresh" variant="outline" onPress={restartCamera} />
          ) : null}
          {fieldErrors.photo ? <Text className="text-sm text-red-600">{fieldErrors.photo}</Text> : null}
        </View>

        <LocationPanel
          state={location.state}
          onRetry={() => void location.start()}
          approximateOnly={permissions.approximateOnly}
          disabled={submitting}
          fieldErrors={[fieldErrors.latitude, fieldErrors.longitude, fieldErrors.accuracy, fieldErrors.mocked].filter(
            (message): message is string => !!message,
          )}
        />
      </ScrollView>

      {/* Thumb-zone action: Take photo first, then Submit. */}
      <View className="gap-2 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        {waitingFor && !refusedReason && !noProfile ? (
          <Text className="text-center text-sm text-gray-600" accessibilityLiveRegion="polite">
            {waitingFor}
          </Text>
        ) : null}
        {photo ? (
          <Button
            label={mode.submitLabel}
            variant={action === 'emergency_time_out' ? 'destructive' : 'primary'}
            onPress={doSubmit}
            disabled={!canSubmit}
            loading={submitting}
            loadingLabel="Submitting…"
          />
        ) : (
          <Button
            label="Take photo"
            icon="camera-outline"
            onPress={() => void takePhoto()}
            disabled={!cameraReady || !!refusedReason || noProfile}
            loading={capturing}
            loadingLabel="Taking photo…"
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
