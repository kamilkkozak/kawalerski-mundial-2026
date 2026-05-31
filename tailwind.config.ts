import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0d0a",
        panel: "#11160f",
        panel2: "#161d14",
        line: "rgba(204,255,0,.10)",
        lime: { DEFAULT: "#ccff00", 2: "#a3e635" },
        gold: "#f5c542",
        txt: "#eef3e8",
        mut: "#8a958a",
        red: "#ff5a5f",
        blue: "#5ad2ff",
      },
      fontFamily: {
        display: ["var(--font-anton)", "sans-serif"],
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
