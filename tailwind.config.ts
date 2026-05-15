import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dde6ff",
          500: "#4f6ef7",
          600: "#3b55e6",
          700: "#2d43d0",
          900: "#1a2880",
        },
        surface: {
          DEFAULT: "#0f1117",
          card: "#161b27",
          border: "#1e2535",
          muted: "#252d40",
        },
        signal: {
          buy: "#22c55e",
          watch: "#f59e0b",
          avoid: "#ef4444",
          neutral: "#6b7280",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
