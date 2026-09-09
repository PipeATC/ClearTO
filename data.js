// ============================================================
// ClearTO — Datos simulados (maqueta). Sin backend.
// En producción esto vendrá del servidor DGAC / franja de
// progreso de vuelo (Flight Progress Strip) vía datalink.
// ============================================================

// Estado del aeródromo SCEL (Comodoro Arturo Merino Benítez / Pudahuel)
window.SCEL = {
  icao: "SCEL",
  iata: "SCL",
  name: "PUDAHUEL",
  condition: "VMC",
  landingRwy: "17L",
  landingProc: "ILS Y",
  depRwy: "17R",
  depProc: "RNAV 1",
  transitionLevel: "FL195",
  transitionAlt: "18000 FT",
  elevation: "1,555 FT",
  wind: "180/08",
  windUnit: "KT",
  vis: ">10K",
  visNote: "CAVOK",
  temp: "18/09",
  qnh: "1016",
  qnhInHg: "30.00",
  caution: {
    time: "15:28Z",
    text: "ATTN: Flock of birds reported in vicinity threshold RWY 17L. Exercise vigilance on final approach."
  },
  freqs: { delivery: "121.10", ground: "121.90", tower: "118.10" }
};

// D-ATIS (salida y llegada)
// Los tiempos ya NO son fijos: se derivan del reloj Z vivo con estos offsets
// (issuedAgoMin = emitida hace N min; validForMin = vigencia en min). El
// telegrama crudo se arma en app.js con esos tiempos para que sea consistente.
window.ATIS = {
  dep: {
    letter: "R", word: "ROMEO",
    issuedAgoMin: 6, validForMin: 60,
    wind: "190/11", windVrb: "160°-220°",
    qnh: "1015", qnhInHg: "29.97",
    vis: "10 KM+", visNote: "CAVOK", clouds: "FEW 4000 · BKN 10000",
    temp: "19", dew: "08", spread: "11", rh: "52",
    depRwy: "17R", arrRwy: "17L"
  },
  arr: {
    letter: "Q", word: "QUEBEC",
    issuedAgoMin: 66, validForMin: 60,
    superseded: true
  }
};

// Enlaces de datos (estado de servidores) — simulado
window.LINKS = [
  { id: "central", name: "SERVIDOR CENTRAL CLEARTO", sub: "CONECTADO IP / TLS 1.3", status: "CONECTADO", dot: "emerald" },
  { id: "datis",   name: "D-ATIS SERVER",           sub: "DEP: INFO R | ARR: INFO Q", status: "ONLINE", dot: "sky" },
  { id: "pdc",     name: "D-CLEARANCE (PDC)",        sub: "PROMEDIO: ~45 SEG", status: "EN LÍNEA / ACTIVO", dot: "emerald" }
];

// ============================================================
// VUELOS — cada uno representa una franja de progreso de vuelo.
// stripState modela lo que el controlador marca en la franja:
//   'pending'  -> controlador aún no completa la autorización
//   'ready'    -> controlador puso el check "lista para entregar"
//   'delivered'-> el piloto la obtuvo en la app (aún sin readback)
//   'acknowledged' -> readback digital recibido; ciclo cerrado
// En la maqueta, 'ready' se puede simular con el botón "Simular
// controlador" para probar el flujo completo sin la franja real.
// ============================================================
window.FLIGHTS = [
  {
    callsign: "LAN502",
    reg: "CC-BBA",
    type: "B789",
    wtc: "H",
    origin: "SCEL", originCity: "SANTIAGO",
    dest: "SPJC", destCity: "LIMA",
    gate: "14B", eobt: "1615Z",
    stripState: "ready",           // controlador ya la dejó lista
    seq: "084",
    clearance: {
      sid: "ALKUM 4A",
      sidNote: "Climb via SID restrictions",
      depRwy: "17R",
      rwyNote: "TORA 3,800M · DRY",
      climbAlt: "FL120",
      climbAltFt: "12,000 FT",
      expect: "Expect FL380 @ 10 MIN",
      squawk: "4216",
      squawkNote: "XPDR MODE C/S",
      freqDelivery: "121.100",
      freqGround: "121.900",
      issuedAgoMin: 4, validForMin: 90
    }
  },
  {
    callsign: "LAN501",
    reg: "CC-BFC",
    type: "A320",
    wtc: "M",
    origin: "SCEL", originCity: "SANTIAGO",
    dest: "SCFA", destCity: "ANTOFAGASTA",
    gate: "14", eobt: "1640Z",
    stripState: "pending",         // controlador aún trabajando
    seq: "085",
    clearance: {
      sid: "EROKA 3B",
      sidNote: "Climb via SID restrictions",
      depRwy: "17R",
      rwyNote: "TORA 3,800M · DRY",
      climbAlt: "FL170",
      climbAltFt: "17,000 FT",
      expect: "Expect FL350 @ 8 MIN",
      squawk: "2105",
      squawkNote: "XPDR MODE C/S",
      freqDelivery: "121.100",
      freqGround: "121.900",
      issuedAgoMin: 1, validForMin: 90
    }
  },
  {
    callsign: "SKU301",
    reg: "CC-AWA",
    type: "A320N",
    wtc: "M",
    origin: "SCEL", originCity: "SANTIAGO",
    dest: "SCFA", destCity: "ANTOFAGASTA",
    gate: "22", eobt: "1705Z",
    stripState: "acknowledged",    // ya completado (histórico)
    seq: "083",
    clearance: {
      sid: "EROKA 3B",
      sidNote: "Climb via SID restrictions",
      depRwy: "17R",
      rwyNote: "TORA 3,800M · DRY",
      climbAlt: "FL170",
      climbAltFt: "17,000 FT",
      expect: "Expect FL350 @ 8 MIN",
      squawk: "2105",
      squawkNote: "XPDR MODE C/S",
      freqDelivery: "121.100",
      freqGround: "121.900",
      issuedAgoMin: 150, validForMin: 60
    }
  }
];

// NOTAM simulado
window.NOTAM = {
  id: "A1142/25",
  scope: "AERODROME",
  status: "IN EFFECT",
  text: "TWY T CLSD BTN TWY K AND TWY L DUE TO WIP. CAUTION ADZ TAXIING AIRCRAFT.",
  valid: "241200Z TIL 282359Z",
  src: "DGAC AIS"
};
