// ============================================================
// ClearTO — Datos simulados (maqueta). Sin backend "pesado".
// En la plataforma de dos tablets, el SERVIDOR (server.js) mantiene
// el estado autoritativo por indicativo; esto es solo la SEMILLA
// inicial y el fallback offline (GitHub Pages) por localStorage.
// ============================================================

// Estado del aeródromo SCEL (Arturo Merino Benítez / Pudahuel).
// Datos generales tomados del eAIP Chile (AD 2 SCEL AMDT 67 · cartas AMDT 103).
// Los valores meteorológicos son simulados (maqueta); los aeronáuticos son reales.
window.SCEL = {
  icao: "SCEL",
  iata: "SCL",
  name: "PUDAHUEL",
  fullName: "ARTURO MERINO BENÍTEZ",
  fir: "SCEZ",
  arp: "3324S 07048W",
  condition: "VMC",
  landingRwy: "17L",
  landingProc: "ILS Y",
  depRwy: "17R",
  depProc: "RNAV (SID)",
  transitionLevel: "POR ATC",
  transitionAlt: "10,000 FT",
  elevation: "1,555 FT",
  magVar: "1.1°E",
  refTemp: "30°C",
  arff: "CAT 9",
  // Meteorología: simulada (en producción vendría del METAR/ATIS real).
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
  // Frecuencias ATS reales (AD 2.18): CLR/DLVRY 136.70 · GND E 122.20 · TWR 118.10.
  freqs: { delivery: "136.70", ground: "122.20", tower: "118.10", app: "119.70", atisDep: "132.70", atisArr: "132.10" }
};

// D-ATIS (salida y llegada)
// Los tiempos ya NO son fijos: se derivan del reloj Z vivo con estos offsets
// (issuedAgoMin = emitida hace N min; validForMin = vigencia en min). El
// telegrama crudo se arma en app.js con esos tiempos para que sea consistente.
window.ATIS = {
  dep: {
    service: "DEP",
    letter: "R", word: "ROMEO",
    issuedAgoMin: 6, validForMin: 60,
    wind: "190/11", windVrb: "160°-220°",
    qnh: "1015", qnhInHg: "29.97",
    // No es CAVOK: hay nubosidad por debajo de 1500 m (FEW 4000). Visibilidad ≥10 km.
    vis: "10 KM+", visNote: "10 KM O MÁS", clouds: "FEW 4000 · BKN 10000",
    temp: "19", dew: "08", spread: "11", rh: "52",
    depRwy: "17R", arrRwy: "17L"
  },
  // LLEGADA (INFO QUEBEC): servicio independiente con su propia meteorología y
  // aproximación esperada. Emitida un poco antes que la de salida (INFO ROMEO),
  // por eso el delta de ROMEO se calcula contra QUEBEC (QNH 1016→1015, viento
  // 200→190 = viró 10° a la izquierda).
  arr: {
    service: "ARR",
    letter: "Q", word: "QUEBEC",
    issuedAgoMin: 9, validForMin: 60,
    landingProc: "ILS Y",
    wind: "200/12", windVrb: "170°-230°",
    qnh: "1016", qnhInHg: "30.00",
    vis: "10 KM+", visNote: "10 KM O MÁS", clouds: "FEW 4000 · BKN 10000",
    temp: "18", dew: "08", spread: "10", rh: "55",
    depRwy: "17R", arrRwy: "17L"
  }
};

// Enlaces de datos / estado de conexión — se muestran como indicadores pequeños.
window.LINKS = [
  { id: "net",   name: "ENLACE LAN",     dot: "emerald" },
  { id: "datis", name: "D-ATIS",         dot: "sky" },
  { id: "pdc",   name: "D-CLEARANCE",    dot: "emerald" }
];

// ============================================================
// VUELOS / FRANJAS DE SALIDA SCEL — datos tomados de la franja
// electrónica real (imagen de referencia de Felipe). Cada vuelo es
// una franja de progreso. La AUTORIZACIÓN se muestra en orden CRAFT:
//   limit (límite) · route (ruta) · level (nivel) · rwy (pista) ·
//   sid · freq (frecuencia) · ssr.
//
// stripState (ciclo de autorización, sincronizado por el servidor):
//   'pending'      -> controlador aún completa/no ha soltado la ANC
//   'ready'        -> controlador marcó "lista para entregar" (check)
//   'assigned'     -> el piloto tomó/vinculó el vuelo en su tablet
//   'delivered'    -> el piloto abrió la autorización (aún sin colacionar)
//   'acknowledged' -> readback digital (WILCO) recibido; ciclo cerrado
//
// Notas (confirmadas con Felipe):
//   - SSR: solo LAE2541=5370 venía en la franja; el resto son simulados pero
//     ACEPTADOS como válidos para la maqueta.
//   - level "RCLE" = "request level change en route" → al piloto se le muestra
//     traducido: "espere nivel superior en ruta" (ver app.js levelNoteText).
//   - atfm: estado de GESTIÓN ATFM del vuelo, solo estético en la maqueta.
//     "regulado" (con CTOT) → banda ámbar + nivel en cian;
//     "liberado" → banda verde; "" → sin banda. Independiente del stripState.
// ============================================================
window.FLIGHTS = [
  {
    callsign: "LXP376", type: "A20N", wtc: "M",
    adep: "SCEL", ades: "SCCF", adesCity: "BALMACEDA",
    eobt: "1845", stand: "B22", rfl: "F360",
    atfm: "regulado", ctot: "1902",
    stripState: "pending",
    clearance: {
      limit: "SCCF", limitName: "BALMACEDA",
      route: "PABOS UQ814",
      level: "FL280", levelNote: "RCLE",
      rwy: "17R",
      sid: "DILOK1R",
      freq: "119.7",
      ssr: "5371", ssrSim: true,
      issuedAgoMin: 0, validForMin: 90
    }
  },
  {
    callsign: "JAT044", type: "A20N", wtc: "M",
    adep: "SCEL", ades: "SCCF", adesCity: "BALMACEDA",
    eobt: "1835", stand: "A12A", rfl: "F360",
    atfm: "",
    stripState: "pending",
    clearance: {
      limit: "SCCF", limitName: "BALMACEDA",
      route: "PABOS UQ814",
      level: "FL280", levelNote: "",
      rwy: "17R",
      sid: "DILOK1R",
      freq: "119.7",
      ssr: "5372", ssrSim: true,
      issuedAgoMin: 0, validForMin: 90
    }
  },
  {
    callsign: "LAN740", type: "A321", wtc: "M",
    adep: "SCEL", ades: "SBPA", adesCity: "PORTO ALEGRE",
    eobt: "1815", stand: "D2", rfl: "F270",
    atfm: "liberado",
    stripState: "pending",
    clearance: {
      limit: "SBPA", limitName: "PORTO ALEGRE",
      route: "ALBAL __/",
      level: "FL270", levelNote: "",
      rwy: "17R",
      sid: "ALBAL7C",
      freq: "119.7",
      ssr: "5373", ssrSim: true,
      issuedAgoMin: 0, validForMin: 90
    }
  },
  {
    callsign: "LAN102", type: "A321", wtc: "M",
    adep: "SCEL", ades: "SCSE", adesCity: "LA SERENA",
    eobt: "1810", stand: "B28", rfl: "F260",
    atfm: "regulado", ctot: "1828",
    stripState: "pending",
    clearance: {
      limit: "SCSE", limitName: "LA SERENA",
      route: "ANDAK UQ802",
      level: "FL260", levelNote: "",
      rwy: "17R",
      sid: "DONTI1R",
      freq: "119.7",
      ssr: "5374", ssrSim: true,
      issuedAgoMin: 0, validForMin: 90
    }
  },
  {
    callsign: "LAE2541", type: "B763", wtc: "H",
    adep: "SCEL", ades: "KMIA", adesCity: "MIAMI",
    eobt: "1800", stand: "R41", rfl: "F320",
    atfm: "",
    stripState: "pending",
    clearance: {
      limit: "KMIA", limitName: "MIAMI",
      route: "DONTI __/",
      level: "FL280", levelNote: "RCLE",
      rwy: "17R",
      sid: "DONTI5B",
      freq: "119.7",
      ssr: "5370", ssrSim: false,
      issuedAgoMin: 0, validForMin: 90
    }
  },
  {
    callsign: "LAP1325", type: "A320", wtc: "M",
    adep: "SCEL", ades: "SGAS", adesCity: "ASUNCIÓN",
    eobt: "1830", stand: "F3A", rfl: "F370",
    atfm: "liberado",
    stripState: "pending",
    clearance: {
      limit: "SGAS", limitName: "ASUNCIÓN",
      route: "ALBAL __/",
      level: "FL270", levelNote: "RCLE",
      rwy: "17R",
      sid: "ALBAL7C",
      freq: "119.7",
      ssr: "5375", ssrSim: true,
      issuedAgoMin: 0, validForMin: 90
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
