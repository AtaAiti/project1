import type { Config } from "tailwindcss";

const config: Config = { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { ink: "#f3eee5", paper: "#171512", wine: "#a74d43" }, fontFamily: { display: ["var(--font-display)"], sans: ["var(--font-sans)"] } } }, plugins: [] };
export default config;