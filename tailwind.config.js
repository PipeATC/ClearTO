/** ClearTO — config de build de Tailwind (reemplaza el CDN).
 *  Genera styles.css escaneando el HTML/JS del proyecto.
 *  Build:  npm install && npm run build:css
 *  El resultado (styles.css) SÍ se versiona; node_modules/ no. */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./app.js", "./data.js"],
  // Clases construidas dinámicamente (p. ej. dot("emerald") / dot("sky"))
  // que el scanner de Tailwind no puede ver como literales.
  safelist: ["bg-emerald-500", "bg-sky-500"],
  theme: {
    extend: {
      colors: {
        surface: "#f4f7fb",
        "surface-container": "#ffffff",
        "surface-container-low": "#f8fafc",
        "surface-container-high": "#eef2f7",
        "on-surface": "#0b2b5c",
        "on-surface-variant": "#64748b",
        primary: "#059669",
        "primary-dark": "#047857",
        secondary: "#0284c7",
        navy: "#0b2b5c",
        "navy-muted": "#1e3a68",
        outline: "#e2e8f0",
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      fontFamily: {
        headline: ["Public Sans", "sans-serif"],
        body: ["Public Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
  ],
};
