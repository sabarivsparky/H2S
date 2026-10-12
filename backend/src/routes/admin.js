import { Router } from "express";
import { store } from "../store/index.js";
import { hashPin, verifyWorkerToken, verifyAdminToken } from "../lib/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const adminRouter = Router();

// ── Admin auth guard ──────────────────────────────────────────────────────────
async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Admin auth required." });
  }
  const token = header.slice(7);

  // 1. Check if token is local admin dev token
  if (token === "local-admin-dev-token") {
    req.adminUser = { id: "local-admin", email: "admin@mrpl.in" };
    return next();
  }

  // 2. Reject worker tokens explicitly & accept signed admin JWTs
  try {
    const adminPayload = verifyAdminToken(token);
    if (adminPayload) {
      req.adminUser = { id: adminPayload.sub, email: adminPayload.email || "admin@mrpl.in" };
      return next();
    }
  } catch {
    // Not a local admin JWT
  }

  try {
    const workerPayload = verifyWorkerToken(token);
    if (workerPayload && workerPayload.role === "worker") {
      return res.status(403).json({ ok: false, error: "Worker tokens cannot access admin endpoints." });
    }
  } catch {
    // Not a worker token, proceed to check Supabase or fallback
  }

  const hasSupabase =
    process.env.SUPABASE_URL &&
    !String(process.env.SUPABASE_URL).includes("YOUR_PROJECT");

  if (hasSupabase) {
    // Verify Supabase JWT by calling getUser (service_role can do this)
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      console.error("[requireAdmin] Supabase getUser failed:", error?.message || error, "| token length:", token.length);
      return res.status(401).json({ ok: false, error: "Invalid or expired admin session." });
    }
    req.adminUser = data.user;
  } else {
    // In-memory mode: accept any non-worker Bearer token
    req.adminUser = { id: "local-admin", email: "admin@mrpl.in" };
  }
  next();
}

/**
 * GET /api/admin/overview
 * Returns active shifts + recent scan_logs for the dashboard.
 */
adminRouter.get("/overview", requireAdmin, async (_req, res) => {
  try {
    const workers = await store.listWorkers();
    return res.json({
      ok: true,
      workers,
      active_shifts: workers.filter((w) => w.active_binding),
      scans: workers
        .filter((w) => w.latest_scan)
        .map((w) => ({ ...w.latest_scan, worker: { worker_id: w.worker_id, name: w.name } })),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/admin/workers/:id/history
 * Returns all scan_logs for a specific worker.
 */
adminRouter.get("/workers/:id/history", requireAdmin, async (req, res) => {
  try {
    const result = await store.workerHistory(req.params.id);
    if (!result.ok) return res.status(result.status || 404).json(result);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/admin/workers
 * Returns all workers (active + inactive) for the management table.
 * Never includes pin_hash in the response.
 */
adminRouter.get("/workers", requireAdmin, async (_req, res) => {
  try {
    const workers = await store.listAllWorkers();
    return res.json({ ok: true, workers });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/admin/workers/next-id
 * Suggests the next sequential worker ID (e.g. WKR-0004 if 3 exist).
 */
adminRouter.get("/workers/next-id", requireAdmin, async (_req, res) => {
  try {
    const workers = await store.listAllWorkers();
    const nums = workers
      .map((w) => w.worker_id)
      .filter((id) => /^WKR-\d+$/.test(id))
      .map((id) => parseInt(id.replace("WKR-", ""), 10));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return res.json({ ok: true, next_id: `WKR-${String(next).padStart(4, "0")}` });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/admin/workers
 * Body: { worker_id, name, department, shift, pin }
 * Creates a new worker account with a hashed PIN.
 */
adminRouter.post("/workers", requireAdmin, async (req, res) => {
  const { worker_id, name, department, shift, pin } = req.body || {};
  if (!worker_id || !name || !pin) {
    return res.status(400).json({ ok: false, error: "worker_id, name, and pin are required." });
  }
  if (!department) {
    return res.status(400).json({ ok: false, error: "department is required." });
  }
  if (!shift) {
    return res.status(400).json({ ok: false, error: "shift is required." });
  }
  const pinStr = String(pin);
  if (!/^\d{4,6}$/.test(pinStr)) {
    return res.status(400).json({ ok: false, error: "PIN must be 4–6 digits." });
  }

  try {
    const pin_hash = await hashPin(pinStr);
    const result = await store.createWorker({
      worker_id: String(worker_id).trim().toUpperCase(),
      name: String(name).trim(),
      department: String(department).trim(),
      shift: String(shift).trim(),
      pin_hash,
    });
    if (!result.ok) return res.status(result.status || 500).json(result);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PATCH /api/admin/workers/:id/reset-pin
 * Generates a new random 4-digit PIN, hashes it, updates the worker,
 * and returns the plaintext PIN exactly once for the admin to relay.
 */
adminRouter.patch("/workers/:id/reset-pin", requireAdmin, async (req, res) => {
  const worker_id = req.params.id;
  const newPin = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
  try {
    const pin_hash = await hashPin(newPin);
    const result = await store.updateWorkerPin(worker_id, pin_hash);
    if (!result.ok) return res.status(result.status || 500).json(result);
    return res.json({ ok: true, worker_id, new_pin: newPin });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PATCH /api/admin/workers/:id/deactivate
 * Deactivates a worker account (soft delete).
 */
adminRouter.patch("/workers/:id/deactivate", requireAdmin, async (req, res) => {
  try {
    const result = await store.deactivateWorker(req.params.id);
    if (!result.ok) return res.status(result.status || 500).json(result);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

adminRouter.patch("/workers/:id/activate", requireAdmin, async (req, res) => {
  try {
    const result = await store.activateWorker(req.params.id);
    if (!result.ok) return res.status(result.status || 500).json(result);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/admin/wristbands
 * Returns all registered wristbands.
 */
adminRouter.get("/wristbands", requireAdmin, async (_req, res) => {
  try {
    const wristbands = await store.listWristbands();
    return res.json({ ok: true, wristbands });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/admin/wristbands
 * Body: { wristband_qr, batch_id? }
 * Registers a new wristband QR as available.
 */
adminRouter.post("/wristbands", requireAdmin, async (req, res) => {
  const { wristband_qr, batch_id } = req.body || {};
  if (!wristband_qr) {
    return res.status(400).json({ ok: false, error: "wristband_qr is required." });
  }
  try {
    const result = await store.registerWristband({
      wristband_qr: String(wristband_qr).trim(),
      batch_id: batch_id ? String(batch_id).trim() : undefined,
    });
    if (!result.ok) return res.status(result.status || 500).json(result);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/admin/sensor-demo
 * Ingest for the optional MQ-136 / DHT-11 pack (Phase 3 supplementary sensor).
 */
adminRouter.post("/sensor-demo", requireAdmin, async (req, res) => {
  const { worker_id, kiosk_location, ambient_h2s_ppm, temperature_c, humidity_percent } = req.body || {};
  if (!worker_id) return res.status(400).json({ ok: false, error: "worker_id required" });
  try {
    const result = await store.insertAmbientReading({
      worker_id,
      kiosk_location: kiosk_location || "KIOSK-MUSTER-01",
      ambient_h2s_ppm: ambient_h2s_ppm ?? 0,
      temperature_c: temperature_c ?? 28,
      humidity_percent: humidity_percent ?? 65,
    });
    return res.json({ ok: true, reading: result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/admin/reset-demo
 * Re-seeds the in-memory database with fresh refinery demo shifts and workers.
 */
adminRouter.post("/reset-demo", requireAdmin, async (_req, res) => {
  try {
    if (store.mode === "memory" && typeof store.seedDefaultData === "function") {
      await store.seedDefaultData(true);
      return res.json({ ok: true, message: "Demo database reset to default seed data successfully." });
    }
    return res.json({ ok: false, error: "Reset demo is only available in local in-memory mode." });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});
