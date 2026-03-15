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
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        surface: {
          // Neutral containers for hybrid look
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          800: "#1f2933",
          900: "#111827",
        },
        border: {
          subtle: "#e5e7eb",
          strong: "#d1d5db",
          darkSubtle: "#374151",
        },
        accent: {
          // Progress / streak accents
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#22c55e",
          600: "#16a34a",
        },
        destructive: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
        },
        info: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
        },
      },
      borderRadius: {
        card: "1rem",
        button: "0.75rem",
      },
      boxShadow: {
        card: "0 18px 45px rgba(15, 23, 42, 0.12)",
      },
      transitionDuration: {
        "fast": "150ms",
        "default": "200ms",
        "slow": "300ms",
      },
      transitionTimingFunction: {
        subtle: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "sound-wave-1": {
          "0%, 100%": { height: "8px" },
          "50%": { height: "4px" },
        },
        "sound-wave-2": {
          "0%, 100%": { height: "12px" },
          "50%": { height: "6px" },
        },
        "sound-wave-3": {
          "0%, 100%": { height: "8px" },
          "50%": { height: "4px" },
        },
      },
      animation: {
        "sound-wave-1": "sound-wave-1 0.6s ease-in-out infinite",
        "sound-wave-2": "sound-wave-2 0.6s ease-in-out infinite 0.1s",
        "sound-wave-3": "sound-wave-3 0.6s ease-in-out infinite 0.2s",
      },
    },
  },
  plugins: [],
};
export default config;
