/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1a56db",
        danger:  "#e02424",
        warning: "#ff5a1f",
        success: "#057a55",
      },
    },
  },
  plugins: [],
};
