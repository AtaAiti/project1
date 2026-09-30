import type { Config } from "tailwindcss";

const config: Config = { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { gold: { DEFAULT: "#c9933b", hover: "#d6a14b", muted: "#a4772e" }, dark: { 50: "#1c1c1c", 100: "#161616", 200: "#111111", 300: "#0a0a0a" }, ink: "#f5f0e6", paper: "#0a0a0a" }, fontFamily: { display: ["var(--font-display)"], serif: ["Georgia", "serif"], sans: ["Trebuchet MS", "sans-serif"] } } }, plugins: [] };
export default config;