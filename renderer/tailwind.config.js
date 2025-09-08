const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    './renderer/pages/**/*.{js,ts,jsx,tsx}',
    './renderer/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    colors: {
      // use colors only specified
      white: colors.white,
      gray: colors.gray,
      blue: colors.blue,
    },
   extend: {
      colors: {
        jabem: {
          navy: "#091B26",
          forest: "#01261C",
          teal: {
            DEFAULT: "#038C65", // primary
            hover: "#038C5A",   // hover
          },
          ivory: "#F2F0EB",
        },
      },
      boxShadow: {
        'elevated': '0 20px 40px -20px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
}
