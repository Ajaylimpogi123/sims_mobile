import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';

/**
 * Figtree, the website's font (Tailwind `font-sans`). One family per weight: Android doesn't
 * pick a weight out of one family with fontWeight, so set the family and leave fontWeight unset.
 * Same names as the font-normal / medium / semibold / bold classes in tailwind.config.js.
 * Use these only where a class can't go (header titles, tab labels, chart labels).
 */
export const fonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  /** Only the BCC wordmark and the KPI numbers, as on the website. */
  bold: 'Figtree_700Bold',
} as const;

/** For useFonts() in the root layout. */
export const fontFiles = {
  [fonts.regular]: Figtree_400Regular,
  [fonts.medium]: Figtree_500Medium,
  [fonts.semibold]: Figtree_600SemiBold,
  [fonts.bold]: Figtree_700Bold,
};
