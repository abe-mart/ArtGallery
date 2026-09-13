/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
      colors: {
        paper: '#fdfbf7',
        charcoal: '#2c2c2c',
        stone: '#8c8c8c',
        'water-blue': '#a5b4c4',
        'water-mist': '#e6ecf0',
      },
      backgroundImage: {
        'texture': "url('https://www.transparenttextures.com/patterns/watercolor.png')",
      }
    },
  },
  plugins: [],
};
