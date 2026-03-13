import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4A843',
        ghana: {
          green: '#006B3F',
          black: '#1A1A1A',
          dark: '#111111',
          surface: '#1A1A2E',
        },
        income: '#4ADE80',
        expense: '#F87171',
        muted: '#888888',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
