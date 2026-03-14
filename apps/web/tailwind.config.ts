import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4A843',
        ghana: {
          green: '#006B3F',
          black: '#0D0D12',
          dark: '#0D0D12',
          surface: '#161622',
        },
        income: '#4ADE80',
        expense: '#F87171',
        muted: '#7A7A8C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        cursorBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        sparkleSpin: {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '50%': { transform: 'rotate(15deg) scale(1.1)' },
          '100%': { transform: 'rotate(0deg) scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'cursor-blink': 'cursorBlink 1s ease-in-out infinite',
        'sparkle-spin': 'sparkleSpin 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.12)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.3), 0 8px 32px rgba(0, 0, 0, 0.2)',
        'gold-glow': '0 0 20px rgba(212, 168, 67, 0.12)',
        'gold-glow-lg': '0 0 40px rgba(212, 168, 67, 0.18)',
        'green-glow': '0 0 20px rgba(0, 107, 63, 0.15)',
        'inner-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      },
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
        '3xl': '64px',
      },
      backgroundImage: {
        'premium-card':
          'linear-gradient(135deg, rgba(22,22,34,0.95) 0%, rgba(13,13,18,0.98) 100%)',
        'gold-shimmer':
          'linear-gradient(90deg, transparent 0%, rgba(212,168,67,0.06) 50%, transparent 100%)',
        'green-shimmer':
          'linear-gradient(90deg, transparent 0%, rgba(0,107,63,0.06) 50%, transparent 100%)',
        'surface-gradient':
          'linear-gradient(180deg, rgba(22,22,34,0.5) 0%, rgba(13,13,18,0) 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
