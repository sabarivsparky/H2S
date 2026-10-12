import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/Admin.jsx";
import { KioskPage } from "./pages/Kiosk.jsx";
import { WorkerLoginPage } from "./pages/WorkerLogin.jsx";
import { WorkerDashboardPage } from "./pages/WorkerDashboard.jsx";
import { apiUrl } from "./lib/supabase.js";
import "./styles.css";

// ── Worker session guard ──────────────────────────────────────────────────────
function WorkerRoute({ children }) {
  const token = sessionStorage.getItem("workerToken");
  if (!token) {
    return <Navigate to="/worker-login" replace />;
  }
  return children;
}

// ── Home page ─────────────────────────────────────────────────────────────────
function Home() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch(apiUrl("/api/health"))
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setHealth({ status: "offline", error: "Backend unreachable" }));
  }, []);

  const bands = [
    { name: "Fresh", range: "≤ 0.05 ppm·h", color: "#F0E9E2", text: "#1a1612", desc: "Unreacted Lead Acetate · Normal" },
    { name: "Low", range: "0.05 – 1.0 ppm·h", color: "#DCC08A", text: "#1a1612", desc: "Trace H₂S exposure detected" },
    { name: "Medium", range: "1.0 – 5.0 ppm·h", color: "#B8902F", text: "#ffffff", desc: "Elevated absorption · Monitor worker" },
    { name: "High", range: "5.0 – 20.0 ppm·h", color: "#5C4A1E", text: "#f0e9e2", desc: "Action required · Rotate off unit" },
    { name: "Very High", range: "> 20.0 ppm·h", color: "#231A24", text: "#ffffff", desc: "Critical · Medical review & evacuate" },
  ];

  return (
    <div className="shell" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
      {/* Top Tagline & Status Pill */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            padding: "4px 10px",
            background: "rgba(201, 162, 39, 0.15)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            borderRadius: 999,
          }}>
            SIH 26118 · MRPL
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            Mangalore Refinery & Petrochemicals Ltd.
          </span>
        </div>

        {/* Live System Indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          padding: "6px 14px",
          borderRadius: 999,
          fontSize: 12,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: health?.ok ? "var(--ok)" : "#ff9988",
            display: "inline-block",
            boxShadow: health?.ok ? "0 0 8px var(--ok)" : "none",
          }} />
          <span style={{ fontWeight: 600 }}>
            {health?.ok ? "System Online" : "Connecting…"}
          </span>
          {health?.store && (
            <span className="muted" style={{ fontSize: 11 }}>
              · {health.store === "memory" ? "Local In-Memory" : "Supabase Cloud"}
            </span>
          )}
        </div>
      </div>

      {/* Hero Header */}
      <div style={{ textAlign: "center", margin: "20px 0 40px" }}>
        <h1 style={{
          fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
          fontWeight: 800,
          background: "linear-gradient(135deg, #ffffff 30%, #c9a227 90%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          marginBottom: 16,
        }}>
          H₂S-DOSAI Quantitative Dosimetry
        </h1>
        <p style={{
          maxWidth: 680,
          margin: "0 auto",
          fontSize: "1.05rem",
          color: "var(--muted)",
          lineHeight: 1.7,
        }}>
          Passive colorimetric lead-acetate wristband dosimeter platform. Scanned exclusively at fixed
          muster station kiosks via computer vision and XGBoost for continuous refinery workforce safety.
        </p>
      </div>

      {/* Primary Action Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
        gap: 20,
        marginBottom: 40,
      }}>
        {/* Worker Kiosk Portal */}
        <Link
          to="/worker-login"
          id="home-worker-link"
          style={{
            textDecoration: "none",
            background: "linear-gradient(145deg, #141a17, #1c2520)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
          }}
        >
          <div>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>📸</div>
            <h2 style={{ color: "var(--ink)", margin: "0 0 8px", fontSize: "1.3rem" }}>
              Worker Muster Kiosk
            </h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
              Authenticate with your Worker ID & PIN. Bind a new single-use wristband, perform mid-shift
              calibrated optical scans, or complete end-of-shift closeout.
            </p>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
            color: "var(--accent)",
            fontWeight: 700,
            fontSize: 14,
          }}>
            <span>Access Kiosk Station</span>
            <span>→</span>
          </div>
        </Link>

        {/* Safety Desk Admin */}
        <Link
          to="/admin"
          id="home-admin-link"
          style={{
            textDecoration: "none",
            background: "linear-gradient(145deg, #141a17, #1c2520)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
          }}
        >
          <div>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>🛡️</div>
            <h2 style={{ color: "var(--ink)", margin: "0 0 8px", fontSize: "1.3rem" }}>
              Safety Desk Command Center
            </h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
              Supervisory monitoring dashboard. View active worker bindings, real-time cumulative doses,
              8-hour TWA calculations, ambient gas IoT sensors, and export shift audit CSV reports.
            </p>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
            color: "var(--accent)",
            fontWeight: 700,
            fontSize: 14,
          }}>
            <span>Enter Safety Command</span>
            <span>→</span>
          </div>
        </Link>
      </div>

      {/* Colorimetric Exposure Spectrum Reference Card */}
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Lead-Acetate Colorimetric Reference Scale</h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Quantitative optical darkening via Pb(CH₃COO)₂ + H₂S → PbS (black lead sulfide)
            </p>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            OSHA 29 CFR 1910.1000 · 10 ppm 8h-TWA Limit
          </span>
        </div>

        {/* 5 Swatches Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}>
          {bands.map((b) => (
            <div
              key={b.name}
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-sm)",
                padding: 14,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  height: 48,
                  borderRadius: 6,
                  background: b.color,
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: b.text,
                  fontWeight: 800,
                  fontSize: 12,
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                {b.name}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{b.range}</div>
              <div className="muted" style={{ fontSize: 11 }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluation Walkthrough Quick Guide */}
      <div style={{
        background: "rgba(20, 26, 23, 0.6)",
        border: "1px dashed var(--line)",
        borderRadius: "var(--r-md)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1.4rem" }}>⚡</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              Instant Demo Evaluation Workflow
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              1. Worker Login (Click WKR-0001) → 2. Scan Wristband at Kiosk → 3. Safety Desk shows real-time dose & TWA.
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/worker-login" className="btn primary" style={{ fontSize: 12, padding: "8px 14px" }}>
            1-Click Worker Login
          </Link>
          <Link to="/admin" className="btn ghost" style={{ fontSize: 12, padding: "8px 14px" }}>
            Open Safety Desk
          </Link>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <div className="topbar">
        <Link to="/" className="brand" style={{ textDecoration: "none" }}>H2S-DOSAI</Link>
        <span className="muted" style={{ fontSize: 12 }}>
          Kiosk scanning only · SIH 26118 · MRPL
        </span>
      </div>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Worker auth */}
        <Route path="/worker-login" element={<WorkerLoginPage />} />

        {/* Worker dashboard — requires valid worker session */}
        <Route
          path="/worker-dashboard"
          element={
            <WorkerRoute>
              <WorkerDashboardPage />
            </WorkerRoute>
          }
        />

        {/* Kiosk — requires valid worker session */}
        <Route
          path="/kiosk"
          element={
            <WorkerRoute>
              <KioskPage />
            </WorkerRoute>
          }
        />

        {/* Admin portal */}
        <Route path="/admin-login" element={<AdminPage />} />
        <Route path="/admin" element={<AdminPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
