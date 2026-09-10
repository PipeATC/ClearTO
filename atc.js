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

  // Banda del indicativo según gestión ATFM (solo estético).
  const atfmBand = f => f.atfm === "regulado" ? "b-yellow" : f.atfm === "liberado" ? "b-green" : "";

  // Campo editable inline (estilo EFS).
  const efield = (key, label, value) => `
    <label><span class="l">${label}</span>
      <input data-edit="${key}" value="${value || ""}" /></label>`;

  // Franja de progreso de vuelo — estilo EFS real.
  function strip(f) {
    const c = f.clearance;
    const reg = f.atfm === "regulado";
    const band = atfmBand(f);
    const pilotHere = !!f.assignedTo && f.stripState !== "acknowledged";
    const isEditing = editing === f.callsign;

    // Ruta → fijo + aerovía (dos líneas).
    const parts = (c.route || "").split(" ");
    const fix = parts[0] || "";
    const awy = parts.slice(1).join(" ");
    const lvl = (c.level || "").replace(/^FL/, "");

    // Celda de acciones (arriba: estado del ciclo; abajo: Form/retirar + ▾ + lápiz).
    let top, bottomLeft;
    if (f.stripState === "acknowledged") {
      top = `<div class="abtn rback done">RBACK ✓</div>`;
      bottomLeft = `<div class="abtn" style="opacity:.55">Form</div>`;
    } else if (f.stripState === "ready" || f.stripState === "delivered") {
      top = `<div class="abtn rback">RBACK…</div>`;
      bottomLeft = `<button class="abtn" data-recall="${f.callsign}">RETIRAR</button>`;
    } else {
      top = `<button class="abtn lista" data-ready="${f.callsign}">LISTA ✓</button>`;
      bottomLeft = `<div class="abtn" style="opacity:.55">Form</div>`;
    }

    const editForm = isEditing ? `
      <div class="efs-edit">
        ${efield("limit", "Límite", c.limit)}
        ${efield("route", "Ruta", c.route)}
        ${efield("level", "Nivel", c.level)}
        ${efield("rwy", "Pista", c.rwy)}
        ${efield("sid", "SID", c.sid)}
        ${efield("freq", "Frecuencia", c.freq)}
        ${efield("ssr", "SSR", c.ssr)}
        <div class="acts">
          <button class="abtn" style="width:auto;padding:5px 12px" data-edit-cancel="1">CANCELAR</button>
          <button class="abtn lista" style="width:auto;padding:5px 12px" data-edit-save="${f.callsign}">GUARDAR</button>
        </div>
      </div>` : "";

    return `
      <div>
        <div class="strip${f.stripState === "acknowledged" ? " ack" : ""}">
          <div class="cel c-id">
            <div class="cs ${band}">${f.callsign}</div>
            <div class="rw"><span class="ty">${f.type}</span>${pilotHere ? `<span class="plt">◉ PLT</span>` : ""}</div>
            <div class="rw ft"><span>${f.ades}</span><span>${c.rwy}</span></div>
          </div>
          <div class="cel c-time">
            <div>${f.eobt}</div>
            <div class="cfl ${reg ? "atfm" : ""}">${f.rfl}</div>
            <div class="ctot">${reg && f.ctot ? "CTOT " + f.ctot : ""}</div>
          </div>
          <div class="cel c-route">
            <div class="rw"><span class="fix">${fix}</span><span class="awy">${awy}</span></div>
            <div class="tick"></div>
            <div class="sid">${c.sid}</div>
          </div>
          <div class="cel c-clr">
            <div class="clr-top"><span class="lvl">${lvl}</span>${c.levelNote ? ` <span class="rcle">${c.levelNote}</span>` : ""}</div>
            <div class="bigB">B</div>
            <div class="freq">${c.freq}&#9651;</div>
          </div>
          <div class="cel c-ssr">
            <div class="lab">SSR</div>
            <div class="val">${c.ssr}</div>
          </div>
          <div class="cel c-coord">
            <div class="nt"></div>
            <div class="cd">COORD</div>
            <div class="rw"><span class="stand">${f.stand}</span><span class="aro">ARO</span></div>
          </div>
          <div class="cel c-act">
            ${top}
            <div class="arow">
              ${bottomLeft}
              <div class="abtn drop">▾</div>
              <span class="pencil" data-edit-toggle="${f.callsign}" title="Editar autorización">✎</span>
            </div>
          </div>
        </div>
        ${editForm}
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
        <div class="efs">
          ${flights.map(strip).join("")}
        </div>
        <!-- Leyenda -->
        <div class="flex items-center gap-x-4 gap-y-1 flex-wrap mt-4 text-[10px] font-mono text-slate-500">
          <span class="font-bold text-slate-600">GESTIÓN ATFM:</span>
          <span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm" style="background:#f2cf2e"></span>Regulado (CTOT) · nivel en cian</span>
          <span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm" style="background:#4fbf3f"></span>Liberado</span>
          <span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm border border-slate-300" style="background:#dfe3e6"></span>Sin gestión</span>
          <span class="ml-2 font-bold text-slate-600">CICLO:</span>
          <span>LISTA ✓ = entregar · RBACK… = esperando readback · RBACK ✓ = recibido · ✎ = editar</span>
        </div>
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
