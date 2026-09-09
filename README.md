# ClearTO — D-ATIS & D-Clearance SCEL

Maqueta funcional (PWA, sin backend) de datalink para **SCEL / SCL** (DGAC Chile):
telegrama digital **D-ATIS** y autorización de salida **D-Clearance (PDC)** con
colacionado (readback) digital.

## Uso rápido

```bash
python3 -m http.server 8000
# http://localhost:8000  → DevTools → vista móvil
```

Demo del ciclo: pestaña **D-Clearance** → en el "Simulador de controlador" marca un
vuelo como *lista* → búscalo → obtén la clearance → **ACEPTAR Y COLACIONAR (WILCO)**
→ "CICLO CERRADO".

## Estructura

- `index.html` · `data.js` (datos simulados) · `app.js` (lógica) · `sw.js` (PWA)
- `styles.css` — **Tailwind compilado local** (sin CDN). Regenerar: `npm run build:css`
- `vendor/jspdf.umd.min.js` — jsPDF vendorizado para el export a PDF (offline)
- `tailwind.config.js` · `styles.input.css` · `package.json` — fuente/config del build
- `icons/` — icono de la app (radar, opción 1)
- `design/` — los **3 iconos** a elegir (SVG) + ZIP del diseño Stitch de referencia
- **`CLAUDE.md`** — memoria de proyecto / traspaso para Claude Code (léelo primero)

## Build de CSS (solo si tocas el diseño)

Tailwind ya **no** usa CDN: los estilos viven en `styles.css` (versionado). El
runtime es 100% estático; npm se usa solo en dev.

```bash
npm install        # primera vez
npm run build:css  # regenera styles.css escaneando el HTML/JS
# npm run watch:css  # recompila al guardar
```

## Deploy

Estático → **GitHub Pages** (rama `main`, carpeta raíz). No requiere build en
Pages (`styles.css` y jsPDF ya vienen versionados). Ver `CLAUDE.md` §6.

> Próximo paso: conectar con la **franja de progreso de vuelo** del controlador
> (otro dispositivo). Backlog en `CLAUDE.md` §7.
