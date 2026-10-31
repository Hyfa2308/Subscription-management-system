/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // REVORA Brand Palette
        navy: {
          DEFAULT: '#14213D',
          50: '#E8EDF4',
          100: '#C5D0E4',
          200: '#8FA3C9',
          300: '#5977AD',
          400: '#2E4E8E',
          500: '#14213D',
          600: '#0F1930',
          700: '#0A1022',
          800: '#050815',
          900: '#020408',
        },
        indigo: {
          DEFAULT: '#4F46E5',
          50: '#EEEEFF',
          100: '#D9D8FD',
          200: '#B3B2FB',
          300: '#8D8CF9',
          400: '#6766F7',
          500: '#4F46E5',
          600: '#3B33CC',
          700: '#2A26A3',
          800: '#1A1878',
          900: '#0C0B4E',
        },
        teal: {
          DEFAULT: '#14B8A6',
          50: '#E6FAF8',
          100: '#C0F3EE',
          200: '#81E6DC',
          300: '#43D9CA',
          400: '#14C9B6',
          500: '#14B8A6',
          600: '#0F9286',
          700: '#0B6C64',
          800: '#074742',
          900: '#032120',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        'DEFAULT': '0.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
        'modal': '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.06)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.25s ease-out',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
