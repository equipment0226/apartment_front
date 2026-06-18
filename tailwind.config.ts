import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Midnight Glassmorphism palette — 차갑고 고급스러운 톤만 사용
        ink: "#000000",
        coal: "#09090b",
        slateglass: "rgba(9, 9, 11, 0.55)",
        platinum: "#E2E8F0",
        deepblue: "#1E3A8A",
        cyan: {
          neon: "#00E5FF",
          soft: "#38BDF8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Pretendard", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(0, 229, 255, 0.25)",
        "glow-strong": "0 0 40px rgba(0, 229, 255, 0.45)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        fadeup: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseglow: {
          "0%, 100%": { boxShadow: "0 0 16px rgba(0,229,255,0.18)" },
          "50%": { boxShadow: "0 0 28px rgba(0,229,255,0.40)" },
        },
      },
      animation: {
        fadeup: "fadeup 0.5s ease-out both",
        pulseglow: "pulseglow 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
