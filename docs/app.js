/**
 * Smart HEMS Console Simulation Engine & Visualizer
 * Grounded in physics-based solar irradiance, BESS constraints, and priority dispatch.
 */

// Domain Constants & Data
const HOURLY_IRRADIANCE = [
  0.0, 0.0, 0.0, 0.0, 0.0, 20.39, 461.84, 689.81, 844.62, 915.64,
  898.18, 793.38, 608.26, 355.69, 10.56, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0
];

const TARIFF_RATES = {
  peak: 0.50,     // 17:00 – 22:00
  mid: 0.30,      // 06:00 – 17:00
  off_peak: 0.10  // 22:00 – 06:00
};

const DEFAULT_APPLIANCES = [
  { name: "Refrigerator", power: 200, priority: 1, category: "critical", slots: Array.from({length: 24}, (_, i) => i) },
  { name: "Heater", power: 1700, priority: 1, category: "critical", slots: [17, 18, 19, 20, 21] },
  { name: "Lighting", power: 100, priority: 1, category: "critical", slots: [15, 16, 17, 18, 19, 20, 21] },
  { name: "Kettle", power: 500, priority: 2, category: "flexible", slots: [18] },
  { name: "Air Fryer", power: 950, priority: 2, category: "flexible", slots: [19] },
  { name: "Microwave", power: 500, priority: 2, category: "flexible", slots: [16] },
  { name: "Induction Cooker", power: 1500, priority: 2, category: "flexible", slots: [17, 18] },
  { name: "Air Conditioner", power: 1500, priority: 3, category: "flexible", slots: [] },
  { name: "Blender", power: 250, priority: 3, category: "flexible", slots: [13] },
  { name: "Coffee Machine", power: 1000, priority: 3, category: "flexible", slots: [14] },
  { name: "Toaster", power: 800, priority: 3, category: "flexible", slots: [15] },
  { name: "Iron", power: 750, priority: 3, category: "deferrable", slots: [21] },
  { name: "Dishwasher", power: 840, priority: 4, category: "deferrable", slots: [20] },
  { name: "Washing Machine", power: 700, priority: 4, category: "deferrable", slots: [21, 22] },
  { name: "Television", power: 100, priority: 5, category: "deferrable", slots: [18, 19, 20, 21] }
];

// State & DOM Elements
let currentSimulation = null;
let hoveredHour = null;

const elThreshold = document.getElementById("inputThreshold");
const elSolar = document.getElementById("inputSolar");
const elBattery = document.getElementById("inputBattery");

const outThreshold = document.getElementById("valThreshold");
const outSolar = document.getElementById("valSolar");
const outBattery = document.getElementById("valBattery");

const elReset = document.getElementById("btnResetDefaults");
const canvas = document.getElementById("dispatchCanvas");
const ctx = canvas.getContext("2d");

const toggleBase = document.getElementById("toggleBase");
const toggleShifted = document.getElementById("toggleShifted");
const toggleSolar = document.getElementById("toggleSolar");
const toggleBattery = document.getElementById("toggleBattery");
const toggleThreshold = document.getElementById("toggleThreshold");

// Main Simulation Pipeline
function runSimulation() {
  const threshold = parseFloat(elThreshold.value);
  const solarRating = parseFloat(elSolar.value);
  const batteryCap = parseFloat(elBattery.value);

  outThreshold.textContent = `${threshold} W`;
  outSolar.textContent = `${solarRating} W`;
  outBattery.textContent = `${batteryCap} Wh`;

  const hours = Array.from({length: 24}, (_, i) => i);
  const peakHours = [17, 18, 19, 20, 21];
  const offPeakHours = [22, 23, 0, 1, 2, 3, 4, 5];

  // 1. Calculate Base Profile
  const baseProfile = new Array(24).fill(0);
  DEFAULT_APPLIANCES.forEach(app => {
    app.slots.forEach(h => {
      if (h >= 0 && h < 24) baseProfile[h] += app.power;
    });
  });

  // 2. Solar PV Output
  const solarOutput = HOURLY_IRRADIANCE.map(irr => (irr / 1000.0) * solarRating);

  // 3. Battery Management
  const batteryProfile = new Array(24).fill(0);
  let batterySoC = 0.1 * batteryCap;
  const maxCharge = 0.8 * batteryCap;
  const minDischarge = 0.3 * batteryCap;
  const chargeRate = 0.2 * batteryCap;
  const dischargeRate = 0.3 * batteryCap;
  let totalSolarStored = 0;

  const shiftedProfile = [...baseProfile];

  for (let h = 0; h < 24; h++) {
    const isPeak = peakHours.includes(h);
    // Daytime Solar Charging
    if (!isPeak && batterySoC < maxCharge) {
      const availableSolar = solarOutput[h];
      const chg = Math.min(chargeRate, maxCharge - batterySoC, availableSolar);
      if (chg > 0) {
        batteryProfile[h] += chg;
        batterySoC += chg;
        totalSolarStored += chg;
      }
    }
    // Peak Shaving Discharge
    else if (isPeak && batterySoC > minDischarge) {
      const excessLoad = Math.max(0, shiftedProfile[h] - threshold);
      if (excessLoad > 0) {
        const dischg = Math.min(dischargeRate, batterySoC - minDischarge, excessLoad);
        batteryProfile[h] -= dischg;
        shiftedProfile[h] -= dischg;
        batterySoC -= dischg;
      }
    }
  }

  // 4. Priority-Based Load Shifting
  // Deep clone appliances to track dispatched slots
  const dispatchedAppliances = DEFAULT_APPLIANCES.map(a => ({
    ...a,
    currentSlots: [...a.slots],
    shiftedLogs: []
  }));

  // Sort lowest priority first (5 down to 2)
  dispatchedAppliances.sort((a, b) => b.priority - a.priority);

  peakHours.forEach(h => {
    while (shiftedProfile[h] > threshold) {
      let shiftedAny = false;
      for (let app of dispatchedAppliances) {
        if (app.priority > 1 && app.currentSlots.includes(h)) {
          // Find first viable off-peak hour
          for (let offH of offPeakHours) {
            if (shiftedProfile[offH] + app.power <= threshold) {
              // Shift
              shiftedProfile[h] -= app.power;
              shiftedProfile[offH] += app.power;
              app.currentSlots = app.currentSlots.filter(s => s !== h);
              app.currentSlots.push(offH);
              app.shiftedLogs.push({ from: h, to: offH });
              shiftedAny = true;
              break;
            }
          }
          if (shiftedAny) break;
        }
      }
      if (!shiftedAny) break; // Cannot shift further
    }
  });

  // 5. Cost Computation
  let baseCost = 0;
  let shiftedCost = 0;
  for (let h = 0; h < 24; h++) {
    let rate = TARIFF_RATES.off_peak;
    if (peakHours.includes(h)) rate = TARIFF_RATES.peak;
    else if (h >= 6 && h < 17) rate = TARIFF_RATES.mid;

    baseCost += (baseProfile[h] / 1000.0) * rate;
    shiftedCost += (shiftedProfile[h] / 1000.0) * rate;
  }

  const savings = Math.max(0, baseCost - shiftedCost);
  const savingsPct = baseCost > 0 ? (savings / baseCost) * 100 : 0;
  const maxBase = Math.max(...baseProfile);
  const maxShifted = Math.max(...shiftedProfile);
  const peakShaved = Math.max(0, maxBase - maxShifted);

  currentSimulation = {
    threshold,
    solarRating,
    batteryCap,
    hours,
    baseProfile,
    shiftedProfile,
    batteryProfile,
    solarOutput,
    baseCost,
    shiftedCost,
    savings,
    savingsPct,
    peakShaved,
    totalSolarStored,
    dispatchedAppliances
  };

  updateTelemetry();
  renderCanvas();
  renderApplianceTable();
}

// Telemetry & UI updates
function updateTelemetry() {
  const s = currentSimulation;
  document.getElementById("metricBaseCost").textContent = `$${s.baseCost.toFixed(2)}`;
  document.getElementById("metricShiftedCost").textContent = `$${s.shiftedCost.toFixed(2)}`;
  document.getElementById("metricSavings").textContent = `$${s.savings.toFixed(2)}`;
  document.getElementById("metricSavingsPct").textContent = `${s.savingsPct.toFixed(1)}% savings`;
  document.getElementById("metricPeakShaved").textContent = `${s.peakShaved.toFixed(0)} W`;
  document.getElementById("metricSolarStored").textContent = `${s.totalSolarStored.toFixed(0)} Wh`;
}

// Canvas Rendering
function renderCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const padLeft = 55;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  ctx.clearRect(0, 0, W, H);

  // Background Tariff Zones
  const hourToX = h => padLeft + (h / 24) * chartW;
  const maxPower = 5200; // Top Y axis
  const powerToY = p => padTop + chartH - (p / maxPower) * chartH;

  // Draw Tariff Shading
  // Off-peak 0-6
  ctx.fillStyle = "rgba(56, 189, 248, 0.03)";
  ctx.fillRect(hourToX(0), padTop, hourToX(6) - hourToX(0), chartH);

  // Mid-day 6-17
  ctx.fillStyle = "rgba(245, 158, 11, 0.04)";
  ctx.fillRect(hourToX(6), padTop, hourToX(17) - hourToX(6), chartH);

  // Peak 17-22
  ctx.fillStyle = "rgba(244, 63, 94, 0.08)";
  ctx.fillRect(hourToX(17), padTop, hourToX(22) - hourToX(17), chartH);

  // Off-peak 22-24
  ctx.fillStyle = "rgba(56, 189, 248, 0.03)";
  ctx.fillRect(hourToX(22), padTop, hourToX(24) - hourToX(22), chartH);

  // Peak Window Label
  ctx.fillStyle = "rgba(251, 113, 133, 0.7)";
  ctx.font = "600 10px 'JetBrains Mono', monospace";
  ctx.fillText("PEAK TARIFF (17:00 – 22:00)", hourToX(17) + 6, padTop + 16);

  // Horizontal Grid Lines
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(34, 51, 84, 0.6)";
  ctx.fillStyle = "#64748b";
  ctx.font = "10px 'JetBrains Mono', monospace";

  for (let p = 1000; p <= 5000; p += 1000) {
    const y = powerToY(p);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(W - padRight, y);
    ctx.stroke();
    ctx.fillText(`${p}W`, 12, y + 3);
  }

  // Threshold Line
  if (toggleThreshold.checked) {
    const yThresh = powerToY(currentSimulation.threshold);
    ctx.save();
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, yThresh);
    ctx.lineTo(W - padRight, yThresh);
    ctx.stroke();
    ctx.fillStyle = "#f43f5e";
    ctx.fillText(`CAP ${currentSimulation.threshold}W`, W - padRight - 80, yThresh - 6);
    ctx.restore();
  }

  // Draw Curve Helper
  const drawCurve = (data, strokeColor, lineWidth, isDashed = false) => {
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    if (isDashed) ctx.setLineDash([5, 4]);
    ctx.beginPath();

    for (let h = 0; h < 24; h++) {
      const x = hourToX(h + 0.5);
      const y = powerToY(data[h]);
      if (h === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  // Solar Output (Area + Curve)
  if (toggleSolar.checked) {
    ctx.save();
    ctx.fillStyle = "rgba(245, 158, 11, 0.12)";
    ctx.beginPath();
    ctx.moveTo(hourToX(0.5), powerToY(0));
    for (let h = 0; h < 24; h++) {
      ctx.lineTo(hourToX(h + 0.5), powerToY(currentSimulation.solarOutput[h]));
    }
    ctx.lineTo(hourToX(23.5), powerToY(0));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawCurve(currentSimulation.solarOutput, "#f59e0b", 2);
  }

  // Battery Profile
  if (toggleBattery.checked) {
    drawCurve(currentSimulation.batteryProfile.map(b => Math.abs(b)), "#0ea5e9", 2, true);
  }

  // Base Profile
  if (toggleBase.checked) {
    drawCurve(currentSimulation.baseProfile, "#a855f7", 2, true);
  }

  // Shifted Optimized Profile
  if (toggleShifted.checked) {
    drawCurve(currentSimulation.shiftedProfile, "#10b981", 3);
  }

  // Hover Indicator
  if (hoveredHour !== null && hoveredHour >= 0 && hoveredHour < 24) {
    const x = hourToX(hoveredHour + 0.5);
    ctx.save();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + chartH);
    ctx.stroke();

    // Dot on shifted profile
    const yShift = powerToY(currentSimulation.shiftedProfile[hoveredHour]);
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(x, yShift, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Appliance Ledger Table Rendering
function renderApplianceTable() {
  const tbody = document.getElementById("applianceTableBody");
  tbody.innerHTML = "";
  let shiftCount = 0;

  // Restore original ordering for the table
  const apps = [...currentSimulation.dispatchedAppliances].sort((a, b) => a.priority - b.priority);

  apps.forEach(app => {
    const tr = document.createElement("tr");

    // Format Scheduled Window
    let windowText = "Inactive";
    if (app.slots.length === 24) windowText = "24h Continuous";
    else if (app.slots.length > 0) {
      windowText = `${Math.min(...app.slots)}:00 – ${Math.max(...app.slots) + 1}:00 (${app.slots.length}h)`;
    }

    // Action status
    let actionHtml = `<span class="status-preserved">Normal Operation</span>`;
    if (app.shiftedLogs.length > 0) {
      shiftCount++;
      const moves = app.shiftedLogs.map(l => `${l.from}:00 ➔ ${l.to}:00`).join(", ");
      actionHtml = `<span class="status-shifted">Deferred: ${moves}</span>`;
    }

    tr.innerHTML = `
      <td><strong>${app.name}</strong></td>
      <td><span class="priority-pill priority-${app.priority}">P${app.priority}</span></td>
      <td><code>${app.power} W</code></td>
      <td>${windowText}</td>
      <td>${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("ledgerShiftCount").textContent = `${shiftCount} load(s) deferred to off-peak`;
}

// Timeline ticks builder
function initTimelineTicks() {
  const container = document.getElementById("timelineTicks");
  container.innerHTML = "";
  for (let h = 0; h < 24; h += 2) {
    const span = document.createElement("span");
    span.textContent = `${h}:00`;
    container.appendChild(span);
  }
}

// Interactive Hover Inspection on Canvas
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const padLeft = 55;
  const padRight = 20;
  const chartW = rect.width - padLeft - padRight;

  if (mouseX >= padLeft && mouseX <= rect.width - padRight) {
    const frac = (mouseX - padLeft) / chartW;
    const hour = Math.min(23, Math.max(0, Math.floor(frac * 24)));
    hoveredHour = hour;

    if (currentSimulation) {
      const base = currentSimulation.baseProfile[hour];
      const opt = currentSimulation.shiftedProfile[hour];
      const diff = base - opt;
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;

      document.getElementById("inspectTime").textContent = `Hour ${hourStr}:`;
      document.getElementById("inspectVal").innerHTML = `
        Base: <strong>${base}W</strong> | Optimized: <strong>${opt}W</strong> 
        ${diff > 0 ? `<span style="color:#f59e0b">(-${diff}W shaved)</span>` : ''}
      `;
    }
  } else {
    hoveredHour = null;
    document.getElementById("inspectTime").textContent = "Hover over chart";
    document.getElementById("inspectVal").textContent = "";
  }
  renderCanvas();
});

canvas.addEventListener("mouseleave", () => {
  hoveredHour = null;
  document.getElementById("inspectTime").textContent = "Hover over chart";
  document.getElementById("inspectVal").textContent = "";
  renderCanvas();
});

// Event Listeners
[elThreshold, elSolar, elBattery].forEach(input => {
  input.addEventListener("input", runSimulation);
});

[toggleBase, toggleShifted, toggleSolar, toggleBattery, toggleThreshold].forEach(chk => {
  chk.addEventListener("change", renderCanvas);
});

elReset.addEventListener("click", () => {
  elThreshold.value = 2500;
  elSolar.value = 300;
  elBattery.value = 1700;
  runSimulation();
});

window.addEventListener("resize", renderCanvas);

// Initialize
initTimelineTicks();
runSimulation();
