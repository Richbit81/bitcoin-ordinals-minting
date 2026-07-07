/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bitcoin: '#f7931a',
      },
      keyframes: {
        slotFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        learnGlow: {
          '0%, 100%': {
            background: '#F7931A',
            color: '#000000',
            boxShadow: '0 0 8px rgba(247,147,26,0.8), 0 0 16px rgba(247,147,26,0.5)',
          },
          '50%': {
            background: '#2563EB',
            color: '#ffffff',
            boxShadow: '0 0 12px rgba(37,99,235,0.9), 0 0 26px rgba(37,99,235,0.6)',
          },
        },
      },
      animation: {
        'slot-float': 'slotFloat 6s ease-in-out infinite',
        'learn-glow': 'learnGlow 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}








