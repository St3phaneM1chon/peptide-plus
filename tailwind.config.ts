import type { Config } from 'tailwindcss';

const config: Config = {
  // #67: Enable class-based dark mode for future theming support
  darkMode: 'class',
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Couleurs personnalisées
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Orange brûlé - remplace le orange Tailwind par défaut
        orange: {
          50: '#FEF3EB',
          100: '#FDE0C8',
          200: '#FABE8E',
          300: '#F79855',
          400: '#E57624',
          500: '#CC5500',
          600: '#AD4700',
          700: '#8C3A00',
          800: '#6E2E02',
          900: '#5A2603',
          950: '#3A1802',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // #66: Shimmer animation defined as Tailwind utility
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-260px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s infinite',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'slide-in-left': 'slide-in-left 200ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
