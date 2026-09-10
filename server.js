#!/usr/bin/env node
// ============================================================
// ClearTO — Servidor LAN (piloto ⇄ controlador) en la misma red.
//
// - Sirve la app estática (index.html = piloto, atc.html = controlador).
// - WebSocket en /ws (implementado con módulos nativos: SIN dependencias).
// - Mantiene el estado autoritativo del ciclo de autorización por
//   indicativo y lo retransmite a todas las tablets conectadas.
// - Persiste el estado en .clearto-state.json (sobrevive reinicios).
//
// Uso:   node server.js            (puerto 8080)
//        PORT=9000 node server.js
// Luego abre en las tablets las URLs que imprime al arrancar.
// ============================================================
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || process.argv[2] || "8080", 10);
const STATE_FILE = path.join(ROOT, ".clearto-state.json");
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// ---- Estado autoritativo: solo deltas por indicativo ----
// { [callsign]: { stripState?, clearance?, assignedTo?, updatedAt } }
let state = {};
try { state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) || {}; } catch (e) { state = {}; }
let saveT = null;
function persist() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); } catch (e) {} }, 200);
}

// ---- Servidor HTTP estático ----
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon"
};
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  if (urlPath === "/atc") urlPath = "/atc.html";
  // Evita path traversal.
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

// ---- WebSocket mínimo (RFC 6455, nativo) ----
const clients = new Set();

server.on("upgrade", (req, socket) => {
  if (!(req.url || "").startsWith("/ws")) { socket.destroy(); return; }
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    "Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
  );
  clients.add(socket);
  socket.on("data", buf => { try { onFrames(socket, buf); } catch (e) {} });
  const drop = () => { clients.delete(socket); try { socket.destroy(); } catch (e) {} };
  socket.on("close", drop);
  socket.on("error", drop);
  // Snapshot inicial al recién llegado.
  sendFrame(socket, JSON.stringify({ type: "snapshot", flights: state }));
});

// Buffer de frames por socket (los mensajes son pequeños; un frame por mensaje).
function onFrames(socket, buf) {
  let offset = 0;
  while (offset < buf.length) {
    if (buf.length - offset < 2) break;
    const b0 = buf[offset], b1 = buf[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let p = offset + 2;
    if (len === 126) { len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) { len = Number(buf.readBigUInt64BE(p)); p += 8; }
    let mask;
    if (masked) { mask = buf.slice(p, p + 4); p += 4; }
    if (p + len > buf.length) break; // frame incompleto
    const payload = buf.slice(p, p + len);
    if (masked && mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    offset = p + len;

    if (opcode === 0x8) { clients.delete(socket); try { socket.destroy(); } catch (e) {} return; } // close
    if (opcode === 0x9) { sendFrame(socket, payload, 0xA); continue; } // ping -> pong
    if (opcode === 0x1) { try { handleMessage(JSON.parse(payload.toString("utf8"))); } catch (e) {} }
  }
}

function sendFrame(socket, data, opcode) {
  opcode = opcode || 0x1;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
  const len = payload.length;
  let header;
  if (len < 126) { header = Buffer.from([0x80 | opcode, len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  try { socket.write(Buffer.concat([header, payload])); } catch (e) {}
}

function broadcast() {
  const frame = JSON.stringify({ type: "snapshot", flights: state });
  clients.forEach(s => sendFrame(s, frame));
}

function entry(cs) { return (state[cs] = state[cs] || {}); }

// ---- Lógica del ciclo de autorización ----
function handleMessage(msg) {
  const cs = (msg.callsign || "").toUpperCase();
  if (!cs) return;
  const e = entry(cs);
  switch (msg.type) {
    case "assign":   e.assignedTo = msg.id || true; break; // solo registra al piloto; no toca el estado
    case "ready":    e.stripState = "ready"; if (msg.clearance) e.clearance = Object.assign({}, e.clearance, msg.clearance); break;
    case "unready":  e.stripState = "pending"; break;
    case "clear":    if (msg.clearance) e.clearance = Object.assign({}, e.clearance, msg.clearance); break;
    case "delivered": if (e.stripState === "ready") e.stripState = "delivered"; break;
    case "wilco":    e.stripState = "acknowledged"; break;
    case "recall":   e.stripState = "ready"; delete e.assignedTo; break;
    default: return;
  }
  e.updatedAt = Date.now();
  persist();
  broadcast();
}

// ---- Arranque ----
server.listen(PORT, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  const ips = [];
  Object.values(nets).forEach(list => (list || []).forEach(ni => {
    if (ni.family === "IPv4" && !ni.internal) ips.push(ni.address);
  }));
  console.log("\n  ClearTO — servidor LAN activo (puerto " + PORT + ")\n");
  console.log("  Abre en las tablets (misma red wifi):");
  if (!ips.length) console.log("    http://localhost:" + PORT + "  (no se detectó IP de LAN)");
  ips.forEach(ip => {
    console.log("    Piloto      →  http://" + ip + ":" + PORT + "/");
    console.log("    Controlador →  http://" + ip + ":" + PORT + "/atc");
  });
  console.log("\n  Ctrl+C para detener.\n");
});
