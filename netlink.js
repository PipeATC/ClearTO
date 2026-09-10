// ============================================================
// ClearTO — NetLink: sincronización del ciclo de autorización
// entre las dos tablets (piloto ⇄ controlador) por la misma red.
//
// Transporte: WebSocket a server.js (mismo host/puerto, ruta /ws).
// El SERVIDOR es la fuente de verdad del estado por indicativo.
//
// Fallback OFFLINE (GitHub Pages / sin servidor): si no hay WS,
// trabaja en un solo dispositivo con localStorage — así la maqueta
// se sigue pudiendo demostrar sin levantar el servidor.
//
// API pública (window.Net):
//   Net.role                 'pilot' | 'atc'   (por ?role=atc)
//   Net.online               bool
//   Net.flights              === window.FLIGHTS (mutado in place)
//   Net.connect()            abre el WS (o entra en modo offline)
//   Net.onChange(fn)         se llama tras cada cambio de estado
//   Net.onStatus(fn)         se llama al cambiar online/offline
//   Net.find(callsign)       -> vuelo | null
//   Net.assign(callsign)     piloto vincula el vuelo a su tablet
//   Net.ready(callsign[,cl]) controlador: "lista para entregar"
//   Net.unready(callsign)    controlador: revierte a EN PROCESO
//   Net.clear(callsign, cl)  controlador: edita la autorización
//   Net.wilco(callsign)      piloto: readback digital (WILCO)
//   Net.recall(callsign)     controlador: retira la entrega
// ============================================================
(function () {
  "use strict";

  const LS_KEY = "clearto_strip_state_v1"; // overrides offline (compat maqueta)
  const params = new URLSearchParams(location.search);
  const role = window.CLEARTO_ROLE === "atc" || params.get("role") === "atc" ? "atc" : "pilot";

  const changeCbs = [];
  const statusCbs = [];
  let ws = null;
  let online = false;
  let reconnectT = null;

  const Net = {
    role,
    online: false,
    flights: window.FLIGHTS,
    clientId: role + "-" + Math.random().toString(36).slice(2, 8),
    onChange(fn) { changeCbs.push(fn); },
    onStatus(fn) { statusCbs.push(fn); },
    find(cs) { return window.FLIGHTS.find(f => f.callsign === (cs || "").toUpperCase()) || null; },
  };

  const emitChange = () => changeCbs.forEach(fn => { try { fn(); } catch (e) {} });
  const emitStatus = () => statusCbs.forEach(fn => { try { fn(online); } catch (e) {} });

  // ---- Persistencia offline (solo stripState, como en la maqueta) ----
  function loadOverrides() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveOverride(cs, state) {
    const o = loadOverrides(); o[cs] = state;
    try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function applyOverrides() {
    const o = loadOverrides();
    window.FLIGHTS.forEach(f => { if (o[f.callsign]) f.stripState = o[f.callsign]; });
  }

  // ---- Aplica un snapshot del servidor sobre FLIGHTS ----
  function applySnapshot(snap) {
    if (!snap) return;
    window.FLIGHTS.forEach(f => {
      const s = snap[f.callsign];
      if (!s) return;
      if (s.stripState) f.stripState = s.stripState;
      if (s.assignedTo !== undefined) f.assignedTo = s.assignedTo;
      if (s.clearance) Object.assign(f.clearance, s.clearance);
    });
  }

  // ---- WebSocket ----
  function connect() {
    applyOverrides(); // arranca con lo último conocido (offline)
    openWs();
  }

  function openWs() {
    let url;
    try {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      // En file:// no hay host; se queda offline.
      if (!location.host) throw new Error("no host");
      url = `${proto}//${location.host}/ws?role=${role}&id=${Net.clientId}`;
      ws = new WebSocket(url);
    } catch (e) { goOffline(); return; }

    ws.onopen = () => {
      online = true; Net.online = true;
      emitStatus(); emitChange();
    };
    ws.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === "snapshot") { applySnapshot(msg.flights); emitChange(); }
    };
    ws.onclose = () => { ws = null; goOffline(); scheduleReconnect(); };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }

  function goOffline() {
    if (online || Net.online) { online = false; Net.online = false; emitStatus(); }
    applyOverrides();
  }

  function scheduleReconnect() {
    if (reconnectT) return;
    reconnectT = setTimeout(() => { reconnectT = null; openWs(); }, 3000);
  }

  function send(type, payload) {
    const msg = Object.assign({ type, by: role, id: Net.clientId }, payload);
    if (online && ws && ws.readyState === 1) { ws.send(JSON.stringify(msg)); return true; }
    return false; // el llamador aplica el fallback offline
  }

  // ---- Acciones del ciclo (con fallback offline por localStorage) ----
  function localSet(cs, state, mutate) {
    const f = Net.find(cs); if (!f) return;
    if (mutate) mutate(f);
    if (state) { f.stripState = state; saveOverride(cs, state); }
    emitChange();
  }

  Net.assign = cs => {
    if (!send("assign", { callsign: cs })) {
      localSet(cs, undefined, f => { f.assignedTo = Net.clientId; if (f.stripState === "pending") f.stripState = "pending"; });
    }
  };
  Net.ready = (cs, clearance) => {
    if (!send("ready", { callsign: cs, clearance })) localSet(cs, "ready", f => { if (clearance) Object.assign(f.clearance, clearance); });
  };
  Net.unready = cs => { if (!send("unready", { callsign: cs })) localSet(cs, "pending"); };
  Net.clear = (cs, clearance) => {
    if (!send("clear", { callsign: cs, clearance })) localSet(cs, undefined, f => Object.assign(f.clearance, clearance || {}));
  };
  Net.wilco = cs => { if (!send("wilco", { callsign: cs })) localSet(cs, "acknowledged"); };
  Net.recall = cs => { if (!send("recall", { callsign: cs })) localSet(cs, "ready"); };

  Net.connect = connect;
  window.Net = Net;
})();
