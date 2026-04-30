/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        sage: {
          50:  "#f0f9f4",
          100: "#cce8d4",
          200: "#99d1ac",
          300: "#60b880",
          400: "#32a060", // primary CTA
          500: "#1e7a44",
          600: "#165c39",
          700: "#0e4220",
          800: "#082d16",
          900: "#04180c",
        },
        cream: "#f2f8f4",
      },
    },
  },
  plugins: [],
};
