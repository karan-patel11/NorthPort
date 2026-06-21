import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0A0E14",
        surface: "#121823",
        raised: "#1A2230",
        hairline: "#252D3D",
        primaryText: "#E6EAF0",
        secondaryText: "#8A94A6",
        accent: "#3B82F6",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444"
      },
      fontFamily: {
        brand: ["Cormorant Garamond", "Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"]
      },
      borderRadius: {
        card: "8px"
      }
    }
  },
  plugins: []
};

export default config;

