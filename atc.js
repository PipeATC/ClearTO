// ============================================================
// ClearTO ATC — Franja electrónica de progreso de vuelo (controlador).
// La otra mitad del sistema: el controlador completa/entrega la
// autorización y ve el readback (WILCO) del piloto en tiempo real.
// Sincroniza con la tablet del piloto vía NetLink (server LAN).
// Datos y orden CRAFT desde data.js (imagen de referencia).
// ============================================================
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $("#app");
  let editing = null; // callsign en modo edición inline

  const pad2 = n => String(n).padStart(2, "0");
  function nowZ() { const d = new Date(); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}Z`; }

  // Estado de la franja → etiqueta + estilo.
  const STATE = {
    pending:      { txt: "EN PROCESO",    cls: "bg-slate-100 text-slate-600 border-slate-300", cs: "text-navy" },
    ready:        { txt: "LISTA · ENTREGADA", cls: "bg-emerald-50 text-emerald-800 border-emerald-300", cs: "text-emerald-700" },
    delivered:    { txt: "ENTREGADA",     cls: "bg-sky-50 text-sky-800 border-sky-300", cs: "text-sky-700" },
    acknowledged: { txt: "RBACK · WILCO", cls: "bg-emerald-600 text-white border-emerald-600", cs: "text-emerald-700" }
  };

  function connPill() {
    const on = window.Net && Net.online;
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${on ? "bg-emerald-50 border-emerald-300" : "bg-slate-100 border-slate-300"} border">
      <span class="w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}"></span>
      <span class="text-[10px] font-mono font-bold ${on ? "text-emerald-800" : "text-slate-500"}">${on ? "ENLACE LAN ACTIVO" : "OFFLINE (LOCAL)"}</span>
    </span>`;
  }

  function header() {
    return `
    <header class="sticky top-0 z-40 bg-navy text-white pt-safe shadow-md">
      <div class="px-4 h-14 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="material-symbols-outlined text-[24px] text-emerald-400">dvr</span>
          <div class="flex flex-col min-w-0">
            <span class="text-[13px] font-bold tracking-wide leading-tight">FRANJA ELECTRÓNICA · SCEL</span>
            <span class="text-[10px] font-mono text-sky-200 leading-tight">DELIVERY / CLEARANCE · DGAC CHILE</span>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <div class="flex flex-col items-end leading-tight">
            <span class="text-[11px] font-mono text-sky-200">DEP RWY 17R · ATIS R</span>
            <span class="text-[13px] font-mono font-bold tracking-widest text-emerald-300" id="clockZ">${nowZ()}</span>
          </div>
          ${connPill()}
        </div>
      </div>
    </header>`;
  }

  // Bloque etiqueta/valor compacto de la franja.
  const cell = (label, value, accent = "text-navy") => `
    <div class="flex flex-col min-w-0">
      <span class="text-[9px] font-mono text-slate-400 uppercase tracking-wider">${label}</span>
      <span class="text-[13px] font-mono font-bold ${accent} truncate leading-tight">${value}</span>
    </div>`;

  // Campo editable inline.
  const field = (key, label, value) => `
    <label class="flex flex-col gap-0.5">
      <span class="text-[9px] font-mono text-slate-400 uppercase tracking-wider">${label}</span>
      <input data-edit="${key}" value="${value || ""}" class="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono text-[13px] font-bold text-navy uppercase" />
    </label>`;

  function strip(f) {
    const st = STATE[f.stripState] || STATE.pending;
    const c = f.clearance;
    const pilotHere = !!f.assignedTo;
    const isEditing = editing === f.callsign;

    // Barra de acciones según estado.
    let actions;
    if (f.stripState === "acknowledged") {
      actions = `<div class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-bold font-mono">
          <span class="material-symbols-outlined text-[18px]">done_all</span> AUTORIZACIÓN RECIBIDA</div>`;
    } else if (f.stripState === "ready" || f.stripState === "delivered") {
      actions = `
        <button data-recall="${f.callsign}" class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-[12px] font-bold font-mono active:scale-[0.98]">
          <span class="material-symbols-outlined text-[18px]">undo</span> RETIRAR</button>
        <div class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-[12px] font-bold font-mono">
          <span class="material-symbols-outlined text-[18px]">hourglass_top</span> ESPERANDO RBACK</div>`;
    } else {
      actions = `
        <button data-edit-toggle="${f.callsign}" class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-[12px] font-bold font-mono active:scale-[0.98]">
          <span class="material-symbols-outlined text-[18px]">edit</span> ${isEditing ? "CERRAR" : "EDITAR"}</button>
        <button data-ready="${f.callsign}" class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-[12px] font-bold font-mono active:scale-[0.98] shadow-sm">
          <span class="material-symbols-outlined text-[18px]">check_circle</span> MARCAR LISTA</button>`;
    }

    const ssrSim = c.ssrSim ? `<span class="text-[8px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-mono font-bold border border-amber-300 ml-1">SIM</span>` : "";

    const body = isEditing ? `
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200">
        ${field("limit", "Límite", c.limit)}
        ${field("route", "Ruta", c.route)}
        ${field("level", "Nivel", c.level)}
        ${field("rwy", "Pista", c.rwy)}
        ${field("sid", "SID", c.sid)}
        ${field("freq", "Frecuencia", c.freq)}
        ${field("ssr", "SSR", c.ssr)}
        <div class="col-span-2 sm:col-span-3 flex gap-2 justify-end mt-1">
          <button data-edit-cancel="1" class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-[12px] font-bold font-mono">CANCELAR</button>
          <button data-edit-save="${f.callsign}" class="px-3 py-1.5 rounded-lg bg-navy text-white text-[12px] font-bold font-mono">GUARDAR</button>
        </div>
      </div>`
      : `
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-3 gap-y-2 mt-2">
        ${cell("Límite", c.limit + " · " + c.limitName)}
        ${cell("Ruta", c.route)}
        ${cell("Nivel", c.level + (c.levelNote ? " " + c.levelNote : ""))}
        ${cell("Pista", "RWY " + c.rwy, "text-sky-700")}
        ${cell("SID", c.sid)}
        ${cell("Frecuencia", c.freq)}
        ${cell("SSR", c.ssr + ssrSim, "text-amber-700")}
      </div>`;

    return `
      <div class="w-full bg-white border ${f.stripState === "acknowledged" ? "border-emerald-300" : "border-slate-200"} rounded-xl shadow-sm overflow-hidden">
        <div class="p-3.5">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <!-- Identificación del vuelo -->
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="text-[20px] font-mono font-black ${st.cs} tracking-wide leading-none">${f.callsign}</span>
                  ${pilotHere && f.stripState !== "acknowledged" ? `<span class="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono font-bold"><span class="material-symbols-outlined text-[12px]">person</span>PILOTO</span>` : ""}
                </div>
                <span class="text-[11px] font-mono text-slate-500 leading-tight mt-0.5">${f.type} · ${f.adep}→${f.ades} · EOBT ${f.eobt} · ${f.stand}</span>
              </div>
            </div>
            <!-- Estado + acciones -->
            <div class="flex items-center gap-2 flex-wrap justify-end">
              <span class="text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${st.cls}">${st.txt}</span>
              ${actions}
            </div>
          </div>
          ${body}
        </div>
      </div>`;
  }

  function render() {
    const flights = (window.FLIGHTS || []).slice().sort((a, b) => (a.eobt || "").localeCompare(b.eobt || ""));
    const pend = flights.filter(f => f.stripState === "pending").length;
    const ready = flights.filter(f => f.stripState === "ready" || f.stripState === "delivered").length;
    const ack = flights.filter(f => f.stripState === "acknowledged").length;

    app.innerHTML = `
      ${header()}
      <main class="max-w-4xl mx-auto w-full px-3 sm:px-4 pb-10">
        <!-- Resumen -->
        <div class="flex items-center gap-2 py-3 flex-wrap">
          <span class="text-[11px] font-mono text-slate-500 tracking-wide">SALIDAS SCEL ·</span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300 font-mono font-bold">${pend} EN PROCESO</span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-bold">${ready} ENTREGADAS</span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white border border-emerald-600 font-mono font-bold">${ack} RECIBIDAS</span>
          <span class="ml-auto text-[10px] font-mono text-slate-400" id="stripSync">SYNC ${nowZ()}</span>
        </div>
        <div class="flex flex-col gap-2.5">
          ${flights.map(strip).join("")}
        </div>
        <p class="text-center text-[10px] text-slate-400 font-mono mt-4">
          Franja electrónica ClearTO · marca <b>LISTA</b> para entregar la autorización al piloto por datalink. El readback (WILCO) llega en vivo.
        </p>
      </main>`;
    wire();
  }

  function toast(msg, icon = "check_circle") {
    const t = document.createElement("div");
    t.className = "fixed left-1/2 -translate-x-1/2 bottom-6 z-[100] bg-navy text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-[13px] font-semibold";
    t.innerHTML = `<span class="material-symbols-outlined text-[18px]">${icon}</span>${msg}`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2000);
  }

  function wire() {
    document.querySelectorAll("[data-ready]").forEach(b => b.onclick = () => {
      Net.ready(b.dataset.ready); toast(b.dataset.ready + ": autorización ENTREGADA ✓", "check_circle"); render();
    });
    document.querySelectorAll("[data-recall]").forEach(b => b.onclick = () => {
      Net.recall(b.dataset.recall); toast(b.dataset.recall + ": entrega retirada", "undo"); render();
    });
    document.querySelectorAll("[data-edit-toggle]").forEach(b => b.onclick = () => {
      const cs = b.dataset.editToggle; editing = editing === cs ? null : cs; render();
    });
    document.querySelectorAll("[data-edit-cancel]").forEach(b => b.onclick = () => { editing = null; render(); });
    document.querySelectorAll("[data-edit-save]").forEach(b => b.onclick = () => {
      const cs = b.dataset.editSave;
      const patch = {};
      document.querySelectorAll("[data-edit]").forEach(inp => {
        patch[inp.dataset.edit] = inp.value.trim().toUpperCase();
      });
      // El SSR editado deja de ser "simulado".
      if (patch.ssr) patch.ssrSim = false;
      Net.clear(cs, patch);
      editing = null; toast(cs + ": autorización actualizada", "edit"); render();
    });
  }

  // Reloj + sync en vivo.
  setInterval(() => {
    const c = $("#clockZ"); if (c) c.textContent = nowZ();
    const s = $("#stripSync"); if (s) s.textContent = "SYNC " + nowZ();
  }, 15000);

  if (window.Net) {
    Net.onChange(() => render());
    Net.onStatus(() => render());
    Net.connect();
  }
  render();
})();
