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
- `icons/` — icono de la app (radar, opción 1)
- `design/` — los **3 iconos** a elegir (SVG) + ZIP del diseño Stitch de referencia
- **`CLAUDE.md`** — memoria de proyecto / traspaso para Claude Code (léelo primero)

## Deploy

Estático → **GitHub Pages** (rama `main`, carpeta raíz). Ver `CLAUDE.md` §6.

> Próximo paso: conectar con la **franja de progreso de vuelo** del controlador
> (otro dispositivo). Backlog en `CLAUDE.md` §7.
