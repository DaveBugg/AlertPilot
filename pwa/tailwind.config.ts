import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        urgent: "#ef4444",
        high: "#f97316",
        normal: "#3b82f6",
        low: "#6b7280",
      },
    },
  },
  plugins: [],
};

export default config;
