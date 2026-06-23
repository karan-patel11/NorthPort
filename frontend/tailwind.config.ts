import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#080B10",
        surface: "#0F141C",
        raised: "#161D28",
        hairline: "#2A3443",
        primaryText: "#F1F5F9",
        secondaryText: "#94A3B8",
        accent: "#38BDF8",
        teal: "#14B8A6",
        gold: "#D6A756",
        success: "#22C55E",
        warning: "#EAB308",
        error: "#F87171"
      },
      fontFamily: {
        brand: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"]
      },
      borderRadius: {
        card: "8px"
      },
      boxShadow: {
        panel: "0 18px 45px rgba(0, 0, 0, 0.20)"
      }
    }
  },
  plugins: []
};

export default config;
