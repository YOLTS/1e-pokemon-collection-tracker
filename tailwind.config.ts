import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        paper: "#f7f4ee",
        ember: "#c6422f",
        leaf: "#2f7d5c",
        gold: "#d8a92f",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(0, 0, 0, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
