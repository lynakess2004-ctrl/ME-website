/* ================= CANVAS (circular) ================= */

const canvas = document.getElementById("windingCanvas");
const ctx = canvas.getContext("2d");

const CX = canvas.width / 2;
const CY = canvas.height / 2;

const R_OUT = 220; // outer radius (slot departure)
const R_IN  = 180; // inner radius (slot return)

/* ================= PHASE COLORS ================= */

const phaseColors = {
  "A+": "#e53935",
  "A-": "#b71c1c",
  "B+": "#1e88e5",
  "B-": "#0d47a1",
  "C+": "#43a047",
  "C-": "#1b5e20"
};

/* ================= DATA ================= */

let coils = [];
let selectedCoil = null;

/* ================= MAIN CALCULATION ================= */

function calculate() {
  const phases = parseInt(document.getElementById("phases").value, 10);
  const connectionType = document.getElementById("connectionType").value;
  const windingType = document.getElementById("windingType").value;
  const coilPitchType = document.getElementById("coilPitchType").value;

  const Z = +document.getElementById("Z").value;
  const poles = +document.getElementById("poles").value;

  const m = phases;

  // coil pitch / k
  let k = 0;
  if (coilPitchType === "custom") {
    const kSelect = document.getElementById("shortPitchSelect");
    k = +(kSelect.value || 0);
  }

  const p = poles / 2;
  const q = Z / (2 * p * m);             // slots per pole per phase [web:111]
  const tau = Z / (2 * p);               // slots per pole = full pitch in slots [web:111]
  const y = tau - k;                     // coil span in slots
  const alpha = (180 * poles) / Z;       // slot angle in electrical degrees [web:111]

  const kp = Math.cos((k * alpha * Math.PI) / 360);                       // pitch factor
  const kd =
    Math.sin((q * alpha * Math.PI) / 360) /
    (q * Math.sin((alpha * Math.PI) / 360));                               // distribution factor [web:111]
  const kw = kp * kd;                                                      // winding factor

  // numeric results block
  document.getElementById("results").innerHTML = `
    <p>q = ${q.toFixed(2)}</p>
    <p>&tau; = ${tau.toFixed(2)}</p>
    <p>y = ${y}</p>
    <p>k<sub>p</sub> = ${kp.toFixed(4)}</p>
    <p>k<sub>d</sub> = ${kd.toFixed(4)}</p>
    <p><b>k<sub>w</sub> = ${kw.toFixed(4)}</b></p>
  `;

  // build model (single or double layer)
  buildCoils(Z, poles, y);

  // draw both views
  drawAll(Z);

  // fill coil table
  buildTable();

  // summary card
  document.getElementById("sum-slots").textContent = Z;
  document.getElementById("sum-poles").textContent = poles;
  document.getElementById("sum-phases").textContent = phases;
  document.getElementById("sum-k").textContent = k;
  document.getElementById("sum-spp").textContent = q.toFixed(2);
  document.getElementById("sum-kw").textContent = kw.toFixed(4);
  document.getElementById("sum-connection").textContent =
    connectionType === "star" ? "Star (Y)" : "Triangle (Δ)";
  document.getElementById("sum-winding").textContent =
    windingType === "single" ? "Single-layer" : "Double-layer";
  document.getElementById("sum-coilpitch").textContent =
    coilPitchType === "full" ? "Full-pitched" : "Customised";
}

/* ============ COILS MODEL (single-layer correct, double-layer as before) ============ */

/* ============ COILS MODEL (single-layer 24/4/3 + generic double-layer) ============ */

function buildCoils(Z, poles, y) {
  coils = [];
  const windingType = document.getElementById("windingType").value;

  if (windingType === "single") {
    const halfZ = Z / 2;        // Nc = S/2 coils

    for (let i = 0; i < halfZ; i++) {
      const start = i + 1;                          // 1..Z/2
      const end   = ((start + halfZ - 1) % Z) + 1;  // start + S/2

      const phase = phaseOfSlot(start, Z, poles);   // from θ_s

      coils.push({ start, end, phase });
    }
  } else {
    // existing double-layer branch
    for (let s = 1; s <= Z; s++) {
      const phase = phaseOfSlot(s, Z, poles);
      const end   = ((s + y - 1) % Z) + 1;
      coils.push({ start: s, end, phase });
    }
  }
}


/* ================= GEOMETRY HELPERS ================= */

function angleForSlot(slot, Z) {
  return (2 * Math.PI / Z) * (slot - 1) - Math.PI / 2;
}

/* ================= PHASE ASSIGNMENT ================= */

function phaseOfSlot(slot, Z, poles) {
  const alpha = (180 * poles) / Z;           // electrical slot angle [web:111]
  const a = ((slot - 1) * alpha) % 360;

  if (a < 60) return "A+";
  if (a < 120) return "B-";
  if (a < 180) return "C+";
  if (a < 240) return "A-";
  if (a < 300) return "B+";
  return "C-";
}

/* ================= ARROW DRAWING ================= */

function drawArrow(x1, y1, x2, y2, color, bold) {
  const head = 14;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const ang = Math.atan2(dy, dx);

  ctx.strokeStyle = color;
  ctx.lineWidth = bold ? 4 : 2;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - head * Math.cos(ang - Math.PI / 6),
    y2 - head * Math.sin(ang - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - head * Math.cos(ang + Math.PI / 6),
    y2 - head * Math.sin(ang + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

/* ================= CIRCULAR DRAWING ================= */

function drawAll(Z) {
  // circular
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStator();
  drawSlots(Z);
  drawCoils(Z);

  // linear
  drawLinear(Z);
}

function drawStator() {
  ctx.beginPath();
  ctx.arc(CX, CY, R_OUT + 15, 0, 2 * Math.PI);
  ctx.lineWidth = 2;
  ctx.stroke();
}

// draw all slots (independent of coils) so the ring is complete in both modes
function drawSlots(Z) {
  const poles = +document.getElementById("poles").value;

  for (let s = 1; s <= Z; s++) {
    const a = angleForSlot(s, Z);
    const xo = CX + R_OUT * Math.cos(a);
    const yo = CY + R_OUT * Math.sin(a);
    const xi = CX + R_IN  * Math.cos(a);
    const yi = CY + R_IN  * Math.sin(a);

    const phase = phaseOfSlot(s, Z, poles);

    ctx.fillStyle = phaseColors[phase];

    ctx.beginPath();
    ctx.arc(xo, yo, 6, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(xi, yi, 5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.font = "10px Arial";
    ctx.fillText(s, xo - 6, yo - 10);
  }
}

function drawCoils(Z) {
  coils.forEach((c, i) => {
    const a1 = angleForSlot(c.start, Z);
    const a2 = angleForSlot(c.end,   Z);

    const x1 = CX + R_OUT * Math.cos(a1);
    const y1 = CY + R_OUT * Math.sin(a1);
    const x2 = CX + R_IN  * Math.cos(a2);
    const y2 = CY + R_IN  * Math.sin(a2);

    drawArrow(
      x1, y1, x2, y2,
      phaseColors[c.phase],
      selectedCoil === i
    );
  });
}

/* ================= LINEAR DRAWING ================= */

function drawLinear(Z) {
  const lin = document.getElementById("linearCanvas");
  if (!lin) return;
  const lctx = lin.getContext("2d");
  lctx.clearRect(0, 0, lin.width, lin.height);

  const width  = lin.width;
  const height = lin.height;

  const marginX = 40;
  const topPad  = 40;
  const bottomPad = 40;

  const yAxis  = height - bottomPad;    // slots at bottom line
  const yTopMin = topPad;               // highest coil row

  const slotCount   = Z;
  const slotSpacing = (width - 2 * marginX) / (slotCount - 1);
  const startX      = marginX;

  // dashed axis
  lctx.strokeStyle = "#b4bbcf";
  lctx.setLineDash([6, 4]);
  lctx.beginPath();
  lctx.moveTo(startX, yAxis);
  lctx.lineTo(startX + (slotCount - 1) * slotSpacing, yAxis);
  lctx.stroke();
  lctx.setLineDash([]);

  // slots: circles + numbers
  const slotXs = [];
  for (let s = 1; s <= slotCount; s++) {
    const x = startX + (s - 1) * slotSpacing;
    slotXs[s] = x;

    lctx.fillStyle = "#ffffff";
    lctx.strokeStyle = "#7f8aa5";
    lctx.lineWidth = 1;
    lctx.beginPath();
    lctx.arc(x, yAxis, 6, 0, 2 * Math.PI);
    lctx.fill();
    lctx.stroke();

    lctx.fillStyle = "#555";
    lctx.font = "11px Arial";
    lctx.textAlign = "center";
    lctx.fillText(s, x, yAxis + 18);
  }

  // coils stacked upward
  const yBottom = yAxis - 8;
  const maxRows = 12;
  const availableHeight = yBottom - yTopMin;
  const rowHeight = availableHeight / maxRows;

  coils.forEach((c, i) => {
    const color = phaseColors[c.phase] || "#000";

    const x1 = slotXs[c.start];
    const x2 = slotXs[c.end];
    const left  = Math.min(x1, x2);
    const right = Math.max(x1, x2);

    const rowIndex = Math.min(i, maxRows - 1);
    const yTop = yBottom - (rowIndex + 1) * rowHeight;

    lctx.strokeStyle = color;
    lctx.lineWidth = (selectedCoil === i) ? 3 : 2;

    // U-shape
    lctx.beginPath();
    lctx.moveTo(left, yBottom);
    lctx.lineTo(left, yTop);
    lctx.lineTo(right, yTop);
    lctx.lineTo(right, yBottom);
    lctx.stroke();

    // start: open circle
    lctx.fillStyle = "#fff";
    lctx.strokeStyle = color;
    lctx.lineWidth = 1.5;
    lctx.beginPath();
    lctx.arc(x1, yAxis, 4, 0, 2 * Math.PI);
    lctx.fill();
    lctx.stroke();

    // end: filled circle
    lctx.fillStyle = color;
    lctx.beginPath();
    lctx.arc(x2, yAxis, 4, 0, 2 * Math.PI);
    lctx.fill();

    // direction arrow
    const arrowX1 = left + (right - left) * 0.25;
    const arrowX2 = left + (right - left) * 0.75;
    const dir     = (x2 >= x1) ? 1 : -1;

    lctx.strokeStyle = color;
    lctx.lineWidth = 2;
    lctx.beginPath();
    lctx.moveTo(arrowX1, yTop);
    lctx.lineTo(arrowX2, yTop);
    lctx.stroke();

    const head = 6;
    lctx.beginPath();
    lctx.moveTo(arrowX2, yTop);
    lctx.lineTo(arrowX2 - dir * head, yTop - 3);
    lctx.lineTo(arrowX2 - dir * head, yTop + 3);
    lctx.closePath();
    lctx.fill();
  });
}

/* ================= TABLE ================= */

function buildTable() {
  const table = document.getElementById("windingTable");
  table.innerHTML = `
    <tr>
      <th>Bobine</th>
      <th>Phase</th>
      <th>Départ</th>
      <th>Retour</th>
      <th>Sens courant</th>
    </tr>
  `;

  coils.forEach((c, i) => {
    const row = table.insertRow();
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${c.phase}</td>
      <td>${c.start}</td>
      <td>${c.end}</td>
      <td>${c.start} → ${c.end}</td>
    `;

    row.onclick = () => {
      selectedCoil = i;
      const Z = +document.getElementById("Z").value;
      drawAll(Z);
    };
  });
}

/* ================= CIRCULAR CANVAS CLICK ================= */

canvas.addEventListener("click", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const Z = +document.getElementById("Z").value;

  coils.forEach((c, i) => {
    const a = angleForSlot(c.start, Z);
    const x = CX + R_OUT * Math.cos(a);
    const y = CY + R_OUT * Math.sin(a);

    if (Math.hypot(mx - x, my - y) < 8) {
      selectedCoil = i;
      drawAll(Z);
    }
  });
});

/* ================= VIEW TOGGLE ================= */

function setupViewToggle() {
  const btnCirc = document.getElementById("btnCircular");
  const btnLin  = document.getElementById("btnLinear");
  const circCanvas = document.getElementById("windingCanvas");
  const linCanvas  = document.getElementById("linearCanvas");

  if (!btnCirc || !btnLin || !circCanvas || !linCanvas) return;

  btnCirc.addEventListener("click", () => {
    circCanvas.style.display = "";
    linCanvas.style.display  = "none";
    btnCirc.classList.add("chip-active");
    btnLin.classList.remove("chip-active");
  });

  btnLin.addEventListener("click", () => {
    circCanvas.style.display = "none";
    linCanvas.style.display  = "";
    btnLin.classList.add("chip-active");
    btnCirc.classList.remove("chip-active");
  });
}

/* ================= COIL PITCH UI TOGGLE ================= */

function setupCoilPitchToggle() {
  const pitchSelect = document.getElementById("coilPitchType");
  const shortGroup = document.getElementById("shortPitchGroup");
  if (!pitchSelect || !shortGroup) return;

  const offsetSelect = shortGroup.querySelector("select");

  function updateState() {
    const isCustom = pitchSelect.value === "custom";
    shortGroup.classList.toggle("disabled", !isCustom);
    if (offsetSelect) {
      offsetSelect.disabled = !isCustom;
      if (!isCustom) offsetSelect.value = "";
    }
  }

  pitchSelect.addEventListener("change", updateState);
  updateState();
}

/* ================= INIT ================= */

window.addEventListener("load", () => {
  setupViewToggle();
  setupCoilPitchToggle();
  // no calculate() here: user clicks the button to draw
});
