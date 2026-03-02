import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6C2BD9',
          50: '#F3EAFF',
          100: '#E4D1FF',
          200: '#C9A3FF',
          300: '#A56EFF',
          400: '#8A45F0',
          500: '#6C2BD9',
          600: '#5620B0',
          700: '#411888',
          800: '#2D1060',
          900: '#1A0A38',
        },
        secondary: {
          DEFAULT: '#F59E0B',
          50: '#FFF8E1',
          500: '#F59E0B',
          600: '#D97706',
        },
        background: '#0F172A',
        surface: '#1E293B',
        'surface-hover': '#334155',
        border: '#334155',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        'cyan-glow': '#00D4FF',
        'neon-green': '#39FF14',
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 8px rgba(108, 43, 217, 0.3)',
        'glow-md': '0 0 16px rgba(108, 43, 217, 0.4)',
        'glow-lg': '0 0 24px rgba(108, 43, 217, 0.5)',
        'glow-cyan': '0 0 16px rgba(0, 212, 255, 0.4)',
        'glow-green': '0 0 16px rgba(57, 255, 20, 0.3)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'flicker': 'flicker 3s ease-in-out infinite',
        'data-stream': 'data-stream 2s linear infinite',
        'scanline': 'scanline 4s linear infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(108, 43, 217, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(108, 43, 217, 0.6)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
          '25%, 75%': { opacity: '0.95' },
        },
        'data-stream': {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '0% 100%' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
