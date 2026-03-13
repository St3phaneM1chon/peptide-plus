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
        // BioGreen — primary brand color (extracted from logo signature #238838)
        primary: {
          50: '#F3F9F4',
          100: '#E2F3E6',
          200: '#BCE6C5',
          300: '#85D696',
          400: '#39C657',
          500: '#238838',
          600: '#1B722D',
          700: '#165824',
          800: '#12421C',
          900: '#0E3116',
          950: '#0A1D0E',
        },
        // BioCyan — secondary / molecular accent
        secondary: {
          50: '#E6FFFA',
          100: '#B2F5EA',
          200: '#81E6D9',
          300: '#4FD1C5',
          400: '#38B2AC',
          500: '#319795',
          600: '#2C7A7B',
          700: '#285E61',
          800: '#234E52',
          900: '#1D4044',
          950: '#0F2B2D',
        },
        // BioBlue — trust / info accent
        accent: {
          50: '#EBF8FF',
          100: '#BEE3F8',
          200: '#90CDF4',
          300: '#63B3ED',
          400: '#4299E1',
          500: '#3182CE',
          600: '#2B6CB0',
          700: '#2C5282',
          800: '#2A4365',
          900: '#1A365D',
          950: '#0F1F3D',
        },
        // Navy — deep dark sections (replaces black)
        navy: {
          700: '#1E3A5F',
          800: '#1A365D',
          900: '#0F2440',
          950: '#0A1628',
        },
        // Warm Gray — neutral tones
        neutral: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
          950: '#0C0A09',
        },
        // Orange kept ONLY for star ratings (amber-400 equivalent)
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
        heading: ['var(--font-heading)', 'Montserrat', 'system-ui', 'sans-serif'],
      },
      // Keyframes & animations
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
        'bounce-gentle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'molecule-float': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)', opacity: '0.06' },
          '25%': { transform: 'translateY(-12px) rotate(3deg)', opacity: '0.1' },
          '50%': { transform: 'translateY(-6px) rotate(-2deg)', opacity: '0.08' },
          '75%': { transform: 'translateY(-18px) rotate(1deg)', opacity: '0.05' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(35, 136, 56, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(35, 136, 56, 0.6)' },
        },
        'fade-scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up-stagger': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s infinite',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'slide-in-left': 'slide-in-left 200ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
        'bounce-gentle': 'bounce-gentle 2s ease-in-out infinite',
        'molecule-float': 'molecule-float 8s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'fade-scale-in': 'fade-scale-in 0.4s ease-out both',
        'slide-up-stagger': 'slide-up-stagger 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
