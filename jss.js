/* ================= CANVAS (circular) ================= */

const canvas = document.getElementById("windingCanvas");
const ctx    = canvas.getContext("2d");

const CX = canvas.width / 2;
const CY = canvas.height / 2;

const R_OUT = 220; // outer radius (slot departure)
const R_IN  = 180; // inner radius (slot return)

/* ========== LINEAR VIEW ZOOM / PAN STATE ========== */

let linScale   = 1;
let linOffsetX = 0;
let linOffsetY = 0;
let linDragging = false;
let linLastX   = 0;
let linLastY   = 0;

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
  const phases        = parseInt(document.getElementById("phases").value, 10);
  const connectionType = document.getElementById("connectionType").value;
  const windingType    = document.getElementById("windingType").value;
  const coilPitchType  = document.getElementById("coilPitchType").value;

  const Z     = +document.getElementById("Z").value;
  const poles = +document.getElementById("poles").value;

  const m = phases;

  // coil pitch / k
  let k = 0;
  if (coilPitchType === "custom") {
    const kSelect = document.getElementById("shortPitchSelect");
    k = +(kSelect.value || 0);
  }

  const p    = poles / 2;
  const q    = Z / (2 * p * m);      // slots per pole per phase
  const tau  = Z / (2 * p);          // slots per pole (full pitch)
  const y    = tau - k;              // coil span in slots
  const alpha = (180 * poles) / Z;   // slot angle in electrical degrees

  const kp = Math.cos((k * alpha * Math.PI) / 360); // pitch factor
  const kd =
    Math.sin((q * alpha * Math.PI) / 360) /
    (q * Math.sin((alpha * Math.PI) / 360));        // distribution factor
  const kw = kp * kd;                               // winding factor

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
  document.getElementById("sum-slots").textContent       = Z;
  document.getElementById("sum-poles").textContent       = poles;
  document.getElementById("sum-phases").textContent      = phases;
  document.getElementById("sum-k").textContent           = k;
  document.getElementById("sum-spp").textContent         = q.toFixed(2);
  document.getElementById("sum-kw").textContent          = kw.toFixed(4);
  document.getElementById("sum-connection").textContent  =
    connectionType === "star" ? "Star (Y)" : "Triangle (Δ)";
  document.getElementById("sum-winding").textContent     =
    windingType === "single" ? "Single-layer" : "Double-layer";
  document.getElementById("sum-coilpitch").textContent   =
    coilPitchType === "full" ? "Full-pitched" : "Customised";
}

/* ================= COILS MODEL ================= */

function buildCoils(Z, poles, y) {
  coils = [];
  const windingType = document.getElementById("windingType").value;

  if (windingType === "single") {
    const halfZ = Z / 2;        // Nc = Z/2 coils
    for (let i = 0; i < halfZ; i++) {
      const start = i + 1;                          // 1..Z/2
      const end   = ((start + halfZ - 1) % Z) + 1;  // start + Z/2
      const phase = phaseOfSlot(start, Z, poles);
      coils.push({ start, end, phase });
    }
  } else {
    // double layer: generic model span y slots
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
  const phases = ["A+", "B-", "C+", "A-", "B+", "C-"];

  const m  = 3;
  const p  = poles / 2;
  const q  = Z / (2 * p * m);  // slots per pole per phase

  // slot index within one pole
  const slotInPole = (slot - 1) % (Z / (2 * p));

  // group index 0..(3m-1) where each group has q slots
  const group = Math.floor(slotInPole / q);   // 0..(3-1) for positive half

  return phases[group];   // A+, B-, C+ for first pole
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
function drawCurvedCoil(x1, y1, x2, y2, color, bold) {
  // mid-point between start and end
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // vector from center to mid-point
  const dx = midX - CX;
  const dy = midY - CY;

  // push control point outward to create arc
  const factor = 0.4; // increase for more curvature
  const cpx = CX + dx * (1 + factor);
  const cpy = CY + dy * (1 + factor);

  ctx.strokeStyle = color;
  ctx.lineWidth = bold ? 4 : 2;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.stroke();
}

/* ================= CIRCULAR DRAWING ================= */

function drawAll(Z) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStator();
  drawSlots(Z);
  drawCoils(Z);
  drawLinear(Z);
}

function drawStator() {
  ctx.beginPath();
  ctx.arc(CX, CY, R_OUT + 15, 0, 2 * Math.PI);
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawSlots(Z) {
  const poles = +document.getElementById("poles").value;
  const showSlotNumbers = document.getElementById("showSlotNumbers")?.checked;
  const windingType = document.getElementById("windingType").value;
  const singleLayer = (windingType === "single");

  for (let s = 1; s <= Z; s++) {
    const a  = angleForSlot(s, Z);
    const xo = CX + R_OUT * Math.cos(a);
    const yo = CY + R_OUT * Math.sin(a);
    const xi = CX + R_IN  * Math.cos(a);
    const yi = CY + R_IN  * Math.sin(a);

    const phase = phaseOfSlot(s, Z, poles);
    ctx.fillStyle = phaseColors[phase];

    if (singleLayer) {
      // ONE dot per slot (outer only) for single-layer
      ctx.beginPath();
      ctx.arc(xo, yo, 6, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      // TWO dots (outer + inner) for double-layer
      ctx.beginPath();
      ctx.arc(xo, yo, 6, 0, 2 * Math.PI);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(xi, yi, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    if (showSlotNumbers) {
      ctx.fillStyle = "#000";
      ctx.font = "10px Arial";
      ctx.fillText(String(s), xo - 6, yo - 10);
    }
  }
}

function drawSlotArcCoil(startSlot, endSlot, Z, color, bold) {
  const startAngle = angleForSlot(startSlot, Z);
  const endAngle   = angleForSlot(endSlot,   Z);

  // choose radius roughly in the middle of the two slot circles
  const R_COIL = (R_OUT + R_IN) / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = bold ? 4 : 2;
  ctx.lineCap = "round";

  ctx.beginPath();
  // draw short arc following stator between the two slots
  ctx.arc(
    CX,
    CY,
    R_COIL,
    startAngle,
    endAngle,
    false   // set true if you want opposite direction
  );
  ctx.stroke();
}

function drawCoils(Z) {
  const windingType        = document.getElementById("windingType").value;
  const singleLayer        = (windingType === "single");

  const showDirectionArrows = document.getElementById("showDirectionArrows")?.checked;
  const showCoilIndices     = document.getElementById("showCoilIndices")?.checked;
  const showPhaseLabels     = document.getElementById("showPhaseLabels")?.checked;

  coils.forEach((c, i) => {
    const color = phaseColors[c.phase] || "#000";
    const bold  = (selectedCoil === i);

    if (singleLayer) {
      // ===== SINGLE-LAYER: short curved chord between start & end on outer radius =====
      const a1 = angleForSlot(c.start, Z);
      const a2 = angleForSlot(c.end,   Z);

      const xStart = CX + R_OUT * Math.cos(a1);
      const yStart = CY + R_OUT * Math.sin(a1);
      const xEnd   = CX + R_OUT * Math.cos(a2);
      const yEnd   = CY + R_OUT * Math.sin(a2);

      // midpoint of the straight chord
      const midX = (xStart + xEnd) / 2;
      const midY = (yStart + yEnd) / 2;

      // push control point slightly outward from the centre to create a gentle curve
      const dx = midX - CX;
      const dy = midY - CY;
      const factor = 0.3;          // 0.3–0.6 gives a visible but not huge curve
      const cpx = CX + dx * (1 + factor);
      const cpy = CY + dy * (1 + factor);

      ctx.strokeStyle = color;
      ctx.lineWidth   = bold ? 4 : 2;
      ctx.lineCap     = "round";

      ctx.beginPath();
      ctx.moveTo(xStart, yStart);
      ctx.quadraticCurveTo(cpx, cpy, xEnd, yEnd);
      ctx.stroke();

      if (showDirectionArrows) {
        // small arrow at end of curve
        const head = 10;
        const ang  = Math.atan2(yEnd - cpy, xEnd - cpx);
        ctx.beginPath();
        ctx.moveTo(xEnd, yEnd);
        ctx.lineTo(
          xEnd - head * Math.cos(ang - Math.PI / 6),
          yEnd - head * Math.sin(ang - Math.PI / 6)
        );
        ctx.lineTo(
          xEnd - head * Math.cos(ang + Math.PI / 6),
          yEnd - head * Math.sin(ang + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }

      if (showCoilIndices || showPhaseLabels) {
        const midLabelX = (xStart + xEnd) / 2;
        const midLabelY = (yStart + yEnd) / 2;
        ctx.fillStyle = "#000";
        ctx.font = "10px Arial";
        let label = "";
        if (showCoilIndices) label += (i + 1);
        if (showPhaseLabels) {
          if (label) label += " ";
          label += c.phase;
        }
        if (label) ctx.fillText(label, midLabelX + 4, midLabelY + 4);
      }

    } else {
      // ===== DOUBLE-LAYER: keep your previous radial arrow =====
      const a1 = angleForSlot(c.start, Z);
      const a2 = angleForSlot(c.end,   Z);

      const xStart = CX + R_OUT * Math.cos(a1);
      const yStart = CY + R_OUT * Math.sin(a1);
      const xInner = CX + R_IN  * Math.cos(a2);
      const yInner = CY + R_IN  * Math.sin(a2);

      if (showDirectionArrows) {
        drawArrow(xStart, yStart, xInner, yInner, color, bold);
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth   = bold ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xInner, yInner);
        ctx.stroke();
      }

      if (showCoilIndices || showPhaseLabels) {
        const midX = (xStart + xInner) / 2;
        const midY = (yStart + yInner) / 2;
        ctx.fillStyle = "#000";
        ctx.font = "10px Arial";
        let label = "";
        if (showCoilIndices) label += (i + 1);
        if (showPhaseLabels) {
          if (label) label += " ";
          label += c.phase;
        }
        if (label) ctx.fillText(label, midX + 4, midY + 4);
      }
    }
  });
}




/* ================= LINEAR DRAWING ================= */

function drawLinear(Z) {
  const lin = document.getElementById("linearCanvas");
  if (!lin) return;
  const lctx = lin.getContext("2d");

  const width  = lin.width;
  const height = lin.height;

  lctx.clearRect(0, 0, width, height);

  lctx.save();
  lctx.translate(linOffsetX, linOffsetY);
  lctx.scale(linScale, linScale);

  const marginX   = 40;
  const topPad    = 40;
  const bottomPad = 40;

  const yAxis  = height - bottomPad;
  const yTopMin = topPad;

  const slotCount   = Z;
  const slotSpacing = (width - 2 * marginX) / (slotCount - 1);
  const startX      = marginX;

  const showSlotNumbers  = document.getElementById("showSlotNumbers")?.checked;
  const showCoilIndices  = document.getElementById("showCoilIndices")?.checked;
  const showPhaseLabels  = document.getElementById("showPhaseLabels")?.checked;
  const showDirectionArrows = document.getElementById("showDirectionArrows")?.checked;

  // dashed axis
  lctx.strokeStyle = "#b4bbcf";
  lctx.setLineDash([6, 4]);
  lctx.beginPath();
  lctx.moveTo(startX, yAxis);
  lctx.lineTo(startX + (slotCount - 1) * slotSpacing, yAxis);
  lctx.stroke();
  lctx.setLineDash([]);

  // slots
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

    if (showSlotNumbers) {
      lctx.fillStyle = "#555";
      lctx.font = "11px Arial";
      lctx.textAlign = "center";
      lctx.fillText(String(s), x, yAxis + 18);
    }
  }

  // phase filter for linear view
  const phaseFilterEl = document.getElementById("linearPhaseFilter");
  const phaseFilter = phaseFilterEl ? phaseFilterEl.value : "ALL";

  const yBottom  = yAxis - 20;
  const phaseGap = 90;

  lctx.lineCap  = "round";
  lctx.lineJoin = "round";

  coils.forEach((c, i) => {
    if (phaseFilter !== "ALL" && c.phase[0] !== phaseFilter) return;

    const color = phaseColors[c.phase] || "#000";

    const x1 = slotXs[c.start];
    const x2 = slotXs[c.end];
    const left  = Math.min(x1, x2);
    const right = Math.max(x1, x2);

    let phaseIndex = 0;
    if (c.phase[0] === "B") phaseIndex = 1;
    if (c.phase[0] === "C") phaseIndex = 2;

    let yTop = yBottom - (phaseIndex + 1) * phaseGap;
    if (yTop < yTopMin + 10) yTop = yTopMin + 10;

    lctx.strokeStyle = color;
    lctx.lineWidth = (selectedCoil === i) ? 3 : 2;

    const sideOffset = 8;
    const xLeftLeg  = left  + sideOffset;
    const xRightLeg = right - sideOffset;
    const yKnee     = yAxis + 6;

    lctx.beginPath();
    lctx.moveTo(x1, yAxis);
    lctx.lineTo(x1, yKnee);
    lctx.lineTo(xLeftLeg, yBottom);
    lctx.lineTo(xLeftLeg, yTop);
    lctx.lineTo(xRightLeg, yTop);
    lctx.lineTo(xRightLeg, yBottom);
    lctx.lineTo(x2, yKnee);
    lctx.lineTo(x2, yAxis);
    lctx.stroke();

    // markers
    lctx.fillStyle = "#fff";
    lctx.strokeStyle = color;
    lctx.lineWidth = 1.5;
    lctx.beginPath();
    lctx.arc(x1, yAxis, 4, 0, 2 * Math.PI);
    lctx.fill();
    lctx.stroke();

    lctx.fillStyle = color;
    lctx.beginPath();
    lctx.arc(x2, yAxis, 4, 0, 2 * Math.PI);
    lctx.fill();

    if (showDirectionArrows) {
      const arrowX1 = xLeftLeg + (xRightLeg - xLeftLeg) * 0.2;
      const arrowX2 = xLeftLeg + (xRightLeg - xLeftLeg) * 0.8;
      const dir = (x2 >= x1) ? 1 : -1;

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
    }

    if (showCoilIndices || showPhaseLabels) {
      const midX = (xLeftLeg + xRightLeg) / 2;
      const midY = yTop - 6;
      lctx.fillStyle = "#000";
      lctx.font = "10px Arial";
      lctx.textAlign = "center";
      let label = "";
      if (showCoilIndices) label += (i + 1);
      if (showPhaseLabels) {
        if (label) label += " ";
        label += c.phase;
      }
      if (label) lctx.fillText(label, midX, midY);
    }
  });

  lctx.restore();
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
  const btnCirc    = document.getElementById("btnCircular");
  const btnLin     = document.getElementById("btnLinear");
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
  const shortGroup  = document.getElementById("shortPitchGroup");
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

/* ================= LINEAR ZOOM + PAN ================= */

function setupLinearZoomPan() {
  const lin = document.getElementById("linearCanvas");
  if (!lin) return;

  // zoom with wheel
  lin.addEventListener("wheel", e => {
    e.preventDefault();

    const rect = lin.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = 1.1;
    const oldScale = linScale;

    if (e.deltaY < 0) {
      linScale *= scaleFactor;
    } else {
      linScale /= scaleFactor;
    }
    if (linScale < 0.2) linScale = 0.2;
    if (linScale > 5)   linScale = 5;

    const zoom = linScale / oldScale;
    linOffsetX = mouseX - (mouseX - linOffsetX) * zoom;
    linOffsetY = mouseY - (mouseY - linOffsetY) * zoom;

    const Z = +document.getElementById("Z").value;
    drawAll(Z);
  }, { passive: false });

  // pan with mouse drag
  lin.addEventListener("mousedown", e => {
    linDragging = true;
    linLastX = e.clientX;
    linLastY = e.clientY;
  });

  window.addEventListener("mousemove", e => {
    if (!linDragging) return;
    linOffsetX += e.clientX - linLastX;
    linOffsetY += e.clientY - linLastY;
    linLastX = e.clientX;
    linLastY = e.clientY;

    const Z = +document.getElementById("Z").value;
    drawAll(Z);
  });

  window.addEventListener("mouseup", () => {
    linDragging = false;
  });
}

/* ================= INIT ================= */

window.addEventListener("load", () => {
  setupViewToggle();
  setupCoilPitchToggle();
  setupLinearZoomPan();
  // user clicks calculate() to draw
});
