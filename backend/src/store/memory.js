import { USED_MSG } from "../lib/doseStub.js";

function nowIso() {
  return new Date().toISOString();
}
function uid() {
  return crypto.randomUUID();
}

// In-memory data store with realistic MRPL seed data for instant zero-config testing.
const db = {
  workers:  [],   // { worker_id, name, department, shift, pin_hash, active, created_at }
  wristbands: [], // { wristband_qr, batch_id, status, created_at }
  bindings: [],
  scans:    [],
  ambient:  [],
};

function worker(id) {
  return db.workers.find((w) => w.worker_id === id && w.active !== false);
}
function band(qr) {
  return db.wristbands.find((w) => w.wristband_qr === qr);
}
function openBindingByBand(qr) {
  return db.bindings.find((b) => b.wristband_qr === qr && !b.shift_end);
}
function openBindingByWorker(id) {
  return db.bindings.find((b) => b.worker_id === id && !b.shift_end);
}

let seedPromise = null;

async function seedDefaultData(force = false) {
  if (db.workers.length > 0 && !force) return;
  const { default: bcrypt } = await import("bcrypt");

  const [h1234, h5678, h1122, h3344, h9988] = await Promise.all([
    bcrypt.hash("1234", 10),
    bcrypt.hash("5678", 10),
    bcrypt.hash("1122", 10),
    bcrypt.hash("3344", 10),
    bcrypt.hash("9988", 10),
  ]);

  const now = Date.now();
  const isoAgo = (mins) => new Date(now - mins * 60 * 1000).toISOString();

  db.workers = [
    { worker_id: "WKR-0001", name: "Arun Kumar", department: "CDU (Crude Distillation)", shift: "A", pin_hash: h1234, active: true, created_at: isoAgo(1440) },
    { worker_id: "WKR-0002", name: "Priya Sharma", department: "SRU (Sulfur Recovery)", shift: "A", pin_hash: h5678, active: true, created_at: isoAgo(1440) },
    { worker_id: "WKR-0003", name: "Rajesh Patel", department: "VDU (Vacuum Distillation)", shift: "B", pin_hash: h1122, active: true, created_at: isoAgo(1200) },
    { worker_id: "WKR-0004", name: "Ananya Rao", department: "HGU (Hydrogen Generation)", shift: "C", pin_hash: h3344, active: true, created_at: isoAgo(960) },
    { worker_id: "WKR-0005", name: "Vikram Singh", department: "Safety & Inspection", shift: "General", pin_hash: h9988, active: true, created_at: isoAgo(720) },
  ];

  db.wristbands = [
    { wristband_qr: "WB-2026-000481", batch_id: "BATCH-2026-MRPL-01", status: "available", created_at: isoAgo(1440) },
    { wristband_qr: "WB-2026-000482", batch_id: "BATCH-2026-MRPL-01", status: "bound", created_at: isoAgo(1440) },
    { wristband_qr: "WB-2026-000483", batch_id: "BATCH-2026-MRPL-01", status: "available", created_at: isoAgo(1440) },
    { wristband_qr: "WB-2026-000484", batch_id: "BATCH-2026-MRPL-02", status: "available", created_at: isoAgo(720) },
    { wristband_qr: "WB-2026-000485", batch_id: "BATCH-2026-MRPL-01", status: "used", created_at: isoAgo(1440) },
  ];

  db.bindings = [
    {
      id: "bind-001",
      worker_id: "WKR-0001",
      wristband_qr: "WB-2026-000482",
      shift_start: isoAgo(180),
      shift_end: null,
      kiosk_location: "KIOSK-MUSTER-01",
    },
    {
      id: "bind-002",
      worker_id: "WKR-0002",
      wristband_qr: "WB-2026-000485",
      shift_start: isoAgo(540),
      shift_end: isoAgo(60),
      kiosk_location: "KIOSK-MUSTER-01",
    },
  ];

  db.scans = [
    {
      id: "scan-seed-01",
      wristband_qr: "WB-2026-000482",
      worker_id: "WKR-0001",
      timestamp: isoAgo(150),
      image_url: "[synthetic-baseline-scan]",
      quality_status: "pass",
      kiosk_location: "KIOSK-MUSTER-01",
      dose_ppm_h: 0.35,
      confidence: 0.94,
      risk_band: "low",
    },
    {
      id: "scan-seed-02",
      wristband_qr: "WB-2026-000482",
      worker_id: "WKR-0001",
      timestamp: isoAgo(30),
      image_url: "[synthetic-mid-scan]",
      quality_status: "pass",
      kiosk_location: "KIOSK-MUSTER-01",
      dose_ppm_h: 0.85,
      confidence: 0.91,
      risk_band: "low",
    },
    {
      id: "scan-seed-03",
      wristband_qr: "WB-2026-000485",
      worker_id: "WKR-0002",
      timestamp: isoAgo(300),
      image_url: "[synthetic-scan]",
      quality_status: "pass",
      kiosk_location: "KIOSK-MUSTER-01",
      dose_ppm_h: 2.40,
      confidence: 0.88,
      risk_band: "medium",
    },
    {
      id: "scan-seed-04",
      wristband_qr: "WB-2026-000485",
      worker_id: "WKR-0002",
      timestamp: isoAgo(75),
      image_url: "[synthetic-scan]",
      quality_status: "pass",
      kiosk_location: "KIOSK-MUSTER-01",
      dose_ppm_h: 4.60,
      confidence: 0.86,
      risk_band: "medium",
    },
    {
      id: "scan-seed-05",
      wristband_qr: "WB-HIST-0001",
      worker_id: "WKR-0003",
      timestamp: isoAgo(720),
      image_url: "[synthetic-scan]",
      quality_status: "pass",
      kiosk_location: "KIOSK-MUSTER-01",
      dose_ppm_h: 14.20,
      confidence: 0.90,
      risk_band: "high",
    },
  ];

  // Seed ambient telemetry
  db.ambient = [];
  for (let i = 24; i >= 0; i--) {
    db.ambient.push({
      id: `amb-seed-${i}`,
      worker_id: null,
      kiosk_location: "KIOSK-MUSTER-01",
      ambient_h2s_ppm: Number((0.8 + Math.sin(i * 0.4) * 0.5 + Math.random() * 0.2).toFixed(2)),
      temperature_c: Number((28.5 + (24 - i) * 0.05).toFixed(1)),
      humidity_percent: Number((64 - Math.sin(i * 0.3) * 3).toFixed(1)),
      timestamp: isoAgo(i * 2),
    });
  }
}

// Auto-seed in background on startup
seedPromise = seedDefaultData().catch((e) => console.error("[memoryStore] Seed failed:", e));

async function ensureSeeded() {
  if (seedPromise) await seedPromise;
}

export const memoryStore = {
  mode: "memory",

  async seedDefaultData(force = false) {
    return seedDefaultData(force);
  },

  // ── Worker management ────────────────────────────────────────────────────────

  async createWorker({ worker_id, name, department, shift, pin_hash }) {
    await ensureSeeded();
    if (db.workers.find((w) => w.worker_id === worker_id)) {
      return { ok: false, status: 409, error: "Worker ID already exists." };
    }
    const w = { worker_id, name, department, shift, pin_hash, active: true, created_at: nowIso() };
    db.workers.push(w);
    const { pin_hash: _ph, ...safe } = w;
    return { ok: true, worker: safe };
  },

  async verifyWorkerPin(worker_id, pin) {
    await ensureSeeded();
    const { default: bcrypt } = await import("bcrypt");
    const w = db.workers.find((w) => w.worker_id === worker_id);
    if (!w || !w.active) return false;        // don't reveal whether id exists
    return bcrypt.compare(String(pin), w.pin_hash);
  },

  async deactivateWorker(worker_id) {
    await ensureSeeded();
    const w = db.workers.find((w) => w.worker_id === worker_id);
    if (!w) return { ok: false, status: 404, error: "Worker not found." };
    w.active = false;
    return { ok: true };
  },

  // ── Wristband management ─────────────────────────────────────────────────────

  async registerWristband({ wristband_qr, batch_id }) {
    await ensureSeeded();
    if (band(wristband_qr)) return { ok: false, status: 409, error: "Wristband already registered." };
    const wb = { wristband_qr, batch_id: batch_id || "BATCH-UNSET", status: "available", created_at: nowIso() };
    db.wristbands.push(wb);
    return { ok: true, wristband: wb };
  },

  async listWristbands() {
    await ensureSeeded();
    return [...db.wristbands].reverse();
  },

  // ── Shift operations ─────────────────────────────────────────────────────────

  async bindWristband({ worker_id, wristband_qr, kiosk_location }) {
    const w = worker(worker_id);
    if (!w) return { ok: false, status: 404, error: "Worker ID not recognised." };
    const wb = band(wristband_qr);
    if (!wb) return { ok: false, status: 404, error: "Wristband QR not recognised." };
    if (wb.status === "used") return { ok: false, status: 409, error: USED_MSG };
    if (wb.status === "bound" || openBindingByBand(wristband_qr)) {
      return { ok: false, status: 409, error: "This wristband is already bound to an active shift." };
    }
    if (openBindingByWorker(worker_id)) {
      return { ok: false, status: 409, error: "This worker already has an active shift." };
    }
    wb.status = "bound";
    const binding = {
      id: uid(),
      wristband_qr,
      worker_id,
      shift_start: nowIso(),
      shift_end: null,
      kiosk_location: kiosk_location || "KIOSK-MUSTER-01",
    };
    db.bindings.push(binding);
    const { pin_hash: _ph, ...safeWorker } = w;
    return { ok: true, binding, worker: safeWorker, wristband: wb };
  },

  async closeShift({ wristband_qr }) {
    const wb = band(wristband_qr);
    if (!wb) return { ok: false, status: 404, error: "Wristband QR not recognised." };
    if (wb.status === "used") return { ok: false, status: 409, error: USED_MSG };
    const binding = openBindingByBand(wristband_qr);
    if (!binding) return { ok: false, status: 409, error: "No active shift for this wristband." };
    binding.shift_end = nowIso();
    wb.status = "used";
    return { ok: true, message: "Shift closed. Wristband QR is permanently marked used.", wristband: wb };
  },

  async lookupBand(wristband_qr) {
    const wb = band(wristband_qr);
    if (!wb) return { ok: false, status: 404, error: "Wristband QR not recognised." };
    if (wb.status === "used") return { ok: false, status: 409, error: USED_MSG };
    const binding = openBindingByBand(wristband_qr);
    if (!binding) return { ok: false, status: 409, error: "Bind worker ID + wristband QR first." };
    const w = worker(binding.worker_id);
    const { pin_hash: _ph, ...safeWorker } = w || {};
    return { ok: true, wristband: wb, binding, worker: safeWorker };
  },

  async insertScan({ wristband_qr, imageBuffer, mime, filename, image_url, quality_status, dose_ppm_h, confidence, risk_band, kiosk_id }) {
    const looked = await this.lookupBand(wristband_qr);
    if (!looked.ok) return looked;

    const isPass = !quality_status || quality_status === "pass";
    const row = {
      id: uid(),
      wristband_qr,
      worker_id: looked.worker.worker_id,
      timestamp: nowIso(),
      image_url: image_url || (imageBuffer ? `[memory:${filename || "scan.jpg"}]` : null),
      quality_status: isPass ? "pass" : quality_status,
      kiosk_location: kiosk_id || "KIOSK-MUSTER-01",
      dose_ppm_h: isPass ? (dose_ppm_h ?? null) : null,
      confidence: isPass ? (confidence ?? null) : null,
      risk_band: isPass ? (risk_band ?? null) : null,
    };
    db.scans.unshift(row);

    if (!isPass) {
      return {
        ok: false,
        status: 422,
        code: "QUALITY_FAIL",
        error: `Image unclear — please re-scan (${quality_status})`,
        quality_status,
        scan: row,
      };
    }
    return { ok: true, scan: row, worker: looked.worker };
  },

  async insertAmbientReading({ worker_id: wid, kiosk_location, ambient_h2s_ppm, temperature_c, humidity_percent }) {
    const row = {
      id: uid(),
      worker_id: wid || null,
      kiosk_location: kiosk_location || "KIOSK-MUSTER-01",
      ambient_h2s_ppm: Number(ambient_h2s_ppm || 0),
      temperature_c: Number(temperature_c || 28),
      humidity_percent: Number(humidity_percent || 65),
      timestamp: nowIso(),
    };
    db.ambient.push(row);
    if (db.ambient.length > 500) db.ambient.shift();
    return row;
  },

  async getLatestAmbient(limit = 30) {
    const sorted = [...db.ambient].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const recent = sorted.slice(-limit);
    const latest = recent.length ? recent[recent.length - 1] : null;
    return { ok: true, latest, recent };
  },

  async listWorkers() {
    await ensureSeeded();
    return db.workers
      .filter((w) => w.active !== false)
      .map((w) => {
        const { pin_hash: _ph, ...safe } = w;
        const workerBindings = db.bindings.filter((b) => b.worker_id === w.worker_id);
        const workerQrs = workerBindings.map((b) => b.wristband_qr);
        const latest = db.scans.find((s) => {
          if (s.worker_id === w.worker_id) return true;
          if (workerQrs.includes(s.wristband_qr)) return true;
          return false;
        });
        return { ...safe, latest_scan: latest || null, active_binding: openBindingByWorker(w.worker_id) || null };
      });
  },

  /** Returns ALL workers (active + inactive) without pin_hash — for admin management. */
  async listAllWorkers() {
    await ensureSeeded();
    return db.workers.map((w) => {
      const { pin_hash: _ph, ...safe } = w;
      return safe;
    });
  },

  async updateWorkerPin(worker_id, pin_hash) {
    await ensureSeeded();
    const w = db.workers.find((wk) => wk.worker_id === worker_id);
    if (!w) return { ok: false, status: 404, error: "Worker not found." };
    w.pin_hash = pin_hash;
    return { ok: true };
  },

  async activateWorker(worker_id) {
    await ensureSeeded();
    const w = db.workers.find((wk) => wk.worker_id === worker_id);
    if (!w) return { ok: false, status: 404, error: "Worker not found." };
    w.active = true;
    return { ok: true };
  },

  /** Worker self-lookup: returns profile + current shift + recent scans. */
  async getWorkerProfile(worker_id) {
    await ensureSeeded();
    const w = db.workers.find((wk) => wk.worker_id === worker_id && wk.active !== false);
    if (!w) return { ok: false, status: 404, error: "Worker not found." };
    const { pin_hash: _ph, ...safe } = w;
    const activeBinding = openBindingByWorker(worker_id);
    const qrs = db.bindings.filter((b) => b.worker_id === worker_id).map((b) => b.wristband_qr);
    const scans = db.scans
      .filter((s) => s.worker_id === worker_id || qrs.includes(s.wristband_qr))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
    return {
      ok: true,
      worker: safe,
      on_shift: !!activeBinding,
      active_wristband: activeBinding?.wristband_qr || null,
      recent_scans: scans,
    };
  },

  async workerHistory(worker_id) {
    await ensureSeeded();
    const w = db.workers.find((wk) => wk.worker_id === worker_id);
    if (!w) return { ok: false, status: 404, error: "Worker not found." };
    const { pin_hash: _ph, ...safeWorker } = w;
    const qrs = db.bindings.filter((b) => b.worker_id === worker_id).map((b) => b.wristband_qr);
    const scans = db.scans
      .filter((s) => s.worker_id === worker_id || qrs.includes(s.wristband_qr))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return { ok: true, worker: safeWorker, scans, bindings: db.bindings.filter((b) => b.worker_id === worker_id) };
  },
};

export const memStore = memoryStore;
export { seedDefaultData };

