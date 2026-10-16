/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#07070b",
        panel: "#0d0d14",
        panel2: "#12121c",
        ink: "#f4f4f7",
        mute: "#8f93a8",
        brand: {
          DEFAULT: "#7c3aed",
          dark: "#6d28d9",
          deep: "#a78bfa",
          tint: "#1b1230",
        },
        magenta: {
          DEFAULT: "#d946ef",
          dark: "#a21caf",
        },
        ember: {
          DEFAULT: "#ff4d5e",
          dark: "#e11d48",
        },
      },
      borderRadius: {
        card: "22px",
        chip: "14px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,.03) inset, 0 30px 60px -34px rgba(0,0,0,.9)",
        glow: "0 0 0 1px rgba(255,255,255,.06), 0 26px 70px -26px rgba(217,70,239,.5)",
        lift: "0 40px 80px -40px rgba(124,58,237,.55)",
      },
      keyframes: {
        spinslow: { to: { transform: "rotate(360deg)" } },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
      animation: {
        spinslow: "spinslow 30s linear infinite",
        float: "float 10s ease-in-out infinite",
        shimmer: "shimmer 8s linear infinite",
      },
    },
  },
  plugins: [],
};
