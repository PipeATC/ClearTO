# ClearTO — D-ATIS & D-Clearance SCEL

Datalink para **SCEL / SCL** (DGAC Chile) en **dos dispositivos**:

- **Piloto** (`index.html`): D-ATIS, y D-Clearance (PDC) con colacionado (WILCO)
  digital — la autorización en orden **CRAFT** (límite · ruta · nivel · pista ·
  SID · frecuencia · SSR).
- **Controlador** (`atc.html`): **franja electrónica** de salidas; entrega y edita
  la autorización y ve el readback en vivo.

## Uso rápido

**Dos tablets en la misma red (recomendado):**

```bash
npm start          # = node server.js  → imprime las URLs con la IP de la LAN
# Controlador →  http://<ip>:8080/atc     Piloto →  http://<ip>:8080/
```

Ciclo: en `/atc` pulsa **MARCAR LISTA** en un vuelo → en el piloto **buscar** ese
indicativo → **ASIGNAR ESTE VUELO** → recibe la autorización **CRAFT** → **WILCO**
→ la franja muestra **AUTORIZACIÓN RECIBIDA**.

**Solo la app del piloto (estático, sin servidor):**

```bash
npm run serve:static   # python3 -m http.server 8000  → modo offline/localStorage
```

## Estructura

- **Piloto:** `index.html` · `app.js` · `sw.js` (PWA)
- **Controlador:** `atc.html` · `atc.js`
- **Red:** `netlink.js` (cliente WS + fallback offline) · `server.js` (server LAN
  Node puro, sin dependencias, con WebSocket nativo)
- `data.js` — datos SCEL, ATIS, vuelos/franjas (de la franja real), NOTAM
- `styles.css` — **Tailwind compilado local** (sin CDN). Regenerar: `npm run build:css`
- `vendor/jspdf.umd.min.js` — jsPDF vendorizado para el export a PDF (offline)
- `tailwind.config.js` · `styles.input.css` · `package.json` — fuente/config del build
- `icons/` · `design/` — icono de la app + los 3 SVG de referencia
- **`CLAUDE.md`** — memoria de proyecto / traspaso para Claude Code (léelo primero)

## Build de CSS (solo si tocas el diseño)

Tailwind no usa CDN: los estilos viven en `styles.css` (versionado). El runtime es
estático (Pages) o servido por `server.js` (LAN); npm/Node se usan en dev y para
el servidor.

```bash
npm install        # primera vez
npm run build:css  # regenera styles.css escaneando el HTML/JS
```

## Deploy

- **App del piloto:** estática → **GitHub Pages** (rama `main`, raíz). En Pages
  corre en modo offline (sin la franja del controlador). Ver `CLAUDE.md` §6.
- **Sistema de dos tablets:** `node server.js` en un equipo de la LAN. Ver
  `CLAUDE.md` §3.1.
