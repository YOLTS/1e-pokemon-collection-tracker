import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        abyss: "#030712",
        midnight: "#07111f",
        neon: {
          cyan: "#22d3ee",
          blue: "#38bdf8",
          magenta: "#f472b6",
          pink: "#fb7185",
          amber: "#fbbf24",
        },
      },
      boxShadow: {
        soft: "0 18px 50px rgba(0, 0, 0, 0.28)",
        glow: "0 0 34px rgba(34, 211, 238, 0.2)",
        magenta: "0 0 34px rgba(244, 114, 182, 0.16)",
        amber: "0 0 28px rgba(251, 191, 36, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
