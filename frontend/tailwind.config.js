/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#111111',
          hover: '#222222',
          active: '#C8A96E',
          border: '#2a2a2a',
          text: '#9ca3af',
          'text-active': '#ffffff',
        },
        brand: {
          50: '#fdf8ef',
          100: '#f7ecce',
          200: '#edd799',
          300: '#e0bc62',
          400: '#d4a63c',
          500: '#C8A96E',
          600: '#b8922e',
          700: '#9a7726',
          800: '#7c5f22',
          900: '#5c441a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
