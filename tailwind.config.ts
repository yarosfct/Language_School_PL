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
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      keyframes: {
        'sound-wave-1': {
          '0%, 100%': { height: '8px' },
          '50%': { height: '4px' },
        },
        'sound-wave-2': {
          '0%, 100%': { height: '12px' },
          '50%': { height: '6px' },
        },
        'sound-wave-3': {
          '0%, 100%': { height: '8px' },
          '50%': { height: '4px' },
        },
      },
      animation: {
        'sound-wave-1': 'sound-wave-1 0.6s ease-in-out infinite',
        'sound-wave-2': 'sound-wave-2 0.6s ease-in-out infinite 0.1s',
        'sound-wave-3': 'sound-wave-3 0.6s ease-in-out infinite 0.2s',
      },
    },
  },
  plugins: [],
};
export default config;
