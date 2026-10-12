import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/supabase.js";

export function WorkerLoginPage() {
  const [workerId, setWorkerId] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    const id = workerId.trim().toUpperCase();
    const pinStr = pin.trim();
    if (!id || !pinStr) { setErr("Worker ID and PIN are required."); return; }
    if (!/^\d{4,6}$/.test(pinStr)) { setErr("PIN must be 4–6 digits."); return; }

    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/auth/worker/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: id, pin: pinStr }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Login failed.");
        return;
      }
      // Store token in sessionStorage — scoped to this tab/session only
      sessionStorage.setItem("workerToken", data.token);
      sessionStorage.setItem("workerId", data.worker_id);
      navigate("/worker-dashboard", { replace: true });
    } catch {
      setErr("Network error — is the API server running?");
    } finally {
      setBusy(false);
    }
  }

  const [showPin, setShowPin] = useState(false);

  function fillDemo(id, p) {
    setWorkerId(id);
    setPin(p);
    setErr("");
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-logo">H₂S-DOSAI</div>
        <p className="login-tagline">Muster Kiosk Station Login</p>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
          Enter your MRPL Worker ID and 4–6 digit security PIN to begin your shift dosimetry session.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Worker ID</label>
            <input
              id="worker-id-login"
              type="text"
              placeholder="e.g. WKR-0001"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Security PIN</label>
              <button
                type="button"
                className="btn ghost"
                style={{ padding: "0 4px", fontSize: 11, color: "var(--accent)" }}
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? "Hide PIN" : "Show PIN"}
              </button>
            </div>
            <input
              id="worker-pin-login"
              type={showPin ? "text" : "password"}
              placeholder="4–6 digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            id="worker-login-btn"
            className="btn primary"
            type="submit"
            disabled={busy}
            style={{ width: "100%", marginTop: 4 }}
          >
            {busy ? "Verifying Credentials…" : "Open Kiosk Session →"}
          </button>

          {err && (
            <p className="warn" style={{ margin: "6px 0 0", fontSize: 13 }}>
              {err}
            </p>
          )}
        </form>

        {/* Quick Demo Credentials */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
          <p style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: "0 0 8px" }}>
            ⚡ Quick Demo Logins (Click to autofill):
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              type="button"
              className="btn ghost"
              style={{ justifyContent: "space-between", fontSize: 12, padding: "8px 12px", background: "var(--panel-2)" }}
              onClick={() => fillDemo("WKR-0001", "1234")}
            >
              <span>👷 <strong>WKR-0001</strong> (Arun Kumar · CDU)</span>
              <span className="muted">PIN: 1234</span>
            </button>
            <button
              type="button"
              className="btn ghost"
              style={{ justifyContent: "space-between", fontSize: 12, padding: "8px 12px", background: "var(--panel-2)" }}
              onClick={() => fillDemo("WKR-0002", "5678")}
            >
              <span>👷 <strong>WKR-0002</strong> (Priya Sharma · SRU)</span>
              <span className="muted">PIN: 5678</span>
            </button>
            <button
              type="button"
              className="btn ghost"
              style={{ justifyContent: "space-between", fontSize: 12, padding: "8px 12px", background: "var(--panel-2)" }}
              onClick={() => fillDemo("WKR-0003", "1122")}
            >
              <span>👷 <strong>WKR-0003</strong> (Rajesh Patel · VDU)</span>
              <span className="muted">PIN: 1122</span>
            </button>
          </div>
        </div>

        <p style={{ marginTop: 24, fontSize: 12, textAlign: "center" }} className="muted">
          Safety Officer / Admin?{" "}
          <a href="/admin-login" style={{ color: "var(--accent)" }}>
            Safety Desk Dashboard →
          </a>
        </p>
      </div>
    </div>
  );
}
