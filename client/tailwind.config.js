import { heroui } from "@heroui/react";

// Provided brand palette (kept available by name on Tailwind too).
const PALETTE = {
  khaki_beige: {
    DEFAULT: "#c3a995",
    100: "#2c2119",
    200: "#574231",
    300: "#83634a",
    400: "#aa8468",
    500: "#c3a995",
    600: "#cfb9a9",
    700: "#dbcbbe",
    800: "#e7dcd4",
    900: "#f3eee9",
  },
  dusty_taupe: {
    DEFAULT: "#8a7968",
    100: "#1b1815",
    200: "#373029",
    300: "#52483e",
    400: "#6d6052",
    500: "#8a7968",
    600: "#a29384",
    700: "#b9aea3",
    800: "#d1c9c1",
    900: "#e8e4e0",
  },
  ash_brown: {
    DEFAULT: "#6f5e53",
    100: "#161311",
    200: "#2c2621",
    300: "#423932",
    400: "#584b43",
    500: "#6f5e53",
    600: "#927d6f",
    700: "#ad9d93",
    800: "#c9beb7",
    900: "#e4dedb",
  },
  chocolate_plum: {
    DEFAULT: "#593d3b",
    100: "#120c0c",
    200: "#231818",
    300: "#352523",
    400: "#47312f",
    500: "#593d3b",
    600: "#845b58",
    700: "#a8807d",
    800: "#c5aaa8",
    900: "#e2d5d4",
  },
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    "../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: PALETTE,
      fontFamily: {
        sans: ["Satoshi", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Cabinet Grotesk", "Satoshi", "sans-serif"],
        brand: ["Clash Display", "Cabinet Grotesk", "sans-serif"],
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: "#fffcf2",
            foreground: "#2c2621",
            focus: "#ab947e",
            divider: "rgba(89,61,59,0.12)",
            content1: "#fbf8ef",
            content2: "#f1ebdf",
            content3: "#e6dccd",
            content4: "#d4c7b4",
            // Warm taupe neutral scale (light -> dark, HeroUI convention).
            default: {
              50: "#f3eee9",
              100: "#e8e1d9",
              200: "#d8ccc0",
              300: "#c2b3a4",
              400: "#9c8a78",
              500: "#7d6c5d",
              600: "#6f5e53",
              700: "#4e4339",
              800: "#342c25",
              900: "#1f1a16",
              foreground: "#f3eee9",
              DEFAULT: "#6f5e53",
            },
            primary: {
              50: "#fbeaea",
              100: "#f3c9ca",
              200: "#e9a3a4",
              300: "#df7d7e",
              400: "#cd6061",
              500: "#bc4749",
              600: "#9d3a3b",
              700: "#7d2e2f",
              800: "#5e2223",
              900: "#3f1718",
              DEFAULT: "#bc4749",
              foreground: "#ffffff",
            },
            secondary: { ...PALETTE.khaki_beige, foreground: "#2c2621", DEFAULT: "#83634a" },
          },
        },
      },
    }),
  ],
};
