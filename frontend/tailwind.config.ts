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
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
