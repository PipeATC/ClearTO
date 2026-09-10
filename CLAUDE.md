# ClearTO — D-ATIS & D-Clearance SCEL · Memoria de proyecto

> Documento de traspaso para **Claude Code**. Lee esto primero. Describe qué es
> la app, cómo está construida, el modelo del ciclo de autorización, y el backlog
> priorizado. La app es una **maqueta funcional (PWA sin backend)**; el objetivo
> inmediato es hostearla en **GitHub Pages** y luego conectarla a una **franja de
> progreso de vuelo** que corre en otro dispositivo.

---

## 1. Qué es

App de datalink para el aeropuerto **SCEL / SCL (Comodoro Arturo Merino Benítez,
Pudahuel, Santiago de Chile — DGAC Chile)**. Dos funciones para tripulación:

- **D-ATIS**: telegrama digital de información terminal (salida/llegada).
- **D-Clearance (PDC)**: autorización de salida pre-vuelo entregada por datalink,
  con **colacionado (readback) digital**.

Marca de la app: **ClearTO**. Institucional DGAC Chile. Idioma: **español (es-CL)**,
con terminología aeronáutica en inglés donde corresponde (SID, SQUAWK, RWY, WILCO…).

**Rol del usuario dueño del proyecto:** Felipe — piloto comercial chileno (CPL) y
controlador de tránsito aéreo con +15 años de experiencia. Entiende el dominio a
fondo; no simplifiques la terminología ATC.

---

## 2. El ciclo de autorización (lo más importante)

Sistema de **dos dispositivos (dos tablets en la misma red)**, ambos servidos
por `server.js`:

- **Piloto** → `index.html` / `app.js` (esta app).
- **Controlador** → `atc.html` / `atc.js` (la **franja electrónica**, ya
  implementada en este repo).

Flujo de extremo a extremo (funciona en vivo entre las dos tablets):

1. El **controlador** ve sus franjas y, cuando completa la autorización, pulsa
   **MARCAR LISTA** (check "lista para entregar") → `stripState: ready`.
2. El **piloto** abre D-Clearance → **busca su indicativo** → **ASIGNAR ESTE
   VUELO**. Si aún está `pending` ve "en espera"; al quedar `ready` recibe la
   **autorización en orden CRAFT** (límite · ruta · nivel · pista · SID ·
   frecuencia · SSR).
3. El piloto pulsa **ACEPTAR Y COLACIONAR (WILCO)** → readback digital.
4. El ciclo se cierra: la **franja del controlador muestra "AUTORIZACIÓN
   RECIBIDA"** (`acknowledged`).

El controlador también puede **editar** la autorización inline (nivel, SSR,
ruta, SID, frecuencia…) y **RETIRAR** una entrega. Todo se sincroniza al
instante por WebSocket (ver §3.1).

La franja del controlador replica el **estilo EFS real** (fondo gris, celdas con
divisorias, monoespaciado, caja ARO, gran "B" estética, botones RBACK/Form). La
**banda de color del indicativo** refleja la **gestión ATFM** (`atfm` en
`data.js`): ámbar = regulado (con CTOT y nivel en cian), verde = liberado, sin
banda = sin gestión. Es independiente del `stripState` (el ciclo de entrega vive
en los botones LISTA/RBACK). El CSS de la franja está en `atc.html` (`<style>`).

### Modelo de estados de la franja (`stripState` en `data.js`)

| Estado          | Significado                                        | En la UI del piloto |
|-----------------|----------------------------------------------------|---------------------|
| `pending`       | Controlador aún completando la autorización        | Vuelo visible pero no seleccionable ("EN PROCESO") |
| `ready`         | Controlador marcó el check "lista para entregar"   | Seleccionable; muestra la clearance |
| `delivered`     | Piloto ya la obtuvo, aún sin colacionar            | (transitorio; reservado para la integración real) |
| `acknowledged`  | Readback digital recibido → ciclo cerrado          | "RECIBIDA · WILCO", banner CICLO CERRADO |

El **"Simulador de controlador"** de la maqueta original **ya no existe**: fue
reemplazado por la **franja electrónica real** (`atc.html`/`atc.js`), que es el
segundo dispositivo. El paso 1 lo hace el controlador de verdad con **MARCAR
LISTA**. Sin servidor (GitHub Pages), `netlink.js` cae a un modo **offline** en
un solo dispositivo persistido en `localStorage` (`clearto_strip_state_v1`), y
la app del piloto se sigue pudiendo demostrar sola.

---

## 3. Stack y arquitectura

Deliberadamente **sin build step**, para que GitHub Pages sirva los archivos tal
cual y Felipe pueda iterar rápido.

- **HTML + Tailwind (compilado local) + JavaScript vanilla.** SPA de una sola
  vista con render por reemplazo de `innerHTML`. Sin framework, sin bundler.
  Tailwind ya **no** se sirve por CDN: `styles.css` se genera con la CLI de
  Tailwind (`npm run build:css`) escaneando el HTML/JS. El navegador solo carga
  ese CSS estático — cero JS de Tailwind en runtime, arranque offline y sin el
  warning de producción del CDN. npm se usa **solo** en build/dev; el runtime
  sigue siendo estático.
- **PWA**: `manifest.webmanifest` + `sw.js` (service worker cache-first del app
  shell) → instalable y con arranque offline básico.
- Fuentes: **Public Sans** (UI) + **JetBrains Mono** (datos/telegramas).
  Iconos: **Material Symbols Outlined**. Todo por CDN de Google Fonts.

### Archivos

```
index.html   App del PILOTO: shell + carga de styles.css + netlink + app.js
app.js       Lógica del piloto: navegación, Tablero, D-ATIS, D-Clearance (buscar→asignar→
             autorización CRAFT→WILCO), Historial, tiempos vivos, PDF, toasts
atc.html     App del CONTROLADOR: shell (fija window.CLEARTO_ROLE="atc") + atc.js
atc.js       Franja electrónica: tablero de franjas, MARCAR LISTA / RETIRAR / edición
             inline de la autorización, readback (WILCO) en vivo
netlink.js   Sincronización piloto⇄controlador (WebSocket al server LAN) con FALLBACK
             offline por localStorage (para la demo estática en GitHub Pages)
server.js    Servidor LAN (Node puro, SIN dependencias): sirve ambas apps + WebSocket
             nativo (/ws) + estado autoritativo del ciclo por indicativo (.clearto-state.json)
data.js      Datos: aeródromo SCEL, ATIS, VUELOS/FRANJAS (de la imagen real), NOTAM
sw.js        Service worker PWA (cache-first; cachea styles.css, netlink.js y jsPDF)
styles.css   Tailwind COMPILADO (se versiona). Regenerar con `npm run build:css`.
styles.input.css / tailwind.config.js / package.json   Fuente y config del build de CSS
vendor/      jsPDF vendorizado (jspdf.umd.min.js) para el export a PDF offline
manifest.webmanifest   Metadatos PWA (piloto)
icons/       icon-192.png, icon-512.png, icon-maskable-512.png (icono radar, opción 1)
design/      Los 3 SVG de icono a elegir + el ZIP de diseño Stitch original de referencia
```

`app.js` está organizado por función: `viewDashboard()`, `viewAtis()`,
`viewClearance()` (→ `viewClearanceSearch()` / `viewClearanceDetail()`),
`viewHistory()`. `render()` arma header + main + bottom-nav y luego `wire()`
engancha todos los eventos (delegación simple por `data-*`).

### Tokens de diseño (de Stitch `DESIGN.md`)

- `navy` `#0b2b5c` (texto/marca) · `primary` `#059669` (verde acción/CTA) ·
  `primary-dark` `#047857` · `secondary` `#0284c7` (sky) · `surface` `#f4f7fb`.
- Cards: `bg-white border border-slate-200/90 rounded-xl shadow-sm`.
- Datos numéricos y telegramas siempre en `font-mono`.

> **Nota de entorno:** los estilos ya no dependen de red (Tailwind es local en
> `styles.css`). Las **fuentes** (Public Sans, JetBrains Mono, Material Symbols)
> siguen viniendo del CDN de Google Fonts; en un sandbox con red restringida
> pueden bloquearse y los iconos se ven como texto (p. ej. `verified`). En un
> navegador normal / GitHub Pages cargan bien y offline caen a la fuente del
> sistema. Vendorizar las fuentes localmente queda como mejora opcional (§7).

### 3.1 Red: las dos tablets en la misma wifi

`server.js` es un **servidor LAN en Node puro, sin dependencias** (implementa el
WebSocket con módulos nativos), pensado para correr en un notebook/mini-PC de la
misma red:

```bash
node server.js            # puerto 8080 (o: PORT=9000 node server.js)
# imprime las URLs con la IP de la LAN. En las tablets:
#   Piloto      →  http://<ip>:8080/
#   Controlador →  http://<ip>:8080/atc
```

- **Transporte:** WebSocket en `/ws`. El servidor es la **fuente de verdad** del
  ciclo por indicativo y retransmite cada cambio a todas las tablets.
- **Contrato mínimo** (deltas por vuelo): `{ stripState, clearance, assignedTo,
  updatedAt }`. El piloto lee `clearance` y escribe `assigned`/`acknowledged`; el
  controlador escribe `ready`/`clear`/`recall`. Se persiste en
  `.clearto-state.json` (gitignored) para sobrevivir reinicios.
- **Mensajes cliente→servidor:** `assign` (piloto toma el vuelo), `ready`/
  `unready` (controlador entrega/retira), `clear` (edita autorización), `wilco`
  (readback), `recall`. Servidor→clientes: `snapshot` (estado completo).
- **`netlink.js`** encapsula todo esto (`Net.assign/ready/clear/wilco/recall`) y,
  si no hay servidor, cae a **offline/localStorage** (misma API) para GitHub
  Pages. El rol se fija con `?role=atc` o `window.CLEARTO_ROLE="atc"`.

Verificado con Playwright (dos contextos = dos tablets): asignar → MARCAR LISTA →
el piloto recibe la CRAFT en vivo → WILCO → la franja muestra RECIBIDA; edición
inline del controlador se sincroniza; y el modo offline persiste tras recarga.

---

## 4. Las 4 pestañas

1. **Tablero** — banner del aeródromo (RWY en uso, viento, QNH, temp, TL, elev),
   caution operacional, estado de enlaces de datos DGAC, acceso rápido a solicitar
   clearance, frecuencias de control.
2. **D-ATIS** — toggle DEP (INFO ROMEO) / ARR (INFO QUEBEC), delta vs ATIS previo,
   métricas (viento, QNH, visibilidad, temp/rocío), pistas activas, telegrama raw
   con copiar/imprimir, confirmar lectura.
3. **D-Clearance** — **corazón de la app**: buscador de vuelo → **ASIGNAR ESTE
   VUELO** → autorización en orden **CRAFT** (sin estado de otros vuelos) → botón
   **WILCO** que dispara el readback digital. Si el controlador aún no libera,
   muestra "en espera".
4. **Historial** — registro de transmisiones (PDC, D-ATIS, NOTAM) con estados
   WILCO/ACK, superseded, completed; export a "binder de vuelo (PDF)".

---

## 5. Iconos

Se entregaron **3 opciones** en `design/` (SVG editables):

- **`icon-1.svg` — Radar + check** *(elegida como default de la PWA)*: barrido de
  radar sobre fondo navy, silueta de aeronave, badge verde de check. Lee "vigilancia
  + autorización aprobada" de un vistazo.
- **`icon-2.svg` — Uplink datalink + check**: aeronave ascendente sobre ondas de
  señal (uplink), fondo verde institucional, badge navy. Enfatiza "datalink".
- **`icon-3.svg` — Ruta con waypoints + destino aprobado**: ruta punteada
  origen→waypoint→aeronave→check. Enfatiza "route clearance".

Para cambiar el icono default: edita `icons/` regenerando PNG desde otro SVG
(192/512 + maskable). Si tienes `cairosvg`:
`cairosvg design/icon-2.svg -o icons/icon-192.png -W 192 -H 192` (repite para 512).

---

## 6. Deploy a GitHub Pages

La app es 100% estática en runtime; sirve desde la raíz del repo. `styles.css`
(Tailwind compilado) y `vendor/jspdf.umd.min.js` se versionan, así que **Pages no
necesita build** — solo servir los archivos.

```bash
# GitHub → Settings → Pages → Source: Deploy from a branch → main / (root)
```

Si editas el HTML/JS y agregas clases nuevas de Tailwind, **regenera el CSS antes
de commitear**:

```bash
npm install        # solo la primera vez (dev-only; no va al runtime)
npm run build:css  # regenera styles.css escaneando index.html/app.js/data.js
```

Rutas ya **relativas** (`./`, `icons/…`, `vendor/…`) para que funcione bajo
`https://<usuario>.github.io/clearto-scel/`. Si el service worker se comporta raro
en un subpath, confirma que `scope` y `start_url` del manifest siguen relativos.
Tras cambios, recuerda que el SW cachea: bump de `CACHE` en `sw.js` (hoy
`clearto-v2` → `v3`) para forzar actualización.

---

## 7. Backlog priorizado (próximos pasos)

**P0 — Integración con la franja de progreso de vuelo:** ✅ MAYORMENTE HECHO
- ✅ Franja electrónica del controlador (`atc.html`/`atc.js`) basada en la imagen
  real (LXP376, JAT044, LAN740, LAN102, LAE2541, LAP1325; RWY 17R; rutas/SID/
  niveles/freq de la franja).
- ✅ Transporte real entre las dos tablets: WebSocket a `server.js` (Node puro,
  sin dependencias) en la misma LAN, con contrato mínimo por indicativo y
  fallback offline. Ver §3.1.
- ✅ Autorización del piloto en orden **CRAFT** y D-Clearance simplificado
  (buscar + ASIGNAR, sin estado de otros vuelos).
- ⏳ **Datos a confirmar con Felipe** (marcados `TODO` en `data.js`): SSR reales
  del resto de vuelos (solo LAE2541=5370 venía en la foto; el resto son
  `ssrSim`), y el sentido de "280 RCLE" (lo modelé como nivel inicial + nota).
- ⏳ **Tablero con eAIP:** poblar `SCEL` en `data.js` con datos reales del eAIP
  (pistas, TL, elevación, frecuencias, cautions) cuando Felipe lo comparta.
- ⏳ Estado `delivered` explícito (piloto abrió pero no colacionó): el server ya
  lo soporta; falta que el piloto emita `delivered` al abrir la autorización.
- ⏳ Endurecer el server para producción (varios clientes, TLS/wss opcional en LAN,
  autenticación básica del rol controlador).

**P1 — Robustez de la maqueta:** ✅ HECHO (esta iteración)
- ✅ Timestamps vivos en PDC/ATIS: los tiempos se derivan del reloj Z real vía
  offsets en `data.js` (`issuedAgoMin` / `validForMin`); los telegramas se arman
  en `app.js` (`atisRaw` / `pdcRaw`) con la hora de emisión viva y muestran la
  edad de recepción ("RECIBIDO hh:mmZ · hace N min"), refrescada sola.
- ✅ Validación de expiración de clearance con aviso visual: chip VIGENTE /
  POR EXPIRAR (ámbar, <10 min) / EXPIRADA (rojo). Al expirar, el WILCO se
  deshabilita y se ofrece "solicitar nueva autorización"; se revalida al colacionar.
- ✅ Estados de error/vacío del buscador: match exacto + parcial (`includes`),
  chip de resultados con "limpiar", estado vacío enriquecido y aviso de formato
  de indicativo no reconocido (regex `CALLSIGN_RE`).

**P2 — Pulido / features:**
- ✅ Tailwind CDN → CSS compilado local (`styles.css`, build con `npm run build:css`).
- ✅ Export real a PDF del historial con **jsPDF vendorizado** (`vendor/`,
  offline). `buildBinder()` arma el binder desde datos vivos; fallback a hoja
  imprimible si jsPDF no cargara.
- ✅ Imprimir telegrama (D-ATIS): antes placeholder, ahora abre hoja monoespaciada
  y dispara `print()` (`printTelegram`).
- ⏳ i18n opcional EN/ES (Felipe además es instructor de inglés aeronáutico).
- ⏳ Formalizar el smoke test de Playwright en el repo (hoy se corre manual;
  cubre: render, ATIS vivo, búsqueda parcial/vacía, ciclo WILCO, export PDF).
- ⏳ Opcional: vendorizar las fuentes (Public Sans / JetBrains Mono / Material
  Symbols) para eliminar la última dependencia de red y offline 100%.

**Notas de dominio (respetar):**
- No inventar procedimientos: SID, mínimos, frecuencias y RWY deben venir de datos
  reales cuando exista fuente. Los actuales son plausibles pero **simulados**.
- WILCO = "will comply"; el colacionado es un requisito operacional, no cosmético.
  Mantener el readback explícito y auditable (queda registrado en Historial).

---

## 8. Cómo probar localmente

**Dos tablets (piloto + controlador) en la misma red — recomendado:**

```bash
npm start          # = node server.js  (imprime las URLs con la IP de la LAN)
# Controlador →  http://<ip>:8080/atc     Piloto →  http://<ip>:8080/
```

Demo del ciclo en vivo: en `/atc` pulsa **MARCAR LISTA** en un vuelo `pending`
(p. ej. **LXP376**) → en el piloto busca ese indicativo → **ASIGNAR ESTE VUELO**
→ recibe la **autorización CRAFT** → **WILCO** → la franja del controlador muestra
**AUTORIZACIÓN RECIBIDA**. LAN740/LAN102 ya vienen `ready` (asignar y ver CRAFT al
tiro) y LAE2541 ya viene `acknowledged` (para el historial).

**Solo la app del piloto (estático, sin servidor):**

```bash
npm run serve:static   # python3 -m http.server 8000
# http://localhost:8000  → DevTools → vista móvil (modo offline/localStorage)
```

Si vas a tocar el diseño, corre el watcher de CSS en paralelo (`npm run watch:css`).
