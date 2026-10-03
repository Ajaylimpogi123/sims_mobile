import { View } from 'react-native';

import { Banner } from './Banner';
import { Button } from './Button';

/** A failed load with nothing to show: the error message and Try again. */
export function ErrorState({ message, onRetry, retrying = false }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <View className="gap-3">
      <Banner message={message} />
      <Button label="Try again" variant="outline" onPress={onRetry} loading={retrying} loadingLabel="Trying again…" />
    </View>
  );
}
