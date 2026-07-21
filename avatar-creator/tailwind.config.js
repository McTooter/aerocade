/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        aero: {
          blue: '#4da6ff',
          sky: '#87ceeb',
          light: '#e8f4fd',
          glass: 'rgba(255,255,255,0.65)',
          glassDark: 'rgba(30,40,60,0.75)',
          accent: '#2196f3',
          deep: '#1565c0',
        },
      },
      boxShadow: {
        aero: '0 8px 32px rgba(0,120,215,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        'aero-lg': '0 16px 48px rgba(0,120,215,0.15), 0 4px 16px rgba(0,0,0,0.08)',
        'aero-inset': 'inset 0 1px 0 rgba(255,255,255,0.5)',
        'aero-glow': '0 0 20px rgba(77,166,255,0.3)',
      },
      borderRadius: {
        aero: '16px',
        'aero-lg': '24px',
        'aero-xl': '32px',
      },
      backdropBlur: {
        aero: '20px',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
