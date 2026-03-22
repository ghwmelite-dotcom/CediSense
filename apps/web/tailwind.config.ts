import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        flame: {
          DEFAULT: '#FF6B35',
          light: '#FF8A5C',
        },
        gold: {
          DEFAULT: '#D4A843',
          light: '#E8C873',
        },
        ghana: {
          green: '#006B3F',
          black: '#0d0d1a',
          dark: '#0d0d1a',
          surface: '#14142a',
          'surface-hover': '#1A1A35',
          elevated: '#1E1E38',
        },
        income: '#00C896',
        expense: '#FF6B8A',
        warning: '#FFB347',
        info: '#9382FF',
        muted: '#8888A8',
        'muted-dim': '#5A5A72',
        'text-primary': '#E8E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Clash Display"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
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
          '0%, 100%': { opacity: '0.3', boxShadow: '0 0 20px rgba(255,107,53,0.03)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 30px rgba(255,107,53,0.06)' },
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
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        bounceOnce: {
          '0%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-6px)' },
          '50%': { transform: 'translateY(0)' },
          '70%': { transform: 'translateY(-3px)' },
          '100%': { transform: 'translateY(0)' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        crossfade: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        staggerIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        growWidth: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--target-width)' },
        },
        goldPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 168, 67, 0)' },
          '50%': { boxShadow: '0 0 8px 2px rgba(212, 168, 67, 0.25)' },
        },
        redPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
          '50%': { boxShadow: '0 0 8px 2px rgba(239, 68, 68, 0.2)' },
        },
        gradientSweep: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        goldFloat: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '0.6' },
          '50%': { transform: 'translateY(-20px) scale(1.1)', opacity: '1' },
          '100%': { transform: 'translateY(-40px) scale(0.8)', opacity: '0' },
        },
        logoReveal: {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '60%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        kenteReveal: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
        chartGrow: {
          '0%': { transform: 'scaleY(0)', transformOrigin: 'bottom' },
          '100%': { transform: 'scaleY(1)', transformOrigin: 'bottom' },
        },
        progressFill: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--progress-target, 100%)' },
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
        breathe: 'breathe 4s ease-in-out infinite',
        'bounce-once': 'bounceOnce 0.6s ease-out',
        'count-up': 'countUp 0.5s ease-out',
        crossfade: 'crossfade 0.25s ease-out',
        'stagger-in': 'staggerIn 0.35s ease-out both',
        'grow-width': 'growWidth 0.8s ease-out both',
        'gold-pulse': 'goldPulse 2.5s ease-in-out infinite',
        'red-pulse': 'redPulse 2.5s ease-in-out infinite',
        'gradient-sweep': 'gradientSweep 6s ease infinite',
        'slide-left': 'slideLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'gold-float': 'goldFloat 3s ease-out infinite',
        'logo-reveal': 'logoReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        'kente-reveal': 'kenteReveal 0.5s ease-out',
        'chart-grow': 'chartGrow 0.6s ease-out',
        'progress-fill': 'progressFill 0.8s ease-out both',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.5)',
        'gold-glow': '0 0 20px rgba(212, 168, 67, 0.12)',
        'gold-glow-lg': '0 0 40px rgba(212, 168, 67, 0.18)',
        'gold-btn': '0 2px 8px rgba(212, 168, 67, 0.3)',
        'green-glow': '0 0 20px rgba(52, 211, 153, 0.15)',
        'inner-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        'glow-orange': '0 0 25px rgba(255, 107, 53, 0.04)',
        'glow-btn': '0 4px 15px rgba(255, 107, 53, 0.25)',
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
