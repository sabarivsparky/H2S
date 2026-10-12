import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/supabase.js";
import { DosimeterGauge } from "./Kiosk.jsx";

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function RiskPill({ band }) {
  if (!band) return <span className="muted">—</span>;
  const labels = { fresh: "Fresh", low: "Low", medium: "Medium", high: "High", very_high: "Very High" };
  return <span className={`pill ${band}`}>{labels[band] || band}</span>;
}

export function WorkerDashboardPage() {
  const navigate = useNavigate();
  const workerId = sessionStorage.getItem("workerId") || "";
  const token = sessionStorage.getItem("workerToken") || "";
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeMsg, setCloseMsg] = useState("");

  function loadProfile() {
    if (!token) { navigate("/worker-login", { replace: true }); return; }
    fetch(apiUrl("/api/auth/worker/me"), {
      headers: { "Authorization": `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setProfile(d);
        else setErr(d.error || "Failed to load profile.");
      })
      .catch(() => setErr("Network error — is the API running?"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProfile();
  }, [token, navigate]);

  function logout() {
    sessionStorage.removeItem("workerToken");
    sessionStorage.removeItem("workerId");
    navigate("/worker-login", { replace: true });
  }

  async function handleCloseShift() {
    const band = profile?.active_wristband;
    if (!band) return;
    if (!window.confirm(`Close your active shift and permanently mark wristband ${band} as used?`)) return;
    setCloseBusy(true);
    try {
      const res = await fetch(apiUrl("/api/kiosk/close"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ wristband_qr: band }),
      });
      const data = await res.json();
      if (data.ok) {
        setCloseMsg("Shift closed successfully. Wristband locked as used.");
        loadProfile();
      } else {
        setCloseMsg(data.error || "Failed to close shift.");
      }
    } catch {
      setCloseMsg("Network error closing shift.");
    } finally {
      setCloseBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="shell" style={{ textAlign: "center", paddingTop: 80 }}>
        <p className="muted">Loading personal exposure dashboard…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="shell" style={{ textAlign: "center", paddingTop: 80 }}>
        <p className="warn">{err}</p>
        <button className="btn primary" onClick={logout} style={{ marginTop: 16 }}>
          ← Back to login
        </button>
      </div>
    );
  }

  const w = profile?.worker;
  const scans = profile?.recent_scans || [];
  const onShift = profile?.on_shift;
  const activeWristband = profile?.active_wristband;

  const latestScan = scans.length ? scans[0] : null;
  const currentDose = latestScan?.dose_ppm_h ?? 0;
  const currentRisk = latestScan?.risk_band ?? "fresh";
  const twa8hr = (currentDose / 8.0).toFixed(2);

  return (
    <div className="shell worker-dash">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 4vw, 1.8rem)" }}>
            Welcome, {w?.name || workerId}
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            {w?.worker_id} · {w?.department || "—"} · Shift {w?.shift || "—"} · Fixed Muster Station Access
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn ghost" onClick={loadProfile} title="Refresh">
            ↻
          </button>
          <button className="btn ghost" onClick={logout}>
            🔓 Log out
          </button>
        </div>
      </div>

      {closeMsg && (
        <div className="banner" style={{ margin: "16px 0" }}>
          {closeMsg}
        </div>
      )}

      {/* Status cards */}
      <div className="dash-cards">
        <div className="dash-card">
          <div className="dash-card-label">Shift status</div>
          <div className="dash-card-value">
            {onShift ? (
              <span className="ok" style={{ fontWeight: 700 }}>● Active Shift</span>
            ) : (
              <span className="muted" style={{ fontWeight: 700 }}>○ Off Shift</span>
            )}
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">Linked Wristband</div>
          <div className="dash-card-value" style={{ fontFamily: "monospace", fontSize: 13 }}>
            {activeWristband ? (
              <strong style={{ color: "var(--accent)" }}>{activeWristband}</strong>
            ) : (
              <span className="muted">None bound</span>
            )}
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">Cumulative Dose</div>
          <div className="dash-card-value">
            {latestScan ? `${currentDose} ppm·h` : <span className="muted">—</span>}
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">Est. 8h-TWA</div>
          <div className="dash-card-value">
            {latestScan ? `${twa8hr} ppm` : <span className="muted">—</span>}
          </div>
        </div>
      </div>

      {/* Visual Dosimeter Gauge for current shift */}
      {latestScan && (
        <div className="card" style={{ marginTop: 20 }}>
          <DosimeterGauge dose={currentDose} band={currentRisk} />
        </div>
      )}

      {/* Primary CTAs */}
      <div style={{ display: "grid", gridTemplateColumns: onShift ? "1fr 1fr" : "1fr", gap: 12, marginTop: 20 }}>
        <Link to="/kiosk" id="start-kiosk-btn" className="dash-cta" style={{ margin: 0 }}>
          <span style={{ fontSize: "1.6rem" }}>📸</span>
          <div>
            <strong style={{ fontSize: 16 }}>{onShift ? "Muster Kiosk Station" : "Start Shift Session"}</strong>
            <small style={{ display: "block", fontSize: 12, opacity: 0.7, marginTop: 2 }}>
              {onShift ? "Perform mid-shift or exit badge scan" : "Bind worker ID & factory wristband QR"}
            </small>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 20, opacity: 0.6 }}>→</span>
        </Link>

        {onShift && (
          <button
            className="btn danger"
            disabled={closeBusy}
            onClick={handleCloseShift}
            style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderRadius: "var(--r-md)", textAlign: "left", height: "100%" }}
          >
            <span style={{ fontSize: "1.6rem" }}>🔒</span>
            <div>
              <strong style={{ fontSize: 15, display: "block" }}>Close Shift & Lock Band</strong>
              <small style={{ opacity: 0.85, fontSize: 12 }}>
                Permanently lock wristband {activeWristband}
              </small>
            </div>
          </button>
        )}
      </div>

      {/* Recent scan history */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>Recent Dosimeter Scan Log</h3>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              Fixed-station kiosk scans only · certified for refinery muster compliance
            </p>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>{scans.length} scan{scans.length !== 1 ? "s" : ""}</span>
        </div>

        {scans.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            No scans recorded yet. Proceed to a muster kiosk station to scan your wristband.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Scan Time</th>
                <th>Wristband QR</th>
                <th>Cumulative Dose</th>
                <th>Risk Band</th>
                <th>Confidence</th>
                <th>Quality Gate</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontSize: 12 }}>{fmt(s.timestamp)}</td>
                  <td className="muted" style={{ fontFamily: "monospace", fontSize: 12 }}>{s.wristband_qr}</td>
                  <td><strong>{s.dose_ppm_h ?? "—"}</strong> <small className="muted">ppm·h</small></td>
                  <td><RiskPill band={s.risk_band} /></td>
                  <td>{s.confidence != null ? `${(s.confidence * 100).toFixed(0)}%` : "—"}</td>
                  <td>
                    <span className={s.quality_status === "pass" ? "ok" : "warn"}>
                      {s.quality_status || "pass"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
