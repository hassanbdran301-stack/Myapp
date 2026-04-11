/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'count-down': 'countDown 0.5s ease-out',
      },
      keyframes: {
        countDown: {
          '0%': { transform: 'scale(1.2)', color: '#ef4444' },
          '100%': { transform: 'scale(1)' },
        }
      }
    },
  },
  plugins: [],
}
