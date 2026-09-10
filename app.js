// ============================================================
// ClearTO — Lógica de la maqueta (SPA de una sola vista)
// Sin backend. Estado en memoria + persistencia local ligera.
// ============================================================
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  // El ciclo de autorización lo sincroniza NetLink (server LAN) con fallback
  // offline por localStorage. Aquí solo leemos FLIGHTS y disparamos acciones.

  // ---- Navegación por pestañas ----
  let activeTab = "dashboard";
  let selectedFlight = null; // callsign asignado (vuelo del piloto)
  let searchQuery = "";      // texto del buscador de vuelos

  // Formato típico de indicativo: 2-3 letras + 1-4 dígitos (+ sufijo opcional).
  const CALLSIGN_RE = /^[A-Z]{2,3}\d{1,4}[A-Z]?$/;

  const app = $("#app");

  // ---------- Tiempo Z vivo y utilidades ----------
  // Ancla de sesión: instante en que arrancó la app. Los telegramas (D-ATIS y
  // PDC) y la vigencia de las autorizaciones se derivan de este reloj real en
  // vez de strings fijos, y se refrescan solos.
  const T0 = new Date();
  const pad2 = n => String(n).padStart(2, "0");
  const zClock   = d => `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}Z`; // 15:40Z
  const zCompact = d => `${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}Z`;  // 1540Z
  const addMin   = (d, m) => new Date(d.getTime() + m * 60000);
  function nowZ() { return zClock(new Date()); }
  const agoMin = d => Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  function humanAge(min) {
    if (min <= 0) return "recién";
    if (min === 1) return "hace 1 min";
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return `hace ${h}h${m ? ` ${m}m` : ""}`;
  }

  // Tiempos derivados de un bloque D-ATIS (emisión / vigencia).
  function atisTimes(a) {
    const issued = addMin(T0, -(a.issuedAgoMin || 0));
    return { issued, valid: addMin(issued, a.validForMin || 60) };
  }
  // Telegrama D-ATIS crudo, armado con el tiempo de emisión vivo.
  function atisRaw(a, t) {
    return [
      `SCEL ATIS DEP ${a.letter} ${zCompact(t.issued)}`,
      `RWY ${a.depRwy} EN USO`,
      `VIENTO ${a.wind}KT VRB 160-220`,
      "VIS 10KM FEW040 BKN100",
      `${a.temp}/${a.dew} Q${a.qnh} NOSIG`,
      `APCH ILS Y ${a.arrRwy}`,
      "EXP SALIDA FLW SID SEGUN PLAN",
      `CONTACTO SANTIAGO AUTORIZACIONES ${SCEL.freqs.delivery} TRAS COLACION`,
      "--- TRANSMISION DIRECTA VIA APP CLEARTO ---",
      "DGAC SCEL ---"
    ].join("\n");
  }
  // Tiempos derivados de una clearance (emisión / expiración).
  function pdcTimes(c) {
    const issued = addMin(T0, -(c.issuedAgoMin || 0));
    return { issued, expires: addMin(issued, c.validForMin || 60) };
  }
  // Traducción de la nota de nivel. RCLE = "request level change en route".
  function levelNoteText(n) {
    if (n === "RCLE") return "Espere nivel superior en ruta";
    return n || "";
  }

  // Telegrama PDC crudo (orden CRAFT), armado con el tiempo de emisión vivo.
  function pdcRaw(f, t) {
    const c = f.clearance;
    return [
      `PDC SCEL ${zCompact(t.issued)} ${f.callsign}`,
      `CLRD TO ${c.limit} VIA ${c.route}`,
      `${c.level}${c.levelNote ? " · " + levelNoteText(c.levelNote).toUpperCase() : ""}`,
      `DEP RWY ${c.rwy} SID ${c.sid}`,
      `SQUAWK ${c.ssr}`,
      `FREQ ${c.freq}`,
      "ENLACE DIRECTO APP CLEARTO DGAC CHILE"
    ].join("\n");
  }
  // Estado de expiración de una clearance con aviso visual.
  function expiryStatus(expires) {
    const rem = Math.round((expires.getTime() - Date.now()) / 60000);
    if (rem < 0) return {
      key: "expired", rem, label: "EXPIRADA", detail: `venció ${zClock(expires)}`,
      cls: "bg-red-50 text-red-700 border-red-200", icon: "error", pulse: false
    };
    if (rem <= 10) return {
      key: "soon", rem, label: "POR EXPIRAR", detail: `${rem} min · exp ${zClock(expires)}`,
      cls: "bg-amber-50 text-amber-800 border-amber-200", icon: "schedule", pulse: true
    };
    return {
      key: "valid", rem, label: "VIGENTE", detail: `exp ${zClock(expires)} · ${rem} min`,
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "schedule", pulse: false
    };
  }
  // Chip de expiración (con id estable para refresco en vivo).
  function expChip(s) {
    return `<div id="expChip" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${s.cls}">
        <span class="material-symbols-outlined text-[16px] ${s.pulse ? "animate-pulse" : ""}">${s.icon}</span>
        <span class="text-[11px] font-mono font-bold">${s.label}</span>
        <span class="text-[10px] font-mono opacity-80">${s.detail}</span>
      </div>`;
  }

  // ---------- Componentes reutilizables ----------
  function header() {
    return `
    <header class="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 pt-safe">
      <div class="h-16 px-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <img src="icons/icon-192.png" alt="ClearTO" class="h-9 w-9 rounded-lg object-contain shadow-sm"/>
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5">
              <span class="font-mono text-[13px] text-navy font-bold tracking-wider">SCEL / SCL</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 font-semibold tracking-wide border border-sky-200/60 font-mono">CLEARTO APP</span>
            </div>
            <span class="text-[15px] font-bold text-navy uppercase tracking-tight">DGAC CHILE</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex flex-col items-end">
            <span class="text-[13px] text-sky-700 font-mono tracking-widest font-bold" id="clockZ">${nowZ()}</span>
            <span class="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 font-mono">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>ONLINE
            </span>
          </div>
          <div class="w-8 h-8 rounded-full bg-navy flex items-center justify-center shrink-0 shadow-sm">
            <span class="material-symbols-outlined text-white text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>`;
  }

  function bottomNav() {
    const item = (id, icon, label) => {
      const on = activeTab === id;
      return `<button data-tab="${id}" class="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 ${on ? "text-primary" : "text-slate-400"}">
        <span class="material-symbols-outlined text-[22px]" style="${on ? "font-variation-settings:'FILL' 1" : ""}">${icon}</span>
        <span class="text-[10px] font-semibold tracking-wide">${label}</span>
      </button>`;
    };
    return `
    <nav class="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 pb-safe">
      <div class="flex items-stretch px-2 pt-1.5 pb-1">
        ${item("dashboard", "dashboard", "Tablero")}
        ${item("datis", "cloud", "D-ATIS")}
        ${item("clearance", "flight_takeoff", "D-Clearance")}
        ${item("history", "history", "Historial")}
      </div>
    </nav>`;
  }

  function card(inner, extra = "") {
    return `<div class="w-full bg-white border border-slate-200/90 rounded-xl shadow-sm ${extra}">${inner}</div>`;
  }

  const dot = c => `<span class="w-2 h-2 rounded-full bg-${c}-500 inline-block shadow-sm"></span>`;

  // Indicador pequeño de estado del enlace LAN (piloto ⇄ controlador).
  function connPill() {
    const on = window.Net && Net.online;
    return `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold ${on ? "text-emerald-700" : "text-slate-400"}">
      <span class="w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}"></span>${on ? "ENLACE LAN" : "OFFLINE"}</span>`;
  }

  // ============================================================
  // PESTAÑA: TABLERO
  // ============================================================
  function viewDashboard() {
    const s = SCEL;
    const met = (label, val, sub) => `
      <div class="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-center">
        <span class="text-[10px] font-semibold text-slate-500 font-mono">${label}</span>
        <span class="text-[13px] text-navy font-mono font-bold mt-0.5">${val}</span>
        <span class="text-[10px] text-slate-500 font-mono">${sub}</span>
      </div>`;

    // Indicador pequeño de conexión (dot + etiqueta).
    const linkChip = l => {
      const on = l.id === "net" ? (window.Net && Net.online) : true;
      const c = on ? l.dot : "slate";
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/70">
        <span class="w-1.5 h-1.5 rounded-full bg-${c}-500 ${on ? "animate-pulse" : ""}"></span>
        <span class="text-[10px] font-mono font-semibold text-slate-600">${l.name}</span>
      </span>`;
    };

    const freq = (label, val) => `
      <div class="flex flex-col items-center p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
        <span class="text-[10px] text-slate-500 font-mono font-semibold">${label}</span>
        <span class="text-[15px] text-navy font-mono font-bold mt-0.5">${val}</span>
      </div>`;

    // Vuelo activo (mío) para acceso rápido a clearance
    const mine = FLIGHTS[0];

    return `
      <div class="flex flex-col w-full px-4 space-y-3 pt-3 select-none">
        <!-- Caution -->
        <div class="w-full bg-[#fef3c7] border border-amber-200/90 rounded-xl p-3.5 shadow-sm flex items-start gap-3 relative overflow-hidden">
          <div class="absolute inset-y-0 left-0 w-1.5 bg-amber-500"></div>
          <span class="material-symbols-outlined text-amber-700 text-[20px] shrink-0 mt-0.5">warning</span>
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-[#92400e] font-bold tracking-wider uppercase font-mono">OPERATIONAL CAUTION</span>
              <span class="text-[11px] text-amber-800/80 font-mono">${s.caution.time}</span>
            </div>
            <p class="font-mono text-[12px] text-[#92400e] mt-0.5 leading-snug font-medium">${s.caution.text}</p>
          </div>
        </div>

        <!-- Banner aeródromo -->
        ${card(`
          <div class="p-4 flex flex-col space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-[20px] font-bold text-navy tracking-tight">${s.icao} / ${s.iata}</span>
                <span class="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-semibold border border-slate-200">${s.name}</span>
              </div>
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                ${dot("emerald")}<span class="text-[11px] text-emerald-800 font-bold tracking-wide font-mono">${s.condition}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2.5 bg-slate-50 border border-slate-200/80 rounded-lg p-3">
              <div class="flex flex-col">
                <span class="text-[10px] text-slate-500 uppercase font-semibold font-mono tracking-wider">Landing In-Use</span>
                <div class="flex items-baseline gap-1.5 mt-0.5">
                  <span class="text-[15px] font-mono text-navy font-bold">RWY ${s.landingRwy}</span>
                  <span class="text-[11px] text-sky-700 font-mono font-semibold">${s.landingProc}</span>
                </div>
              </div>
              <div class="flex flex-col border-l border-slate-200 pl-3">
                <span class="text-[10px] text-slate-500 uppercase font-semibold font-mono tracking-wider">Departures In-Use</span>
                <div class="flex items-baseline gap-1.5 mt-0.5">
                  <span class="text-[15px] font-mono text-navy font-bold">RWY ${s.depRwy}</span>
                  <span class="text-[11px] text-slate-600 font-mono font-semibold">${s.depProc}</span>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-4 gap-2 pt-0.5">
              ${met("WIND", s.wind, s.windUnit)}
              ${met("VIS / CLD", s.vis, s.visNote)}
              ${met("TEMP/DP", s.temp, "°C")}
              ${met("QNH", s.qnh, s.qnhInHg)}
            </div>
            <div class="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-0.5">
              <span>TRANS ALT: <span class="text-navy font-bold">${s.transitionAlt}</span></span>
              <span>TL: <span class="text-navy font-bold">${s.transitionLevel}</span></span>
              <span>ELEV: <span class="text-navy font-bold">${s.elevation}</span></span>
            </div>
            <div class="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100">
              ${met("FIR", s.fir, "SANTIAGO")}
              ${met("MAG VAR", s.magVar, "2022")}
              ${met("ARFF", s.arff, "SEI")}
              ${met("TEMP REF", s.refTemp, "ISA+")}
            </div>
          </div>
        `)}

        <!-- Estado de conexiones (indicadores pequeños) -->
        <div class="flex items-center justify-between px-1">
          <span class="text-[11px] font-mono text-slate-500 tracking-wide">ESTADO DE ENLACES</span>
          <div class="flex items-center gap-1.5">${LINKS.map(linkChip).join("")}</div>
        </div>

        <!-- Acceso rápido a Departure Clearance -->
        ${card(`
          <div class="p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[13px] font-bold text-navy font-mono tracking-wide">DEPARTURE CLEARANCE</span>
              <span class="text-[11px] text-slate-500 font-mono">PDC PROTOCOL</span>
            </div>
            <div class="grid grid-cols-[1fr_auto] gap-2.5">
              <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <span class="material-symbols-outlined text-slate-400 text-[20px]">flight</span>
                <input id="dashCallsign" value="${mine.callsign}" class="w-full bg-transparent font-mono text-[16px] font-bold text-navy tracking-wider outline-none border-0 p-0" />
              </div>
              <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <span class="text-[10px] text-slate-500 font-mono">STAND</span>
                <span class="font-mono text-[16px] font-bold text-navy">${mine.stand}</span>
              </div>
            </div>
            <button id="dashRequest" class="w-full bg-primary hover:bg-primary-dark active:scale-[0.99] transition text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm">
              <span class="material-symbols-outlined text-[20px]">assignment_turned_in</span>
              <span class="tracking-wide">ASIGNAR ESTE VUELO</span>
            </button>
          </div>
        `)}

        <!-- Frecuencias -->
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-[13px] font-bold text-navy font-mono tracking-wide">SCEL CONTROL FREQUENCIES</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-semibold border border-emerald-200">PRIMARY</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              ${freq("DELIVERY", s.freqs.delivery)}
              ${freq("GROUND", s.freqs.ground)}
              ${freq("TOWER", s.freqs.tower)}
            </div>
          </div>
        `)}
      </div>`;
  }

  // ============================================================
  // PESTAÑA: D-ATIS
  // ============================================================
  let atisSide = "dep";
  function viewAtis() {
    const a = ATIS.dep;
    const t = atisTimes(a);            // emisión / vigencia vivas
    const raw = atisRaw(a, t);         // telegrama con tiempo de emisión vivo
    const qbTime = zClock(atisTimes(ATIS.arr).issued); // INFO QUEBEC (previo)
    const bigMetric = (label, val, unit, sub, icon, color) => `
      ${card(`
        <div class="p-3.5 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-500 font-mono tracking-wider">${label}</span>
            <span class="material-symbols-outlined text-slate-400 text-[18px]">${icon}</span>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-[26px] font-mono font-bold ${color}">${val}</span>
            <span class="text-[13px] text-slate-500 font-mono">${unit}</span>
          </div>
          <div class="text-[11px] text-slate-500 font-mono">${sub}</div>
        </div>
      `)}`;

    return `
      <div class="flex flex-col w-full px-4 space-y-3 pt-3 select-none">
        <!-- Uplink header -->
        ${card(`
          <div class="p-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              ${dot("emerald")}
              <div class="flex flex-col">
                <span class="text-[12px] font-bold text-navy font-mono tracking-wide">TELEGRAMA DIGITAL D-ATIS</span>
                <span class="text-[11px] text-slate-500 font-mono">(APP SECURE UPLINK)</span>
              </div>
            </div>
            <span class="text-[11px] px-2 py-1 rounded bg-sky-50 text-sky-800 font-mono font-semibold border border-sky-200/60">${SCEL.freqs.atisDep} D-ATIS</span>
          </div>
        `)}

        <!-- Delta vs previous -->
        <div class="w-full bg-[#fffbeb] border border-amber-200/90 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <span class="material-symbols-outlined text-amber-700 text-[20px] shrink-0 mt-0.5">swap_horiz</span>
          <div class="flex flex-col min-w-0 flex-1">
            <span class="text-[11px] text-[#92400e] font-bold tracking-wider uppercase font-mono">DELTA VS INFO QUEBEC (${qbTime})</span>
            <p class="font-mono text-[12px] text-[#92400e] mt-0.5 leading-snug">QNH descendió <b>1 hPa</b> (1016→1015) · Viento viró <b>10° izquierda</b> · Temp de rocío estable.</p>
          </div>
        </div>

        <!-- Toggle DEP/ARR -->
        <div class="grid grid-cols-2 gap-2">
          <button data-atis="dep" class="flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[13px] ${atisSide==="dep" ? "bg-navy text-white shadow-sm" : "bg-white text-slate-500 border border-slate-200"}">
            <span class="material-symbols-outlined text-[18px]">flight_takeoff</span> DEP · INFO ROMEO
          </button>
          <button data-atis="arr" class="flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[13px] ${atisSide==="arr" ? "bg-navy text-white shadow-sm" : "bg-white text-slate-500 border border-slate-200"}">
            <span class="material-symbols-outlined text-[18px]">flight_land</span> ARR · INFO QUEBEC
          </button>
        </div>

        <div class="flex items-center justify-between px-1">
          <span class="text-[11px] font-mono text-slate-500">EMISIÓN: <b class="text-navy">${zCompact(t.issued)}</b></span>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-mono text-slate-500">VIGENCIA: <b class="text-navy">${zCompact(t.valid)}</b></span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-200">LIVE</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5 px-1 -mt-1.5">
          <span class="material-symbols-outlined text-slate-400 text-[14px]">cell_tower</span>
          <span class="text-[11px] font-mono text-slate-500">RECIBIDO ${zClock(T0)} · <span id="atisAge">${humanAge(agoMin(T0))}</span></span>
        </div>

        <!-- Metrics grid -->
        <div class="grid grid-cols-2 gap-2.5">
          ${bigMetric("SURFACE WIND", a.wind, "KT", "VRB " + a.windVrb, "air", "text-navy")}
          ${bigMetric("ALTIMETER / QNH", a.qnh, "hPa", a.qnhInHg + " inHg", "speed", "text-primary")}
          ${bigMetric("VISIBILITY", a.vis, "", a.clouds, "visibility", "text-navy")}
          ${bigMetric("TEMP / DEW", a.temp + "°C", "/ " + a.dew + "°C", "SPREAD: " + a.spread + "°C · RH ~" + a.rh + "%", "device_thermostat", "text-navy")}
        </div>

        <!-- Active runways -->
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">${dot("sky")}<span class="text-[13px] font-bold text-navy font-mono tracking-wide">ACTIVE RUNWAYS</span></div>
              <span class="text-[11px] text-sky-700 font-mono font-semibold">ILS / VISUAL APCH</span>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <div class="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div class="flex flex-col"><span class="text-[10px] text-slate-500 font-mono">DEPARTURE</span><span class="text-[18px] font-mono font-bold text-navy">RWY ${a.depRwy}</span></div>
                <span class="material-symbols-outlined text-slate-400">north</span>
              </div>
              <div class="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div class="flex flex-col"><span class="text-[10px] text-slate-500 font-mono">ARRIVAL</span><span class="text-[18px] font-mono font-bold text-navy">RWY ${a.arrRwy}</span></div>
                <span class="material-symbols-outlined text-slate-400">south</span>
              </div>
            </div>
          </div>
        `)}

        <!-- Raw telegram -->
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2"><span class="material-symbols-outlined text-slate-500 text-[18px]">terminal</span><span class="text-[12px] font-bold text-navy font-mono tracking-wide">TELEGRAMA DIGITAL D-ATIS</span></div>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-200">CRC: OK</span>
            </div>
            <pre class="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[12px] text-navy leading-relaxed whitespace-pre-wrap">${raw}</pre>
            <div class="grid grid-cols-2 gap-2.5">
              <button data-copy="${encodeURIComponent(raw)}" class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-[13px] active:scale-[0.99] transition">
                <span class="material-symbols-outlined text-[18px]">content_copy</span> COPIAR TEXTO
              </button>
              <button data-print="${encodeURIComponent(raw)}" data-print-title="D-ATIS SCEL DEP · INFO ${a.word} ${zCompact(t.issued)}" class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-[13px] active:scale-[0.99] transition">
                <span class="material-symbols-outlined text-[18px]">print</span> IMPRIMIR
              </button>
            </div>
          </div>
        `)}

        <button id="atisConfirm" class="w-full bg-primary hover:bg-primary-dark active:scale-[0.99] transition text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm">
          <span class="material-symbols-outlined text-[20px]">verified</span> CONFIRMAR LECTURA INFO ${a.word}
        </button>
        <p class="text-center text-[11px] text-slate-400 font-mono pb-1">Confirmación registrada en servidor DGAC Chile · App ClearTO</p>
      </div>`;
  }

  // ============================================================
  // PESTAÑA: D-CLEARANCE
  // ============================================================
  function viewClearance() {
    if (!selectedFlight) return viewClearanceSearch();
    return viewClearanceDetail(selectedFlight);
  }

  // -- Buscador de vuelo (piloto): buscar → ASIGNAR ESTE VUELO --
  function viewClearanceSearch() {
    const q = searchQuery.trim().toUpperCase();
    const match = q ? Net.find(q) : null;
    const badFormat = q && !CALLSIGN_RE.test(q);

    // Tarjeta del vuelo encontrado + botón ASIGNAR ESTE VUELO.
    const matchCard = match ? `
      ${card(`
        <div class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <span class="material-symbols-outlined text-sky-700 text-[24px] shrink-0">flight_takeoff</span>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[20px] font-mono font-bold text-navy tracking-wide">${match.callsign}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">${match.type} / ${match.wtc}</span>
                </div>
                <span class="text-[12px] text-slate-500 font-mono truncate">${match.adep} → ${match.ades} · ${match.adesCity}</span>
              </div>
            </div>
            <div class="flex flex-col items-end">
              <span class="text-[10px] text-slate-400 font-mono">STAND / EOBT</span>
              <span class="text-[13px] font-mono font-bold text-navy">${match.stand} · ${match.eobt}</span>
            </div>
          </div>
          <button data-assign="${match.callsign}" class="w-full bg-primary hover:bg-primary-dark active:scale-[0.99] transition text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-[20px]">assignment_turned_in</span>
            <span class="tracking-wide">ASIGNAR ESTE VUELO</span>
          </button>
          <p class="text-center text-[11px] text-slate-400 font-mono">Al asignarlo recibirás la autorización cuando el controlador la marque lista.</p>
        </div>
      `)}` : "";

    const emptyState = q && !match ? `
      <div class="w-full bg-white border border-slate-200/90 rounded-xl shadow-sm p-5 flex flex-col items-center text-center gap-2">
        <span class="material-symbols-outlined text-slate-300 text-[40px]">flight_land</span>
        <span class="text-[14px] font-bold text-navy">Sin coincidencias para <span class="font-mono">"${q}"</span></span>
        <p class="text-[12px] text-slate-500 leading-snug">${badFormat
          ? "El formato no parece un indicativo. Suele ser 2–3 letras + número (p. ej. <b class='font-mono'>LAN102</b>, <b class='font-mono'>JAT044</b>)."
          : "Ese vuelo no está en las franjas de salida SCEL. Verifica tu indicativo con el controlador."}</p>
        <button id="searchClear" class="mt-1 text-primary font-bold text-[13px] flex items-center gap-1">
          <span class="material-symbols-outlined text-[18px]">close</span> Limpiar
        </button>
      </div>` : "";

    return `
      <div class="flex flex-col w-full px-4 space-y-3 pt-3 select-none">
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-navy text-[20px]">search</span>
                <span class="text-[15px] font-bold text-navy">Buscar mi vuelo</span>
              </div>
              ${connPill()}
            </div>
            <p class="text-[12px] text-slate-500 leading-snug">Ingresa tu indicativo y presiona <b>ASIGNAR ESTE VUELO</b> para recibir la autorización de salida (PDC) por datalink.</p>
            <div class="flex items-center gap-2 bg-slate-50 border ${badFormat ? "border-amber-300" : "border-slate-200"} rounded-lg px-3 py-3">
              <span class="material-symbols-outlined ${badFormat ? "text-amber-500" : "text-slate-400"} text-[20px]">flight</span>
              <input id="searchCallsign" value="${q}" placeholder="Ej. LAN102" class="w-full bg-transparent font-mono text-[16px] font-bold text-navy tracking-wider outline-none border-0 p-0 uppercase placeholder:font-normal placeholder:text-slate-300" />
              ${q ? `<button id="searchClear" class="text-slate-400 flex items-center px-1"><span class="material-symbols-outlined text-[18px]">close</span></button>` : ""}
              <button id="searchGo" class="text-primary font-bold text-[13px] px-2">BUSCAR</button>
            </div>
            ${badFormat ? `<p class="text-[11px] text-amber-700 font-mono flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">info</span> Formato de indicativo no reconocido.</p>` : ""}
          </div>
        `)}
        ${matchCard}
        ${emptyState}
      </div>`;
  }

  // Fila etiqueta/valor de la autorización en orden CRAFT.
  function craftRow(n, label, value, opts) {
    opts = opts || {};
    return `
      <div class="flex items-center gap-3 px-3 py-2.5 ${opts.hl ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-slate-200/80"} rounded-lg">
        <span class="w-6 h-6 shrink-0 rounded-full ${opts.hl ? "bg-amber-500" : "bg-navy"} text-white text-[11px] font-mono font-bold flex items-center justify-center">${n}</span>
        <span class="text-[10px] text-slate-500 uppercase font-semibold font-mono tracking-wider w-24 shrink-0">${label}</span>
        <span class="text-[15px] font-mono font-bold ${opts.hl ? "text-amber-800" : "text-navy"} tracking-wide flex-1 min-w-0">${value}</span>
        ${opts.badge || ""}
      </div>`;
  }

  // -- Detalle: espera de autorización o autorización CRAFT + readback --
  function viewClearanceDetail(callsign) {
    const f = Net.find(callsign);
    if (!f) { selectedFlight = null; return viewClearanceSearch(); }
    const c = f.clearance;
    const acked = f.stripState === "acknowledged";
    const released = f.stripState === "ready" || f.stripState === "delivered" || acked;
    const t = pdcTimes(c);
    const exp = expiryStatus(t.expires);
    const expired = exp.key === "expired";
    const pdcText = pdcRaw(f, t);

    const backBtn = `
      <button id="backSearch" class="flex items-center gap-1 text-slate-500 text-[13px] font-semibold self-start">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span> ${released ? "Volver a búsqueda" : "Cancelar asignación"}
      </button>`;

    // Cabecera del vuelo (común a espera y autorización).
    const flightHeader = card(`
      <div class="p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full ${acked ? "bg-emerald-600 border-emerald-600" : released ? "bg-emerald-50 border-emerald-200" : "bg-sky-50 border-sky-200"} border">
            <span class="material-symbols-outlined ${acked ? "text-white" : released ? "text-emerald-700" : "text-sky-700"} text-[18px]">${acked ? "check_circle" : released ? "verified" : "hourglass_top"}</span>
            <span class="text-[12px] font-bold font-mono ${acked ? "text-white" : released ? "text-emerald-800" : "text-sky-800"}">${acked ? "RECIBIDA · WILCO" : released ? "AUTORIZADO CLEARTO" : "VUELO ASIGNADO"}</span>
          </div>
          ${released ? expChip(exp) : connPill()}
        </div>
        <div class="flex items-end justify-between">
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="text-[28px] font-bold text-navy tracking-tight leading-none">${f.callsign}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">${f.type} / ${f.wtc}</span>
            </div>
            <span class="text-[13px] text-slate-500 font-mono mt-1">${f.adep} → ${f.ades} · ${f.adesCity}</span>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-[10px] text-slate-400 font-mono">STAND / EOBT</span>
            <span class="text-[14px] font-mono font-bold text-navy">${f.stand} · ${f.eobt}</span>
          </div>
        </div>
        ${released ? `
        <div class="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-0.5 border-t border-slate-100">
          <span class="pt-1.5">EMITIDA: <b class="text-navy">${zCompact(t.issued)}</b></span>
          <span class="pt-1.5">RECIBIDA <span id="pdcAge">${humanAge(agoMin(T0))}</span></span>
        </div>` : ""}
      </div>
    `);

    // ----- Estado de ESPERA (asignado, controlador aún no libera) -----
    if (!released) {
      return `
        <div class="flex flex-col w-full px-4 space-y-3 pt-3 select-none">
          ${backBtn}
          ${flightHeader}
          ${card(`
            <div class="p-6 flex flex-col items-center text-center gap-3">
              <span class="material-symbols-outlined text-sky-500 text-[44px] animate-pulse">cloud_sync</span>
              <span class="text-[15px] font-bold text-navy">En espera de autorización</span>
              <p class="text-[12px] text-slate-500 leading-snug max-w-[16rem]">Tu vuelo quedó asignado. El controlador está completando la autorización en la franja; aparecerá aquí en cuanto la marque <b>lista para entregar</b>.</p>
              <div class="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span> ESPERANDO CHECK DEL CONTROLADOR
              </div>
            </div>
          `)}
        </div>`;
    }

    // ----- Autorización liberada: orden CRAFT + readback -----
    return `
      <div class="flex flex-col w-full px-4 space-y-3 pt-3 select-none">
        ${backBtn}
        ${flightHeader}

        <!-- Autorización ATC en orden CRAFT -->
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-sky-700 text-[20px]">verified_user</span>
                <span class="text-[15px] font-bold text-navy leading-tight">AUTORIZACIÓN ATC</span>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded bg-navy text-white font-mono font-bold tracking-widest">CRAFT</span>
            </div>
            <div class="flex flex-col gap-2">
              ${craftRow(1, "Límite", `${c.limit} <span class="text-slate-400 font-normal">· ${c.limitName}</span>`)}
              ${craftRow(2, "Ruta", c.route)}
              ${craftRow(3, "Nivel", `${c.level}${c.levelNote ? `<span class="block text-[10px] text-slate-500 font-normal normal-case leading-tight mt-0.5">${levelNoteText(c.levelNote)}</span>` : ""}`)}
              ${craftRow(4, "Pista", "RWY " + c.rwy)}
              ${craftRow(5, "SID", c.sid)}
              ${craftRow(6, "Frecuencia", c.freq)}
              ${craftRow(7, "SSR", c.ssr, { hl: true })}
            </div>
          </div>
        `)}

        <!-- PDC raw -->
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">${dot("emerald")}<span class="text-[12px] font-bold text-navy font-mono tracking-wide leading-tight">AUTORIZACIÓN DIGITAL PDC<br><span class="text-slate-400 font-normal">(CLEARTO SECURE LINK)</span></span></div>
              <button data-copy="${encodeURIComponent(pdcText)}" class="flex items-center gap-1 text-[12px] text-slate-500 font-semibold border border-slate-200 rounded-lg px-2.5 py-1.5">
                <span class="material-symbols-outlined text-[16px]">content_copy</span> COPIAR
              </button>
            </div>
            <pre class="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[12px] text-navy leading-relaxed whitespace-pre-wrap">${pdcText}</pre>
          </div>
        `)}

        <!-- Readback / WILCO -->
        ${acked ? `
          <div class="w-full bg-emerald-600 rounded-xl p-4 flex items-center justify-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-white text-[22px]">done_all</span>
            <span class="text-white font-bold tracking-wide">READBACK DIGITAL RECIBIDO · CICLO CERRADO</span>
          </div>
          <p class="text-center text-[11px] text-slate-400 font-mono pb-1">La franja de progreso de vuelo muestra: AUTORIZACIÓN RECIBIDA.</p>
        ` : expired ? `
          <div class="w-full bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <span class="material-symbols-outlined text-red-600 text-[22px] shrink-0">error</span>
            <div class="flex flex-col">
              <span class="text-[13px] font-bold text-red-700 font-mono tracking-wide">AUTORIZACIÓN EXPIRADA</span>
              <span class="text-[12px] text-red-700/90 font-mono leading-snug">La vigencia (${zClock(t.expires)}) ha vencido. No es válido colacionar; solicita una nueva autorización al controlador.</span>
            </div>
          </div>
          <button id="reqNewBtn" class="w-full bg-navy hover:bg-navy-muted active:scale-[0.99] transition text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-[22px]">refresh</span>
            <span class="tracking-wide">SOLICITAR NUEVA AUTORIZACIÓN</span>
          </button>
          <p class="text-center text-[11px] text-slate-400 font-mono pb-1">El colacionado (WILCO) queda deshabilitado mientras la clearance esté expirada.</p>
        ` : `
          <button id="wilcoBtn" class="w-full bg-primary hover:bg-primary-dark active:scale-[0.99] transition text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-[22px]">done_all</span>
            <span class="tracking-wide">ACEPTAR Y COLACIONAR (WILCO)</span>
          </button>
          ${exp.key === "soon" ? `<div class="flex items-center justify-center gap-1.5 text-[11px] font-mono text-amber-700"><span class="material-symbols-outlined text-[16px] animate-pulse">schedule</span> Clearance por expirar (${exp.rem} min) — coteja antes de colacionar.</div>` : ""}
          <div class="grid grid-cols-2 gap-2.5">
            <button class="flex items-center justify-center gap-1.5 py-3 rounded-lg border border-slate-200 text-slate-600 font-semibold text-[13px]">
              <span class="material-symbols-outlined text-[18px]">call</span> CONTACTO VOZ
            </button>
            <button class="flex items-center justify-center gap-1.5 py-3 rounded-lg border border-slate-200 text-slate-600 font-semibold text-[13px]">
              <span class="material-symbols-outlined text-[18px]">pause_circle</span> STANDBY
            </button>
          </div>
          <p class="text-center text-[11px] text-slate-400 font-mono pb-1">Autorización y colacionado digital oficial DGAC Chile SCEL vía App ClearTO.</p>
        `}
      </div>`;
  }

  // ============================================================
  // PESTAÑA: HISTORIAL
  // ============================================================
  function viewHistory() {
    const entry = (icon, iconColor, title, tag, tagColor, time, lines, footer, footerColor) => `
      ${card(`
        <div class="p-3.5 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined ${iconColor} text-[20px]">${icon}</span>
              <span class="text-[14px] font-bold text-navy font-mono">${title}</span>
              ${tag ? `<span class="text-[10px] px-1.5 py-0.5 rounded ${tagColor} font-mono font-bold border">${tag}</span>` : ""}
            </div>
            <span class="text-[11px] font-mono text-slate-400">${time}</span>
          </div>
          <div class="bg-slate-50 border border-slate-200/80 rounded-lg p-3 grid grid-cols-3 gap-2 text-[11px] font-mono">${lines}</div>
          ${footer ? `<div class="flex items-center gap-1.5 text-[12px] font-mono ${footerColor}">${footer}</div>` : ""}
        </div>
      `)}`;

    const col = (l, v) => `<div class="flex flex-col"><span class="text-slate-400">${l}</span><span class="text-navy font-bold">${v}</span></div>`;

    return `
      <div class="flex flex-col w-full px-4 space-y-3 pt-3 select-none">
        ${card(`
          <div class="p-3.5 space-y-2.5">
            <div class="flex items-center gap-2"><span class="material-symbols-outlined text-navy text-[20px]">history</span><span class="text-[15px] font-bold text-navy">Historial de transmisiones</span></div>
            <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              <span class="material-symbols-outlined text-slate-400 text-[18px]">search</span>
              <input placeholder="Filtrar transmisión / indicativo" class="w-full bg-transparent text-[13px] text-navy outline-none border-0 p-0 placeholder:text-slate-300" />
            </div>
          </div>
        `)}

        ${entry("flight_takeoff", "text-sky-700", "PDC LAE2541", "WILCO / ACK", "bg-emerald-50 text-emerald-800 border-emerald-200", "15:40Z",
          col("LÍMITE", "KMIA") + col("RUTA", "DONTI") + col("NIVEL", "FL280") + col("PISTA", "17R") + col("SID", "DONTI5B") + col("SSR", "5370"),
          `<span class="material-symbols-outlined text-[16px]">check_circle</span> Crew Readback Confirmed`, "text-emerald-700")}

        ${entry("cloud", "text-sky-700", "D-ATIS SCEL DEP", "ROMEO", "bg-sky-50 text-sky-800 border-sky-200", "15:30Z",
          col("QNH", "1015") + col("WIND", "190/11") + col("RWY", "17R") + col("VIS", "10KM+") + col("TL", "FL195") + col("VERIF", "0x9B4F"),
          `<span class="material-symbols-outlined text-[16px]">verified</span> Transmisión directa vía App ClearTO`, "text-sky-700")}

        ${entry("history", "text-slate-400", "D-ATIS SCEL DEP", "QUEBEC · SUPERSEDED", "bg-amber-50 text-amber-800 border-amber-200", "14:30Z",
          col("QNH", "1016") + col("WIND", "180/08") + col("RWY", "17R") + col("VIS", "10KM+") + col("TL", "FL195") + col("EST", "ARCHIVED"),
          `Superseded by Info ROMEO (15:30Z)`, "text-slate-400")}

        ${entry("flight_takeoff", "text-slate-500", "PDC LAN102", "COMPLETED", "bg-slate-100 text-slate-600 border-slate-200", "13:15Z",
          col("LÍMITE", "SCSE") + col("RUTA", "ANDAK") + col("NIVEL", "FL260") + col("PISTA", "17R") + col("SID", "DONTI1R") + col("SSR", "5374"),
          `<span class="material-symbols-outlined text-[16px]">flight</span> Flight Airborne / En-route`, "text-slate-500")}

        <!-- NOTAM -->
        <div class="w-full bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-2 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-amber-700 text-[20px]">warning</span>
              <span class="text-[14px] font-bold text-navy font-mono">NOTAM ${NOTAM.id}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-bold border border-amber-200">${NOTAM.scope}</span>
            </div>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-mono font-bold border border-red-200">${NOTAM.status}</span>
          </div>
          <p class="font-mono text-[12px] text-navy leading-snug">${NOTAM.text}</p>
          <div class="flex items-center justify-between text-[11px] font-mono text-slate-500"><span>VALID: ${NOTAM.valid}</span><span class="font-bold">${NOTAM.src}</span></div>
        </div>

        <button id="exportPdf" class="w-full bg-primary hover:bg-primary-dark active:scale-[0.99] transition text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm">
          <span class="material-symbols-outlined text-[20px]">picture_as_pdf</span> EXPORTAR A BINDER DE VUELO (PDF)
        </button>
      </div>`;
  }

  // ============================================================
  // TOAST
  // ============================================================
  function toast(msg, icon = "check_circle") {
    const t = document.createElement("div");
    t.className = "fixed left-1/2 -translate-x-1/2 bottom-24 z-[100] bg-navy text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-[13px] font-semibold";
    t.innerHTML = `<span class="material-symbols-outlined text-[18px]">${icon}</span>${msg}`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2200);
  }

  // ============================================================
  // IMPRESIÓN Y EXPORT PDF
  // ============================================================
  // Imprime un telegrama en una hoja monoespaciada limpia (antes placeholder).
  function printTelegram(text, title) {
    const w = window.open("", "_blank");
    if (!w) return toast("Permite ventanas emergentes para imprimir", "print");
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/>
      <title>${esc(title)}</title>
      <style>
        body{font-family:'JetBrains Mono',ui-monospace,monospace;color:#0b2b5c;margin:32px;}
        h1{font-family:Arial,Helvetica,sans-serif;font-size:15px;border-bottom:2px solid #059669;padding-bottom:6px;}
        pre{white-space:pre-wrap;font-size:12px;line-height:1.55;}
        .foot{margin-top:18px;font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:6px;}
      </style></head><body>
      <h1>ClearTO · ${esc(title)}</h1>
      <pre>${esc(text)}</pre>
      <div class="foot">Impreso vía App ClearTO — DGAC Chile · ${esc(nowZ())}</div>
      </body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 300);
  }

  // Arma el contenido textual del "binder de vuelo" desde los datos vivos.
  function buildBinder() {
    const a = ATIS.dep, at = atisTimes(a), L = [];
    const stName = { pending: "EN PROCESO", ready: "LISTA", delivered: "ENTREGADA", acknowledged: "WILCO/ACK" };
    L.push("BINDER DE VUELO — SCEL / SCL");
    L.push("DGAC CHILE · App ClearTO");
    L.push("Generado: " + zClock(new Date()) + "  (" + new Date().toISOString().slice(0, 10) + ")");
    L.push("");
    L.push("AERODROMO SCEL (" + SCEL.name + ") — " + SCEL.condition);
    L.push("  LDG RWY " + SCEL.landingRwy + " " + SCEL.landingProc + " · DEP RWY " + SCEL.depRwy + " " + SCEL.depProc);
    L.push("  WIND " + SCEL.wind + SCEL.windUnit + " · QNH " + SCEL.qnh + " · TEMP " + SCEL.temp + " · TL " + SCEL.transitionLevel);
    L.push("");
    L.push("== D-ATIS SCEL DEP · INFO " + a.word + " " + zCompact(at.issued) + " ==");
    atisRaw(a, at).split("\n").forEach(l => L.push("  " + l));
    L.push("");
    L.push("== AUTORIZACIONES PDC ==");
    FLIGHTS.forEach(f => {
      const t = pdcTimes(f.clearance);
      L.push("");
      L.push("- " + f.callsign + " (" + f.type + ") " + f.adep + ">" + f.ades + "  [" + (stName[f.stripState] || f.stripState) + "]");
      L.push("  EOBT " + f.eobt + " · STAND " + f.stand + " · EXP " + zClock(t.expires));
      if (f.stripState !== "pending") pdcRaw(f, t).split("\n").forEach(l => L.push("    " + l));
      else L.push("    (autorización aún no emitida)");
    });
    L.push("");
    L.push("== NOTAM " + NOTAM.id + " (" + NOTAM.scope + ") — " + NOTAM.status + " ==");
    L.push("  " + NOTAM.text);
    L.push("  VALID " + NOTAM.valid + " · " + NOTAM.src);
    return L;
  }

  // Exporta el historial/binder a PDF con jsPDF (vendorizado, offline).
  function exportBinderPdf() {
    const lines = buildBinder();
    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) { toast("Abriendo versión imprimible del binder", "print"); return printTelegram(lines.join("\n"), "BINDER DE VUELO SCEL"); }
    try {
      const doc = new JsPDF({ unit: "pt", format: "a4" });
      const margin = 40, top = 58, lh = 13;
      const maxW = doc.internal.pageSize.getWidth() - margin * 2;
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(11, 43, 92);
      doc.text("ClearTO — BINDER DE VUELO", margin, 34);
      doc.setDrawColor(5, 150, 105); doc.setLineWidth(1.5); doc.line(margin, 42, margin + maxW, 42);
      doc.setFont("courier", "normal"); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
      let y = top;
      lines.forEach(line => {
        doc.splitTextToSize(line || " ", maxW).forEach(w => {
          if (y > pageH - margin) { doc.addPage(); y = top; }
          doc.text(w, margin, y); y += lh;
        });
      });
      doc.save("binder-SCEL-" + zCompact(new Date()) + ".pdf");
      toast("PDF del binder generado", "picture_as_pdf");
    } catch (e) {
      toast("No se pudo generar el PDF; abriendo versión imprimible", "error");
      printTelegram(lines.join("\n"), "BINDER DE VUELO SCEL");
    }
  }

  // ============================================================
  // RENDER + EVENTOS
  // ============================================================
  function render() {
    let body = "";
    if (activeTab === "dashboard") body = viewDashboard();
    else if (activeTab === "datis") body = viewAtis();
    else if (activeTab === "clearance") body = viewClearance();
    else if (activeTab === "history") body = viewHistory();

    app.innerHTML = `${header()}
      <main class="flex flex-col relative w-full pt-16 pb-24 bg-surface min-h-screen">${body}</main>
      ${bottomNav()}`;
    wire();
  }

  function wire() {
    // Nav
    document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
      activeTab = b.dataset.tab;
      if (activeTab !== "clearance") selectedFlight = null;
      render();
    });

    // Copiar
    document.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => {
      const txt = decodeURIComponent(b.dataset.copy);
      navigator.clipboard?.writeText(txt).then(() => toast("Copiado al portapapeles", "content_copy")).catch(() => toast("Copiado", "content_copy"));
    });

    // Imprimir telegrama (antes placeholder): abre una hoja monoespaciada limpia.
    document.querySelectorAll("[data-print]").forEach(b => b.onclick = () => {
      printTelegram(decodeURIComponent(b.dataset.print), b.dataset.printTitle || "TELEGRAMA");
    });

    // Dashboard -> asignar este vuelo (acceso rápido)
    const dashReq = $("#dashRequest");
    if (dashReq) dashReq.onclick = () => {
      const cs = ($("#dashCallsign")?.value || "").trim().toUpperCase();
      const f = Net.find(cs);
      if (!f) return toast("Vuelo no encontrado en franjas SCEL", "error");
      Net.assign(cs);
      selectedFlight = cs; activeTab = "clearance"; render();
      toast(cs + " asignado a tu tablet", "assignment_turned_in");
    };

    // ATIS toggle + confirm
    document.querySelectorAll("[data-atis]").forEach(b => b.onclick = () => { atisSide = b.dataset.atis; render(); });
    const atisC = $("#atisConfirm");
    if (atisC) atisC.onclick = () => toast("Lectura de D-ATIS confirmada en DGAC", "verified");

    // Clearance search (solo buscar; la asignación es un botón aparte)
    const go = $("#searchGo");
    if (go) go.onclick = doSearch;
    const inp = $("#searchCallsign");
    if (inp) inp.onkeydown = e => { if (e.key === "Enter") doSearch(); };
    document.querySelectorAll("#searchClear").forEach(b => b.onclick = () => { searchQuery = ""; render(); });
    function doSearch() {
      const cs = ($("#searchCallsign")?.value || "").trim().toUpperCase();
      searchQuery = cs; render();
      if (!cs) return toast("Ingresa un indicativo", "flight");
      if (!Net.find(cs)) toast(`Sin coincidencias para ${cs}`, "search_off");
    }

    // Asignar este vuelo (piloto vincula su vuelo)
    document.querySelectorAll("[data-assign]").forEach(b => b.onclick = () => {
      const cs = b.dataset.assign;
      Net.assign(cs);
      selectedFlight = cs; searchQuery = ""; render();
      toast(cs + " asignado a tu tablet", "assignment_turned_in");
    });

    // Volver a búsqueda / cancelar asignación
    const back = $("#backSearch");
    if (back) back.onclick = () => { selectedFlight = null; render(); };

    // WILCO / readback digital
    const wilco = $("#wilcoBtn");
    if (wilco) wilco.onclick = () => {
      const f = Net.find(selectedFlight);
      if (!f) return;
      // Revalida expiración en el momento de colacionar.
      if (expiryStatus(pdcTimes(f.clearance).expires).key === "expired") {
        toast("Clearance expirada: solicita una nueva", "error");
        return render();
      }
      Net.wilco(f.callsign);
      toast("Readback digital enviado · franja: RECIBIDA", "done_all");
      render();
    };

    // Solicitar nueva autorización (clearance expirada) — maqueta
    const reqNew = $("#reqNewBtn");
    if (reqNew) reqNew.onclick = () => toast("Solicitud de nueva autorización enviada al controlador", "send");

    // Exportar historial a PDF (binder de vuelo)
    const pdfBtn = $("#exportPdf");
    if (pdfBtn) pdfBtn.onclick = exportBinderPdf;
  }

  // ---- Refresco de tiempos en vivo (reloj, edad de telegramas, expiración) ----
  function refreshLive() {
    const clk = $("#clockZ"); if (clk) clk.textContent = nowZ();
    const sync = $("#stripSync"); if (sync) sync.textContent = "SYNC " + nowZ();
    const aa = $("#atisAge"); if (aa) aa.textContent = humanAge(agoMin(T0));
    const pa = $("#pdcAge"); if (pa) pa.textContent = humanAge(agoMin(T0));
    // Chip de expiración en el detalle de clearance
    const chip = $("#expChip");
    if (chip && selectedFlight) {
      const f = FLIGHTS.find(x => x.callsign === selectedFlight);
      if (f) chip.outerHTML = expChip(expiryStatus(pdcTimes(f.clearance).expires));
    }
  }
  setInterval(refreshLive, 15000);

  // ---- NetLink: sincronización con el controlador (server LAN) ----
  if (window.Net) {
    Net.onChange(() => render());
    Net.onStatus(() => render());
    Net.connect();
  }

  render();

  // Registro service worker (PWA)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
