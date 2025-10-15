const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;


/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',                   // respect device dark mode
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};