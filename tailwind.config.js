const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Same green the SIMS website uses (Tailwind green, mostly green-700).
        brand: colors.green,
      },
    },
  },
  plugins: [],
};
