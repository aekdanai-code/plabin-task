import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: "#F5F5F7",
          card: "#FFFFFF",
          text: "#1D1D1F",
          muted: "#6E6E73",
          blue: "#007AFF",
          green: "#34C759",
          orange: "#FF9500",
          red: "#FF3B30",
          line: "#D2D2D7"
        }
      },
      boxShadow: {
        soft: "0 12px 32px rgba(0, 0, 0, 0.08)",
        panel: "0 20px 60px rgba(0, 0, 0, 0.14)"
      },
      borderRadius: {
        apple: "16px"
      }
    }
  },
  plugins: []
};

export default config;
