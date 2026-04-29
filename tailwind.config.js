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
          50:  "#f4f7f4",
          100: "#e6ede7",
          200: "#ccdcce",
          300: "#a8c5ad",
          400: "#7da87b", // primary
          500: "#6b8f71",
          600: "#527558",
          700: "#435e48",
          800: "#374c3b",
          900: "#2e3f32",
        },
        cream: "#f8f7f4",
      },
    },
  },
  plugins: [],
};
