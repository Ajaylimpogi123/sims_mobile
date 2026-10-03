import { router, type Href } from 'expo-router';

import type { MeResponse, NotificationTarget } from '@/api/types';

import { hrefForFeature } from './access';

/**
 * Route for a notification target, as this user may open it, or null when there's nowhere to go:
 * no target, a screen key this app version doesn't know, or one the role can't open
 * (decided by src/navigation/access.ts). `params` (e.g. { attendance_id: 12 }) become search
 * params, so the screen can highlight the record with useLocalSearchParams().
 */
export function hrefForTarget(target: NotificationTarget | null | undefined, me: MeResponse | null | undefined): Href | null {
  if (!target || typeof target.screen !== 'string') return null;
  const base = hrefForFeature(target.screen, me);
  if (!base || typeof base !== 'string') return null;

  const query = Object.entries(target.params ?? {})
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return (query ? `${base}?${query}` : base) as Href;
}

/**
 * Opens the screen a notification points to. Returns false (and stays put) when there's nowhere
 * the user may go. Notifications sits above the role's tabs, so this pops back to the tabs and
 * switches to the target instead of stacking a second copy of them; `withAnchor` keeps the More
 * list under a More screen so Back works.
 */
/** Opens a route from inside the role's tabs (switches tab, or pushes a More / root screen). */
export function openHref(href: Href | null): boolean {
  if (!href) return false;
  router.navigate(href, { withAnchor: true });
  return true;
}

/**
 * navigateToTarget() for screens inside the role's tabs (e.g. the dashboard): switches to the
 * target's tab, pushes a More screen with the More list under it, or opens a root screen.
 */
export function openTarget(target: NotificationTarget | null | undefined, me: MeResponse | null | undefined): boolean {
  return openHref(hrefForTarget(target, me));
}

export function navigateToTarget(target: NotificationTarget | null | undefined, me: MeResponse | null | undefined): boolean {
  const href = hrefForTarget(target, me);
  if (!href) return false;
  router.dismissTo(href, { withAnchor: true });
  return true;
}
