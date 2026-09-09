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

La app es la mitad "piloto" de un sistema de dos dispositivos. La otra mitad es
una **franja de progreso de vuelo (Flight Progress Strip)** que usa el
**controlador** y que **se entregará más adelante** (aún no existe en este repo).

Flujo objetivo de extremo a extremo:

1. El **controlador** completa la autorización en su franja y coloca un **check
   "lista para ser entregada"**.
2. El **piloto** abre ClearTO → pestaña **D-Clearance** → **busca su vuelo** por
   indicativo → **obtiene la autorización** (PDC).
3. El piloto pulsa **ACEPTAR Y COLACIONAR (WILCO)** → se envía un **readback
   digital**.
4. El ciclo se cierra: la **franja del controlador indica "autorización
   recibida"**.

### Modelo de estados de la franja (`stripState` en `data.js`)

| Estado          | Significado                                        | En la UI del piloto |
|-----------------|----------------------------------------------------|---------------------|
| `pending`       | Controlador aún completando la autorización        | Vuelo visible pero no seleccionable ("EN PROCESO") |
| `ready`         | Controlador marcó el check "lista para entregar"   | Seleccionable; muestra la clearance |
| `delivered`     | Piloto ya la obtuvo, aún sin colacionar            | (transitorio; reservado para la integración real) |
| `acknowledged`  | Readback digital recibido → ciclo cerrado          | "RECIBIDA · WILCO", banner CICLO CERRADO |

En la maqueta, el paso 1 se simula con el **panel "Simulador de controlador"** al
final de la pestaña D-Clearance (marca cualquier vuelo `pending` como `ready`). El
estado se persiste en `localStorage` (`clearto_strip_state_v1`) para que el flujo
se sienta real entre recargas. **Ese simulador desaparece cuando exista la franja
real** — ver backlog §7.

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
index.html   App shell + carga de styles.css (Tailwind compilado) + scripts
data.js      TODOS los datos simulados (aeródromo, ATIS, vuelos/franjas, NOTAM). Un solo lugar.
app.js       Lógica: navegación, render, ciclo de clearance, tiempos vivos, PDF, toasts
sw.js        Service worker PWA (cache-first; cachea styles.css y jsPDF; deja pasar fuentes CDN)
styles.css   Tailwind COMPILADO (se versiona). Regenerar con `npm run build:css`.
styles.input.css / tailwind.config.js / package.json   Fuente y config del build de CSS
vendor/      jsPDF vendorizado (jspdf.umd.min.js) para el export a PDF offline
manifest.webmanifest   Metadatos PWA
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

---

## 4. Las 4 pestañas

1. **Tablero** — banner del aeródromo (RWY en uso, viento, QNH, temp, TL, elev),
   caution operacional, estado de enlaces de datos DGAC, acceso rápido a solicitar
   clearance, frecuencias de control.
2. **D-ATIS** — toggle DEP (INFO ROMEO) / ARR (INFO QUEBEC), delta vs ATIS previo,
   métricas (viento, QNH, visibilidad, temp/rocío), pistas activas, telegrama raw
   con copiar/imprimir, confirmar lectura.
3. **D-Clearance** — **corazón de la app**: buscador de vuelo, lista de franjas de
   salida con su estado, simulador de controlador (maqueta), y detalle de la
   autorización con el botón **WILCO** que dispara el readback digital.
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

**P0 — Integración con la franja de progreso de vuelo (cuando llegue el diseño):**
- Reemplazar el "Simulador de controlador" por un transporte real entre dispositivos.
  Opciones sin backend pesado: WebSocket a un broker simple, WebRTC datachannel, o
  un servicio realtime (p. ej. Firebase RTDB / Supabase realtime) solo para el
  campo `stripState` por indicativo.
- Contrato de sincronización sugerido (mantenerlo mínimo): por vuelo,
  `{ callsign, stripState, clearance, updatedAt }`. El piloto solo lee `clearance`
  y escribe `acknowledged`; el controlador escribe todo lo demás.
- Implementar el estado `delivered` real (piloto obtuvo pero no colacionó) para que
  la franja muestre "entregada, pendiente readback".

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

```bash
# desde la carpeta del proyecto
python3 -m http.server 8000    # o: npm start
# abrir http://localhost:8000  (usar DevTools → Toggle device toolbar, móvil)
```

Si vas a tocar el diseño, corre el watcher de CSS en paralelo:

```bash
npm install        # primera vez
npm run watch:css  # recompila styles.css al guardar
```

Flujo de demo: D-Clearance → en el simulador marca **LAN501** como "lista" →
búscalo → obtén la clearance → **WILCO** → verás "CICLO CERRADO". LAN502 ya viene
`ready` y SKU301 ya viene `acknowledged` (para poblar el historial/estados).
