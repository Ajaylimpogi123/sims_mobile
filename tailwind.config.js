const colors = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');

/**
 * Figtree, the website's font, one file per weight (loaded in src/app/_layout.tsx).
 * Android can't pick a weight out of one family with fontWeight, so each weight class
 * sets the matching family instead. Keep in step with src/theme/fonts.ts.
 */
const figtree = {
  normal: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // font-normal / font-medium / font-semibold / font-bold come from the plugin below.
  corePlugins: { fontWeight: false },
  theme: {
    extend: {
      colors: {
        // Same green the SIMS website uses (Tailwind green, mostly green-700).
        brand: colors.green,
      },
      fontFamily: {
        sans: [figtree.normal],
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.font-normal': { fontFamily: figtree.normal },
        '.font-medium': { fontFamily: figtree.medium },
        '.font-semibold': { fontFamily: figtree.semibold },
        '.font-bold': { fontFamily: figtree.bold },
      });
    }),
  ],
};
