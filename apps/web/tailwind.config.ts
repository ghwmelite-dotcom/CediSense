import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4A843',
          light: '#E8C873',
        },
        ghana: {
          green: '#006B3F',
          black: '#0C0C14',
          dark: '#0C0C14',
          surface: '#14142A',
          'surface-hover': '#1A1A35',
          elevated: '#1E1E38',
        },
        income: '#34D399',
        expense: '#EF4444',
        muted: '#8888A8',
        'muted-dim': '#5A5A72',
        'text-primary': '#E8E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.15em',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
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
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slowSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        growBar: {
          '0%': { transform: 'scaleY(0)', opacity: '0' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
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
        float: 'float 4s ease-in-out infinite',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.5)',
        'gold-glow': '0 0 20px rgba(212, 168, 67, 0.12)',
        'gold-glow-lg': '0 0 40px rgba(212, 168, 67, 0.18)',
        'gold-btn': '0 2px 8px rgba(212, 168, 67, 0.3)',
        'green-glow': '0 0 20px rgba(52, 211, 153, 0.15)',
        'inner-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
        '3xl': '64px',
      },
      backgroundImage: {
        'premium-card':
          'linear-gradient(135deg, rgba(20,20,42,0.95) 0%, rgba(12,12,20,0.98) 100%)',
        'gold-shimmer':
          'linear-gradient(90deg, transparent 0%, rgba(212,168,67,0.06) 50%, transparent 100%)',
        'green-shimmer':
          'linear-gradient(90deg, transparent 0%, rgba(52,211,153,0.06) 50%, transparent 100%)',
        'surface-gradient':
          'linear-gradient(180deg, rgba(20,20,42,0.5) 0%, rgba(12,12,20,0) 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
