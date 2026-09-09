// ============================================================
// ClearTO — Lógica de la maqueta (SPA de una sola vista)
// Sin backend. Estado en memoria + persistencia local ligera.
// ============================================================
(function () {
  "use strict";

  const STORE_KEY = "clearto_strip_state_v1";
  const $ = (sel, root = document) => root.querySelector(sel);

  // ---- Estado del ciclo de autorización, persistido localmente ----
  // Simula lo que en producción sincronizaría la franja de progreso.
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveState(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
  }
  const overrides = loadState();

  // Aplica overrides guardados sobre los datos base
  FLIGHTS.forEach(f => {
    if (overrides[f.callsign]) f.stripState = overrides[f.callsign];
  });

  function setStripState(callsign, state) {
    const f = FLIGHTS.find(x => x.callsign === callsign);
    if (!f) return;
    f.stripState = state;
    overrides[callsign] = state;
    saveState(overrides);
  }

  // ---- Navegación por pestañas ----
  let activeTab = "dashboard";
  let selectedFlight = null; // callsign en detalle de D-Clearance

  const app = $("#app");

  function nowZ() {
    const d = new Date();
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}Z`;
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

  // Etiqueta de estado de la franja
  function stripBadge(state) {
    const map = {
      pending:      ["EN PROCESO",  "bg-slate-100 text-slate-600 border-slate-200"],
      ready:        ["LISTA · CLR", "bg-emerald-50 text-emerald-800 border-emerald-200"],
      delivered:    ["ENTREGADA",   "bg-sky-50 text-sky-800 border-sky-200"],
      acknowledged: ["WILCO / ACK", "bg-emerald-600 text-white border-emerald-600"]
    };
    const [txt, cls] = map[state] || map.pending;
    return `<span class="text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${cls}">${txt}</span>`;
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

    const link = l => `
      <div class="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200/70 rounded-lg">
        <div class="flex items-center gap-2.5 min-w-0">
          ${dot(l.dot)}
          <div class="flex flex-col min-w-0">
            <span class="text-[13px] font-bold text-navy truncate">${l.name}</span>
            <span class="text-[11px] text-slate-500 font-mono truncate">${l.sub}</span>
          </div>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-semibold border border-emerald-200 shrink-0">${l.status}</span>
      </div>`;

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
              <span>TRANSITION LEVEL: <span class="text-navy font-bold">${s.transitionLevel}</span></span>
              <span>ELEV: <span class="text-navy font-bold">${s.elevation}</span></span>
            </div>
          </div>
        `)}

        <!-- Enlaces de datos -->
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-sky-700 text-[20px]">sensors</span>
                <span class="text-[16px] font-bold text-navy">ENLACES DE DATOS DGAC</span>
              </div>
              <span class="text-[10px] px-2 py-1 rounded bg-sky-50 text-sky-800 font-mono font-semibold border border-sky-200/60">DGAC CLOUD LINK</span>
            </div>
            ${LINKS.map(link).join("")}
          </div>
        `)}

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
                <span class="text-[10px] text-slate-500 font-mono">GATE</span>
                <span class="font-mono text-[16px] font-bold text-navy">${mine.gate}</span>
              </div>
            </div>
            <button id="dashRequest" class="w-full bg-primary hover:bg-primary-dark active:scale-[0.99] transition text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm">
              <span class="material-symbols-outlined text-[20px]">send</span>
              <span class="tracking-wide">SOLICITAR CLEARANCE (PDC)</span>
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
            <span class="text-[11px] px-2 py-1 rounded bg-sky-50 text-sky-800 font-mono font-semibold border border-sky-200/60">132.125 TWR</span>
          </div>
        `)}

        <!-- Delta vs previous -->
        <div class="w-full bg-[#fffbeb] border border-amber-200/90 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <span class="material-symbols-outlined text-amber-700 text-[20px] shrink-0 mt-0.5">swap_horiz</span>
          <div class="flex flex-col min-w-0 flex-1">
            <span class="text-[11px] text-[#92400e] font-bold tracking-wider uppercase font-mono">DELTA VS INFO QUEBEC (1430Z)</span>
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
          <span class="text-[11px] font-mono text-slate-500">EMISIÓN: <b class="text-navy">${a.time}</b></span>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-mono text-slate-500">VIGENCIA: <b class="text-navy">${a.valid}</b></span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-200">LIVE</span>
          </div>
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
            <pre class="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[12px] text-navy leading-relaxed whitespace-pre-wrap">${a.raw}</pre>
            <div class="grid grid-cols-2 gap-2.5">
              <button data-copy="${encodeURIComponent(a.raw)}" class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-[13px] active:scale-[0.99] transition">
                <span class="material-symbols-outlined text-[18px]">content_copy</span> COPIAR TEXTO
              </button>
              <button class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-[13px] active:scale-[0.99] transition">
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

  // -- Buscador de vuelo --
  function viewClearanceSearch() {
    const row = f => {
      const cd = f.stripState;
      const clickable = (cd === "ready" || cd === "delivered" || cd === "acknowledged");
      return `
        <button data-flight="${f.callsign}" ${clickable ? "" : "disabled"} class="w-full text-left ${clickable ? "active:scale-[0.99]" : "opacity-60 cursor-not-allowed"} transition">
          ${card(`
            <div class="p-3.5 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <span class="material-symbols-outlined text-sky-700 text-[22px] shrink-0">flight_takeoff</span>
                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-[16px] font-mono font-bold text-navy tracking-wide">${f.callsign}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">${f.type} / ${f.wtc}</span>
                  </div>
                  <span class="text-[12px] text-slate-500 font-mono truncate">${f.origin} → ${f.dest} · ${f.destCity}</span>
                </div>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                ${stripBadge(cd)}
                <span class="text-[10px] text-slate-400 font-mono">GATE ${f.gate}</span>
              </div>
            </div>
          `)}
        </button>`;
    };

    return `
      <div class="flex flex-col w-full px-4 space-y-3 pt-3 select-none">
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-navy text-[20px]">search</span>
              <span class="text-[15px] font-bold text-navy">Buscar mi vuelo</span>
            </div>
            <p class="text-[12px] text-slate-500 leading-snug">Ingresa tu indicativo para recibir la autorización de salida (PDC) cuando el controlador la marque lista en la franja de progreso.</p>
            <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3">
              <span class="material-symbols-outlined text-slate-400 text-[20px]">flight</span>
              <input id="searchCallsign" placeholder="Ej. LAN502" class="w-full bg-transparent font-mono text-[16px] font-bold text-navy tracking-wider outline-none border-0 p-0 uppercase placeholder:font-normal placeholder:text-slate-300" />
              <button id="searchGo" class="text-primary font-bold text-[13px] px-2">BUSCAR</button>
            </div>
          </div>
        `)}

        <div class="flex items-center justify-between px-1">
          <span class="text-[11px] font-mono text-slate-500 tracking-wide">FRANJAS DE SALIDA SCEL</span>
          <span class="text-[11px] font-mono text-slate-400" id="stripSync">SYNC ${nowZ()}</span>
        </div>
        ${FLIGHTS.map(row).join("")}

        <!-- Panel simulador de controlador (solo maqueta) -->
        <div class="w-full bg-sky-50/60 border border-dashed border-sky-300 rounded-xl p-3.5 space-y-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-sky-700 text-[18px]">construction</span>
            <span class="text-[12px] font-bold text-sky-900 font-mono">SIMULADOR DE CONTROLADOR (MAQUETA)</span>
          </div>
          <p class="text-[11px] text-sky-800/80 leading-snug">Reemplaza la franja de progreso real. Marca una autorización como <b>lista para entregar</b> y aparecerá disponible para el piloto.</p>
          <div class="flex flex-wrap gap-2">
            ${FLIGHTS.map(f => `<button data-ctrl="${f.callsign}" class="text-[11px] font-mono font-bold px-2.5 py-1.5 rounded-lg border ${f.stripState==="pending" ? "bg-white border-sky-300 text-sky-800" : "bg-emerald-50 border-emerald-300 text-emerald-800"}">${f.callsign}: ${f.stripState==="pending" ? "marcar lista ✓" : "✓ lista"}</button>`).join("")}
          </div>
        </div>
      </div>`;
  }

  // -- Detalle de autorización + readback --
  function viewClearanceDetail(callsign) {
    const f = FLIGHTS.find(x => x.callsign === callsign);
    if (!f) { selectedFlight = null; return viewClearanceSearch(); }
    const c = f.clearance;
    const acked = f.stripState === "acknowledged";

    const block = (label, val, sub, accent = "text-navy") => `
      <div class="flex flex-col bg-slate-50 border border-slate-200/80 rounded-lg p-3">
        <span class="text-[10px] text-slate-500 uppercase font-semibold font-mono tracking-wider">${label}</span>
        <span class="text-[20px] font-mono font-bold ${accent} mt-0.5 leading-tight">${val}</span>
        ${sub ? `<span class="text-[11px] text-slate-500 font-mono mt-0.5">${sub}</span>` : ""}
      </div>`;

    return `
      <div class="flex flex-col w-full px-4 space-y-3 pt-3 select-none">
        <button id="backSearch" class="flex items-center gap-1 text-slate-500 text-[13px] font-semibold self-start">
          <span class="material-symbols-outlined text-[18px]">arrow_back</span> Volver a búsqueda
        </button>

        <!-- Status header -->
        ${card(`
          <div class="p-4 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full ${acked ? "bg-emerald-600 border-emerald-600" : "bg-emerald-50 border-emerald-200"} border">
                <span class="material-symbols-outlined ${acked ? "text-white" : "text-emerald-700"} text-[18px]">${acked ? "check_circle" : "verified"}</span>
                <span class="text-[12px] font-bold font-mono ${acked ? "text-white" : "text-emerald-800"}">${acked ? "RECIBIDA · WILCO" : "AUTORIZADO CLEARTO"}</span>
              </div>
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                <span class="material-symbols-outlined text-amber-700 text-[16px]">schedule</span>
                <span class="text-[11px] font-mono font-bold text-amber-800">EXP: ${c.expires}</span>
              </div>
            </div>
            <div class="flex items-end justify-between">
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="text-[28px] font-bold text-navy tracking-tight leading-none">${f.callsign}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">${f.reg} · ${f.type}</span>
                </div>
                <span class="text-[13px] text-slate-500 font-mono mt-1">${f.origin} → ${f.dest} · ${f.originCity} → ${f.destCity}</span>
              </div>
              <div class="flex flex-col items-end">
                <span class="text-[10px] text-slate-400 font-mono">GATE / EOBT</span>
                <span class="text-[14px] font-mono font-bold text-navy">${f.gate} · ${f.eobt}</span>
              </div>
            </div>
          </div>
        `)}

        <!-- ATC Pre-departure clearance -->
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-sky-700 text-[20px]">verified_user</span>
                <span class="text-[15px] font-bold text-navy leading-tight">ATC PRE-DEPARTURE<br>CLEARANCE</span>
              </div>
              <div class="flex flex-col items-end"><span class="text-[10px] text-slate-400 font-mono">SEQ</span><span class="text-[13px] font-mono font-bold text-navy">${f.seq}</span></div>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              ${block("ASSIGNED SID", c.sid, c.sidNote)}
              ${block("DEPARTURE RWY", "RWY " + c.depRwy, c.rwyNote, "text-sky-700")}
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              ${block("CLIMB ALTITUDE", c.climbAlt, c.climbAltFt + " · " + c.expect)}
              <div class="flex flex-col bg-amber-50 border border-amber-200 rounded-lg p-3 items-center text-center">
                <span class="text-[10px] text-amber-700 uppercase font-semibold font-mono tracking-wider">SQUAWK</span>
                <span class="text-[22px] font-mono font-bold text-amber-800 mt-0.5">${c.squawk}</span>
                <span class="text-[10px] text-amber-700/80 font-mono">${c.squawkNote}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <div class="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div class="flex flex-col"><span class="text-[10px] text-slate-500 font-mono">DELIVERY</span><span class="text-[15px] font-mono font-bold text-navy">${c.freqDelivery}</span></div>
                <span class="material-symbols-outlined text-slate-400 text-[18px]">headset_mic</span>
              </div>
              <div class="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div class="flex flex-col"><span class="text-[10px] text-slate-500 font-mono">SCL GROUND</span><span class="text-[15px] font-mono font-bold text-navy">${c.freqGround}</span></div>
                <span class="material-symbols-outlined text-slate-400 text-[18px]">cell_tower</span>
              </div>
            </div>
          </div>
        `)}

        <!-- PDC raw -->
        ${card(`
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">${dot("emerald")}<span class="text-[12px] font-bold text-navy font-mono tracking-wide leading-tight">AUTORIZACIÓN DIGITAL PDC<br><span class="text-slate-400 font-normal">(CLEARTO SECURE LINK)</span></span></div>
              <button data-copy="${encodeURIComponent(c.pdcText)}" class="flex items-center gap-1 text-[12px] text-slate-500 font-semibold border border-slate-200 rounded-lg px-2.5 py-1.5">
                <span class="material-symbols-outlined text-[16px]">content_copy</span> COPIAR
              </button>
            </div>
            <pre class="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[12px] text-navy leading-relaxed whitespace-pre-wrap">${c.pdcText}</pre>
          </div>
        `)}

        <!-- Readback / WILCO -->
        ${acked ? `
          <div class="w-full bg-emerald-600 rounded-xl p-4 flex items-center justify-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-white text-[22px]">done_all</span>
            <span class="text-white font-bold tracking-wide">READBACK DIGITAL RECIBIDO · CICLO CERRADO</span>
          </div>
          <p class="text-center text-[11px] text-slate-400 font-mono pb-1">La franja de progreso de vuelo muestra: AUTORIZACIÓN RECIBIDA.</p>
        ` : `
          <button id="wilcoBtn" class="w-full bg-primary hover:bg-primary-dark active:scale-[0.99] transition text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-[22px]">done_all</span>
            <span class="tracking-wide">ACEPTAR Y COLACIONAR (WILCO)</span>
          </button>
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

        ${entry("flight_takeoff", "text-sky-700", "PDC LAN502", "WILCO / ACK", "bg-emerald-50 text-emerald-800 border-emerald-200", "15:40Z",
          col("DEP RWY", "17R") + col("SID", "ALKUM 4A") + col("INIT", "FL120") + col("SQUAWK", "4216") + col("CANAL", "CLEARTO") + col("ESTADO", "ACTIVO"),
          `<span class="material-symbols-outlined text-[16px]">check_circle</span> Crew Readback Confirmed`, "text-emerald-700")}

        ${entry("cloud", "text-sky-700", "D-ATIS SCEL DEP", "ROMEO", "bg-sky-50 text-sky-800 border-sky-200", "15:30Z",
          col("QNH", "1015") + col("WIND", "190/11") + col("RWY", "17R") + col("VIS", "10KM+") + col("TL", "FL195") + col("VERIF", "0x9B4F"),
          `<span class="material-symbols-outlined text-[16px]">verified</span> Transmisión directa vía App ClearTO`, "text-sky-700")}

        ${entry("history", "text-slate-400", "D-ATIS SCEL DEP", "QUEBEC · SUPERSEDED", "bg-amber-50 text-amber-800 border-amber-200", "14:30Z",
          col("QNH", "1016") + col("WIND", "180/08") + col("RWY", "17R") + col("VIS", "10KM+") + col("TL", "FL195") + col("EST", "ARCHIVED"),
          `Superseded by Info ROMEO (15:30Z)`, "text-slate-400")}

        ${entry("flight_takeoff", "text-slate-500", "PDC SKU301", "COMPLETED", "bg-slate-100 text-slate-600 border-slate-200", "13:15Z",
          col("DEP RWY", "17R") + col("SID", "EROKA 3B") + col("INIT", "FL170") + col("SQUAWK", "2105") + col("GATE", "22") + col("SLOT", "13:40Z"),
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

        <button class="w-full bg-primary hover:bg-primary-dark active:scale-[0.99] transition text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm">
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

    // Dashboard -> solicitar
    const dashReq = $("#dashRequest");
    if (dashReq) dashReq.onclick = () => {
      const cs = ($("#dashCallsign")?.value || "").trim().toUpperCase();
      const f = FLIGHTS.find(x => x.callsign === cs);
      if (!f) return toast("Vuelo no encontrado en franjas SCEL", "error");
      if (f.stripState === "pending") return toast("Autorización aún no está lista (controlador en proceso)", "hourglass_top");
      selectedFlight = cs; activeTab = "clearance"; render();
    };

    // ATIS toggle + confirm
    document.querySelectorAll("[data-atis]").forEach(b => b.onclick = () => { atisSide = b.dataset.atis; render(); });
    const atisC = $("#atisConfirm");
    if (atisC) atisC.onclick = () => toast("Lectura de D-ATIS confirmada en DGAC", "verified");

    // Clearance search
    const go = $("#searchGo");
    if (go) go.onclick = doSearch;
    const inp = $("#searchCallsign");
    if (inp) inp.onkeydown = e => { if (e.key === "Enter") doSearch(); };
    function doSearch() {
      const cs = ($("#searchCallsign")?.value || "").trim().toUpperCase();
      if (!cs) return toast("Ingresa un indicativo", "flight");
      const f = FLIGHTS.find(x => x.callsign === cs);
      if (!f) return toast("Vuelo no encontrado", "error");
      if (f.stripState === "pending") return toast("Autorización aún no está lista para " + cs, "hourglass_top");
      selectedFlight = cs; render();
    }

    // Filas de vuelo
    document.querySelectorAll("[data-flight]").forEach(b => b.onclick = () => {
      selectedFlight = b.dataset.flight; render();
    });

    // Simulador de controlador
    document.querySelectorAll("[data-ctrl]").forEach(b => b.onclick = () => {
      const cs = b.dataset.ctrl;
      const f = FLIGHTS.find(x => x.callsign === cs);
      if (!f) return;
      if (f.stripState === "pending") { setStripState(cs, "ready"); toast(cs + ": autorización marcada LISTA ✓", "check_circle"); }
      else if (f.stripState === "ready") { setStripState(cs, "pending"); toast(cs + ": vuelta a EN PROCESO", "undo"); }
      render();
    });

    // Volver a búsqueda
    const back = $("#backSearch");
    if (back) back.onclick = () => { selectedFlight = null; render(); };

    // WILCO / readback digital
    const wilco = $("#wilcoBtn");
    if (wilco) wilco.onclick = () => {
      const f = FLIGHTS.find(x => x.callsign === selectedFlight);
      if (!f) return;
      // Simula el intercambio: primero 'delivered' (piloto la tiene), luego ack tras colacionar
      setStripState(f.callsign, "acknowledged");
      toast("Readback digital enviado · franja: RECIBIDA", "done_all");
      render();
    };
  }

  // Reloj Z en vivo
  setInterval(() => { const c = $("#clockZ"); if (c) c.textContent = nowZ(); }, 15000);

  render();

  // Registro service worker (PWA)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
