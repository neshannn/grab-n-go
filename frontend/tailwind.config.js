/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./public/index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        // Updated 'sans' to include a generic geometric font (e.g., Poppins) first
        // to satisfy the geometric sans-serif request for body text.
        sans: ['"Poppins"', 'Inter', ...defaultTheme.fontFamily.sans],
        // Custom font family for headings
        inter: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Swiggy-like orange brand
        primary: {
          50: '#FFF4EC',
          100: '#FFE6D3',
          200: '#FFCCA6',
          300: '#FFB179',
          400: '#FF9752',
          500: '#FC8019',
          600: '#E67313',
          700: '#BF5E0E',
          800: '#994A0A',
          900: '#7D3C08',
          DEFAULT: '#FC8019',
        },
        // Zomato-like supporting red (for highlights/accents)
        accent: {
          500: '#E23744',
          600: '#C92F3B',
          700: '#A62831',
          DEFAULT: '#E23744',
        },
      },
    },
  },
  plugins: [],
};