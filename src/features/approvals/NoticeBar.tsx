import { useEffect } from 'react';
import { Pressable } from 'react-native';

import { Banner } from '@/components/ui/Banner';

import type { Notice } from './useApprovalActions';

const SUCCESS_MS = 4000;

/**
 * The result of an approve / reject, floating at the bottom of the screen (the website's flash
 * message, placed where the thumb just was). Success hides itself after 4 s; errors stay until tapped.
 */
export function NoticeBar({ notice, onDismiss, bottom = 16 }: { notice: Notice | null; onDismiss: () => void; bottom?: number }) {
  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const timer = setTimeout(onDismiss, SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityHint="Dismisses this message"
      className="absolute left-4 right-4"
      style={{ bottom, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
      <Banner tone={notice.tone} message={notice.message} />
    </Pressable>
  );
}
