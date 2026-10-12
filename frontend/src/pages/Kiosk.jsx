import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CameraCapture, QrScanner, makeSyntheticBadge } from "../lib/camera.jsx";
import { apiUrl } from "../lib/supabase.js";

const KIOSK_ID = "KIOSK-MUSTER-01";

/** Get the worker session token from sessionStorage. */
function getWorkerToken() {
  return sessionStorage.getItem("workerToken") || "";
}

/** POST helper — automatically attaches the worker Bearer token. */
async function postJson(path, body) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getWorkerToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || "Request failed");
    err.payload = data;
    throw err;
  }
  return data;
}

function RiskPill({ band }) {
  if (!band) return null;
  const labels = { fresh: "Fresh", low: "Low", medium: "Medium", high: "High", very_high: "Very High" };
  return <span className={`pill ${band}`}>{labels[band] || band}</span>;
}

function normalizeWorkerCode(value) {
  return String(value).trim().replace(/^WRK-/i, "WKR-");
}

// ── Dosimeter Spectrum Exposure Gauge Component ──────────────────────────────
export function DosimeterGauge({ dose = 0, band }) {
  const numDose = typeof dose === "number" ? dose : parseFloat(dose) || 0;
  // Calculate marker percentage across logarithmic-feeling scale:
  // 0 -> 4%, 1 -> 25%, 5 -> 50%, 20 -> 75%, 50 -> 96%
  let pct = 4;
  if (numDose <= 0) pct = 4;
  else if (numDose <= 1) pct = 4 + (numDose / 1) * 21;
  else if (numDose <= 5) pct = 25 + ((numDose - 1) / 4) * 25;
  else if (numDose <= 20) pct = 50 + ((numDose - 5) / 15) * 25;
  else pct = Math.min(96, 75 + ((numDose - 20) / 30) * 21);

  const protocols = {
    fresh: {
      action: "Safe Operation",
      desc: "Dosimeter patch is clean off-white. No hazardous H₂S exposure detected. Continue regular shift duties.",
      badgeClass: "pill fresh",
    },
    low: {
      action: "Permissible Baseline",
      desc: "Exposure remains within permissible 8-hr TWA levels (<1 ppm·h). Routine shift monitoring recommended.",
      badgeClass: "pill low",
    },
    medium: {
      action: "Advisory Precaution",
      desc: "Noticeable golden/amber color development. Notify refinery shift safety desk & verify local ventilation.",
      badgeClass: "pill medium",
    },
    high: {
      action: "OSHA Action Alert",
      desc: "Dark olive coloration indicating high cumulative exposure (>5 ppm·h). Mandatory rest interval & muster inspection.",
      badgeClass: "pill high",
    },
    very_high: {
      action: "CRITICAL LIFE-SAFETY EVACUATION",
      desc: "Heavy metal-sulfide darkening (>20 ppm·h). IMMEDIATE EVACUATION & mandatory medical examination at refinery clinic.",
      badgeClass: "pill very_high",
    },
  };

  const curr = protocols[band] || protocols.fresh;

  return (
    <div className="dosimeter-gauge-container">
      <div className="gauge-header">
        <span className="gauge-title">🧪 Colorimetric Badge Exposure Spectrum</span>
        <span className={curr.badgeClass}>{curr.action}</span>
      </div>

      <div className="spectrum-bar">
        <div className="spectrum-segment seg-fresh" title="Fresh (0 ppm·h)">
          <span>Fresh<br />0</span>
        </div>
        <div className="spectrum-segment seg-low" title="Low (0–1 ppm·h)">
          <span>Low<br />0–1</span>
        </div>
        <div className="spectrum-segment seg-medium" title="Medium (1–5 ppm·h)">
          <span>Medium<br />1–5</span>
        </div>
        <div className="spectrum-segment seg-high" title="High (5–20 ppm·h)">
          <span>High<br />5–20</span>
        </div>
        <div className="spectrum-segment seg-very-high" title="Very High (>20 ppm·h)">
          <span>Critical<br />&gt;20</span>
        </div>

        <div className="spectrum-pin" style={{ left: `${pct}%` }}>
          <div className="pin-triangle" />
          <div className="pin-badge">{numDose.toFixed(2)} ppm·h</div>
        </div>
      </div>

      <div className="gauge-protocol">
        <strong>Refinery Safety Protocol:</strong> {curr.desc}
      </div>
    </div>
  );
}

// ── Screen A: Scan Worker ID ──────────────────────────────────────────────────
function ScreenA({ initialWorker, onWorker }) {
  const [typed, setTyped] = useState(initialWorker || "");
  const [scanning, setScanning] = useState(true);
  const [err, setErr] = useState("");

  function submit(val) {
    const v = normalizeWorkerCode(val);
    if (!v) return;
    setErr("");
    onWorker(v);
  }

  return (
    <div className="kiosk-screen">
      <div className="screen-label">Screen A</div>
      <div className="screen-icon">👷</div>
      <h2>Scan Worker ID</h2>
      <p className="muted">Point the worker's ID badge QR at the kiosk camera, or confirm below.</p>

      {/* Primary Path: Live Camera Feed */}
      {scanning && (
        <div className="qr-scanner-container">
          <QrScanner
            active
            demoCodes={["WKR-0001", "WKR-0002", "WKR-0003"]}
            onDecode={(text) => {
              submit(text);
            }}
          />
        </div>
      )}

      <div className="qr-toggle" style={{ margin: "4px 0 12px" }}>
        <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setScanning((s) => !s)}>
          {scanning ? "📷 Pause Camera" : "📷 Open QR Camera"}
        </button>
      </div>

      {/* Secondary Fallback: Typed Input */}
      <div className="qr-fallback-section">
        <span className="qr-fallback-title">Manual Confirmation (or typed ID):</span>
        <div className="kiosk-input-group">
          <input
            id="worker-id-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(typed)}
            placeholder="e.g. WKR-0001"
          />
          <button id="worker-id-submit" className="btn primary" onClick={() => submit(typed)} disabled={!typed.trim()}>
            Confirm ID →
          </button>
        </div>
      </div>

      {err && <p className="warn" style={{ marginTop: 12 }}>{err}</p>}
    </div>
  );
}

// ── Screen B: Scan Wristband QR ───────────────────────────────────────────────
function ScreenB({ workerCode, onBound, onBack }) {
  const [typed, setTyped] = useState("");
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function bind(qr) {
    const v = String(qr).trim();
    if (!v) return;
    setBusy(true);
    setErr("");
    try {
      const data = await postJson("/api/kiosk/bind", {
        worker_id: workerCode,
        wristband_qr: v,
        kiosk_id: KIOSK_ID,
      });
      onBound(v, data.worker);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kiosk-screen">
      <div className="screen-label">Screen B</div>
      <div className="screen-icon">🔗</div>
      <h2>Scan Wristband QR</h2>
      <p className="muted">
        Worker: <strong>{workerCode}</strong> · Point the wristband's factory QR at the camera.
      </p>

      {/* Primary Path: Live Camera Feed */}
      {scanning && (
        <div className="qr-scanner-container">
          <QrScanner
            active
            demoCodes={["WB-2026-000481", "WB-2026-000482", "WB-2026-000483", "WB-2026-000484"]}
            onDecode={(text) => {
              bind(text);
            }}
          />
        </div>
      )}

      <div className="qr-toggle" style={{ margin: "4px 0 12px" }}>
        <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setScanning((s) => !s)}>
          {scanning ? "📷 Pause Camera" : "📷 Open QR Camera"}
        </button>
      </div>

      {/* Secondary Fallback: Typed Input */}
      <div className="qr-fallback-section">
        <span className="qr-fallback-title">Manual Fallback (if QR code unreadable):</span>
        <div className="kiosk-input-group">
          <input
            id="wristband-qr-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && bind(typed)}
            placeholder="e.g. WB-2026-000481"
          />
          <button
            id="wristband-bind-btn"
            className="btn ghost"
            disabled={busy || !typed.trim()}
            onClick={() => bind(typed)}
          >
            {busy ? "Binding…" : "Bind →"}
          </button>
        </div>
      </div>

      {err && <p className="warn" style={{ marginTop: 12 }}>{err}</p>}

      <button className="btn ghost" style={{ marginTop: 16 }} onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}

// ── Screen C: Place Wristband — Camera Capture ────────────────────────────────
function ScreenC({ bandQr, workerName, onResult, onQualityFail, onBack, onSelectBand }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [relDark, setRelDark] = useState(0.35);

  async function sendPhoto(blob) {
    if (!bandQr) {
      setErr("Please scan or select an active wristband QR before scanning.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("image", blob, "badge.jpg");
      fd.append("wristband_qr", bandQr);
      fd.append("kiosk_id", KIOSK_ID);
      const res = await fetch(apiUrl("/api/kiosk/scan"), {
        method: "POST",
        headers: { "Authorization": `Bearer ${getWorkerToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (res.status === 422 || data.code === "QUALITY_FAIL") {
        onQualityFail(data.error || "Image unclear — please re-scan");
        return;
      }
      if (!res.ok || data.ok === false) throw new Error(data.error || "Scan failed");
      onResult(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendSynthetic() {
    const blob = await makeSyntheticBadge(relDark);
    await sendPhoto(blob);
  }

  return (
    <div className="kiosk-screen">
      <div className="screen-label">Screen C</div>
      <div className="screen-icon">📸</div>
      <h2>Place Wristband to Scan</h2>
      <p className="muted">
        Worker: <strong>{workerName || "—"}</strong> · Wristband:{" "}
        <strong>{bandQr || "None Selected"}</strong>
      </p>

      {!bandQr ? (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent)" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--accent)" }}>
            ⚠️ No wristband QR selected for this scan session.
          </p>
          <button className="btn primary" onClick={onSelectBand}>
            🔗 Scan Wristband QR First
          </button>
        </div>
      ) : (
        <div style={{ display: "inline-block", background: "var(--panel-2)", border: "1px solid var(--line)", padding: "4px 12px", borderRadius: 20, fontSize: 12, marginBottom: 12 }}>
          Active Badge: <code>{bandQr}</code>
        </div>
      )}

      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Optical blur & glare quality-gate runs before the dose engine. Failed captures prompt Re-scan.
      </p>

      {busy && (
        <div className="busy-bar">
          <span>Analysing colorimetric badge…</span>
        </div>
      )}

      <div className="capture-panel">
        <CameraCapture onCapture={sendPhoto} />
      </div>

      <div className="synthetic-panel card" style={{ marginTop: 16 }}>
        <p style={{ margin: "0 0 8px", fontSize: 13 }} className="muted">
          No physical badge? Use the calibrated synthetic badge simulator:
        </p>

        {/* Darkness preset buttons */}
        <div className="preset-row" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <button type="button" className={`btn ${relDark <= 0.05 ? "primary" : "ghost"}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setRelDark(0.0)}>
            Fresh (0.0)
          </button>
          <button type="button" className={`btn ${relDark > 0.05 && relDark <= 0.3 ? "primary" : "ghost"}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setRelDark(0.20)}>
            Low (0.20)
          </button>
          <button type="button" className={`btn ${relDark > 0.3 && relDark <= 0.6 ? "primary" : "ghost"}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setRelDark(0.48)}>
            Medium (0.48)
          </button>
          <button type="button" className={`btn ${relDark > 0.6 && relDark <= 0.85 ? "primary" : "ghost"}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setRelDark(0.75)}>
            High (0.75)
          </button>
          <button type="button" className={`btn ${relDark > 0.85 ? "primary" : "ghost"}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setRelDark(0.95)}>
            Very High (0.95)
          </button>
        </div>

        <label className="slider-label">
          Simulated badge darkening — <strong>{relDark.toFixed(2)}</strong>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={relDark}
            onChange={(e) => setRelDark(Number(e.target.value))}
          />
        </label>
        <button
          id="synthetic-scan-btn"
          className="btn primary"
          disabled={busy}
          onClick={sendSynthetic}
          style={{ marginTop: 10, width: "100%" }}
        >
          Submit synthetic badge photo
        </button>
      </div>

      {err && <p className="warn" style={{ marginTop: 12 }}>{err}</p>}

      <button className="btn ghost" style={{ marginTop: 16 }} onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}

// ── Screen D: Dose Result ─────────────────────────────────────────────────────
function ScreenD({ result, workerName, bandQr, onScanAgain, onCloseShift }) {
  const dose = result?.dose?.dose_ppm_h ?? result?.scan?.dose_ppm_h ?? 0;
  const conf = result?.dose?.confidence ?? result?.scan?.confidence ?? "—";
  const band = result?.risk_band ?? result?.scan?.risk_band ?? "fresh";
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeMsg, setCloseMsg] = useState("");
  const navigate = useNavigate();

  async function handleClose() {
    setCloseBusy(true);
    try {
      await postJson("/api/kiosk/close", { wristband_qr: bandQr, kiosk_id: KIOSK_ID });
      setCloseMsg("Shift closed — wristband permanently marked used.");
      setTimeout(onCloseShift, 2200);
    } catch (e) {
      setCloseMsg(e.message);
    } finally {
      setCloseBusy(false);
    }
  }

  // Official H2S-DOSAI reference chart colour mapping
  const bandColors = {
    fresh:     "#F0E9E2",  // off-white / cream
    low:       "#DCC08A",  // pale tan
    medium:    "#B8902F",  // gold / amber
    high:      "#5C4A1E",  // olive / dark brown
    very_high: "#231A24",  // near-black
  };
  const bgColor = band ? bandColors[band] || "var(--panel)" : "var(--panel)";
  const isLight = band === "fresh" || band === "low";

  const twa8hr = typeof dose === "number" ? (dose / 8.0).toFixed(2) : "0.00";

  return (
    <div className="kiosk-screen">
      <div className="screen-label">Screen D — Exposure Dose Result</div>

      <div className="result-card" style={{ background: bgColor, color: isLight ? "#111" : "#eee" }}>
        <div className="result-icon">✅</div>
        <h2 style={{ color: isLight ? "#111" : "#f3f3f3", margin: "8px 0 4px" }}>Scan Complete</h2>
        <p style={{ margin: "0 0 20px", opacity: 0.75, fontSize: 14 }}>
          {workerName || "Worker"} · {bandQr}
        </p>

        <div className="result-metrics">
          <div className="metric-box" style={{ background: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)" }}>
            <div className="metric-label">Cumulative Dose</div>
            <div className="metric-value">{dose} <small>ppm·h</small></div>
          </div>
          <div className="metric-box" style={{ background: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)" }}>
            <div className="metric-label">Risk Band</div>
            <div className="metric-value">
              <RiskPill band={band} />
            </div>
          </div>
          <div className="metric-box" style={{ background: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)" }}>
            <div className="metric-label">Estimated 8h-TWA</div>
            <div className="metric-value">{twa8hr} <small>ppm</small></div>
          </div>
          <div className="metric-box" style={{ background: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)" }}>
            <div className="metric-label">Confidence</div>
            <div className="metric-value">{typeof conf === "number" ? `${(conf * 100).toFixed(0)}%` : conf}</div>
          </div>
        </div>
      </div>

      {/* Interactive Colorimetric Exposure Gauge */}
      <div style={{ marginTop: 16 }}>
        <DosimeterGauge dose={dose} band={band} />
      </div>

      {closeMsg && (
        <div className="banner" style={{ marginTop: 12 }}>
          {closeMsg}
        </div>
      )}

      <div className="row" style={{ marginTop: 20, justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
        <button id="scan-again-btn" className="btn" onClick={onScanAgain}>
          📸 Scan again
        </button>
        <button id="finish-btn" className="btn primary" onClick={() => navigate("/worker-dashboard")}>
          ✅ Return to Dashboard (Keep Shift Open)
        </button>
        <button id="close-shift-btn" className="btn danger" disabled={closeBusy} onClick={handleClose}>
          {closeBusy ? "Closing…" : "🔒 Close Shift & Lock Band"}
        </button>
      </div>
    </div>
  );
}

// ── Screen E: Quality Gate Failure ────────────────────────────────────────────
function ScreenE({ reason, onRescan, onBack }) {
  return (
    <div className="kiosk-screen">
      <div className="screen-label">Screen E — Quality Gate</div>

      <div className="quality-fail-card">
        <div className="fail-icon">⚠️</div>
        <h2>Image Unclear — Please Re-scan</h2>
        <p className="warn" style={{ fontSize: 15, fontWeight: 600, margin: "8px 0" }}>
          {reason || "The captured image did not pass quality checks."}
        </p>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          Per refinery safety protocol (SIH 26118 rule 4), images failing blur or glare checks never reach the AI dose model.
        </p>
        <ul className="fail-tips">
          <li>Hold the wristband flat and still on the kiosk surface</li>
          <li>Ensure even lighting — shield from direct overhead lamp glare</li>
          <li>Hold badge approximately 15–20 cm from camera lens</li>
        </ul>
      </div>

      <div className="row" style={{ marginTop: 20, justifyContent: "center" }}>
        <button id="rescan-btn" className="btn primary" onClick={onRescan}>
          📸 Try again
        </button>
        <button className="btn ghost" onClick={onBack}>
          ← Back to Kiosk Menu
        </button>
      </div>
    </div>
  );
}

// ── Close Shift Flow (independent) ───────────────────────────────────────────
function CloseShiftFlow({ onDone }) {
  const [typed, setTyped] = useState("");
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function close(qr) {
    const v = String(qr).trim();
    if (!v) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = await postJson("/api/kiosk/close", { wristband_qr: v, kiosk_id: KIOSK_ID });
      setMsg({ ok: true, text: data.message || "Shift closed. Wristband permanently marked used." });
      setTimeout(onDone, 2500);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kiosk-screen">
      <div className="screen-label">Close Shift</div>
      <div className="screen-icon">🔒</div>
      <h2>Close Shift & Lock Wristband</h2>
      <p className="muted">Scan or type the wristband QR to permanently mark it used.</p>

      {/* Primary Path: Live Camera Feed */}
      {scanning && (
        <div className="qr-scanner-container">
          <QrScanner
            active
            demoCodes={["WB-2026-000482", "WB-2026-000485"]}
            onDecode={(t) => close(t)}
          />
        </div>
      )}

      <div className="qr-toggle" style={{ margin: "4px 0 12px" }}>
        <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setScanning((s) => !s)}>
          {scanning ? "📷 Pause Camera" : "📷 Open QR Camera"}
        </button>
      </div>

      {/* Secondary Fallback: Typed Input */}
      <div className="qr-fallback-section">
        <span className="qr-fallback-title">Manual Fallback (if QR code unreadable):</span>
        <div className="kiosk-input-group">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && close(typed)}
            placeholder="e.g. WB-2026-000482"
          />
          <button className="btn danger" disabled={busy || !typed.trim()} onClick={() => close(typed)}>
            {busy ? "Closing…" : "Lock QR"}
          </button>
        </div>
      </div>

      {msg && <div className={`banner ${msg.ok ? "" : "warn"}`} style={{ marginTop: 12 }}>{msg.text}</div>}

      <button className="btn ghost" style={{ marginTop: 16 }} onClick={onDone}>
        ← Back
      </button>
    </div>
  );
}

// ── Root Kiosk Page ───────────────────────────────────────────────────────────
export function KioskPage() {
  const navigate = useNavigate();
  // mode: idle | start-a | start-b | scan-c | result-d | quality-e | close
  const [mode, setMode] = useState("idle");
  const [workerCode, setWorkerCode] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [bandQr, setBandQr] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [qualityReason, setQualityReason] = useState("");
  const [workerProfile, setWorkerProfile] = useState(null);

  const loggedInId = sessionStorage.getItem("workerId") || "";

  // Auto-fetch profile to pre-fill active wristband and details
  useEffect(() => {
    const token = sessionStorage.getItem("workerToken");
    if (!token) return;
    fetch(apiUrl("/api/auth/worker/me"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setWorkerProfile(d);
          if (d.worker?.worker_id) setWorkerCode(d.worker.worker_id);
          if (d.worker?.name) setWorkerName(d.worker.name);
          if (d.active_wristband) setBandQr(d.active_wristband);
        }
      })
      .catch(() => {});
  }, []);

  function handleMidScanClick() {
    if (bandQr || workerProfile?.active_wristband) {
      if (!bandQr && workerProfile?.active_wristband) {
        setBandQr(workerProfile.active_wristband);
      }
      setMode("scan-c");
    } else {
      setMode("start-b");
    }
  }

  function endSession() {
    sessionStorage.removeItem("workerToken");
    sessionStorage.removeItem("workerId");
    navigate("/worker-login", { replace: true });
  }

  function reset() {
    setMode("idle");
    setScanResult(null);
    setQualityReason("");
  }

  return (
    <div className="kiosk-shell">
      <div className="kiosk-header">
        <span className="kiosk-badge">MRPL Muster Kiosk · {KIOSK_ID}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {loggedInId && (
            <span className="kiosk-tagline">
              Operator: <strong>{workerName || loggedInId}</strong> ({loggedInId})
            </span>
          )}
          <button
            className="btn ghost"
            style={{ fontSize: 12, padding: "6px 14px" }}
            onClick={() => navigate("/worker-dashboard")}
          >
            ← Dashboard
          </button>
          <button
            className="btn danger"
            style={{ fontSize: 12, padding: "6px 14px" }}
            onClick={endSession}
          >
            🔒 Log out
          </button>
        </div>
      </div>

      {/* Progress stepper */}
      {mode !== "idle" && mode !== "close" && (
        <div className="kiosk-stepper">
          {["start-a", "start-b", "scan-c", "result-d"].map((s, i) => {
            const labels = ["A: Worker ID", "B: Wristband QR", "C: Capture", "D: Result"];
            const idx = ["start-a", "start-b", "scan-c", "result-d"].indexOf(mode);
            return (
              <div key={s} className={`step ${i <= idx ? "active" : ""} ${i < idx ? "done" : ""}`}>
                <div className="step-dot">{i < idx ? "✓" : i + 1}</div>
                <div className="step-label">{labels[i]}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="kiosk-content">
        {mode === "idle" && (
          <div className="kiosk-screen idle-screen">
            <div className="idle-logo">H₂S-DOSAI</div>
            <p className="muted" style={{ maxWidth: 520, textAlign: "center", margin: "8px auto 24px", lineHeight: 1.6 }}>
              Passive colorimetric H₂S dosimeter reading station · MRPL refinery muster point {KIOSK_ID}.
              Wristbands are scanned only here — not on individual worker phones.
            </p>

            {bandQr ? (
              <div style={{ marginBottom: 20, display: "inline-block", background: "rgba(61,186,122,0.12)", border: "1px solid var(--ok)", padding: "6px 16px", borderRadius: 20, fontSize: 13, color: "var(--ok)" }}>
                ● Active Shift Linked: <strong>{bandQr}</strong>
              </div>
            ) : (
              <div style={{ marginBottom: 20, display: "inline-block", background: "var(--panel-2)", border: "1px solid var(--line)", padding: "6px 16px", borderRadius: 20, fontSize: 13 }} className="muted">
                ○ No wristband bound to this session yet
              </div>
            )}

            <div className="idle-actions">
              <button id="start-shift-btn" className="idle-btn primary" onClick={() => setMode("start-a")}>
                <span className="idle-btn-icon">▶</span>
                <span>
                  <strong>Start Shift Binding</strong>
                  <small>Worker ID → Wristband QR → Bind</small>
                </span>
              </button>
              <button id="mid-scan-btn" className="idle-btn" onClick={handleMidScanClick}>
                <span className="idle-btn-icon">📸</span>
                <span>
                  <strong>Mid-Shift / Exit Scan</strong>
                  <small>{bandQr ? `Scan active band (${bandQr})` : "Scan Wristband QR → badge photo"}</small>
                </span>
              </button>
              <button id="close-shift-idle-btn" className="idle-btn danger" onClick={() => setMode("close")}>
                <span className="idle-btn-icon">🔒</span>
                <span>
                  <strong>Close Shift & Lock Band</strong>
                  <small>Lock wristband QR permanently as used</small>
                </span>
              </button>
            </div>
          </div>
        )}

        {mode === "start-a" && (
          <ScreenA
            initialWorker={workerCode || loggedInId}
            onWorker={(id) => {
              setWorkerCode(id);
              setMode("start-b");
            }}
          />
        )}

        {mode === "start-b" && (
          <ScreenB
            workerCode={workerCode || loggedInId}
            onBound={(qr, worker) => {
              setBandQr(qr);
              setWorkerName(worker?.name || worker?.full_name || workerCode);
              setMode("scan-c");
            }}
            onBack={() => setMode("start-a")}
          />
        )}

        {mode === "scan-c" && (
          <ScreenC
            bandQr={bandQr}
            workerName={workerName}
            onResult={(data) => {
              setScanResult(data);
              setMode("result-d");
            }}
            onQualityFail={(reason) => {
              setQualityReason(reason);
              setMode("quality-e");
            }}
            onBack={() => setMode("idle")}
            onSelectBand={() => setMode("start-b")}
          />
        )}

        {mode === "result-d" && (
          <ScreenD
            result={scanResult}
            workerName={workerName}
            bandQr={bandQr}
            onScanAgain={() => setMode("scan-c")}
            onCloseShift={reset}
          />
        )}

        {mode === "quality-e" && (
          <ScreenE
            reason={qualityReason}
            onRescan={() => setMode("scan-c")}
            onBack={reset}
          />
        )}

        {mode === "close" && <CloseShiftFlow onDone={reset} />}
      </div>
    </div>
  );
}
