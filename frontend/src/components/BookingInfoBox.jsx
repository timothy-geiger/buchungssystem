import { useEffect, useRef, useState } from "react";

export default function BookingInfoBox({ rules, resourceKey }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  console.log(resourceKey)
  console.log(rules)

  /* ---------- Close on outside click (mouse + touch) ---------- */
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (!rules) return null;

  const resourceRule =
    resourceKey && rules.resource_rules?.[resourceKey];

  return (
    <div
      ref={ref}
      style={{
        display: "inline-flex",
        alignItems: "center"
      }}
    >
      {/* Info icon */}
      <button
        type="button"
        aria-label="Buchungsinformationen"
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          padding: 2,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#000"
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <circle cx="12" cy="8" r="1" fill="currentColor" />
        </svg>
      </button>

      {/* Info overlay */}
      {open && (
        <div
          style={{
            position: "fixed",
            top: "20vh",
            left: "50%",
            transform: "translateX(-50%)",

            width: "min(92vw, 360px)",
            maxHeight: "70vh",
            overflowY: "auto",

            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
            zIndex: 2000
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 12
            }}
          >
            Buchungsregeln
          </div>

          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            <div style={{ marginBottom: 10 }}>
              ⏰ <strong>Zeitraum:</strong><br />
              {rules.min_time} – {rules.max_time}
            </div>

            <div style={{ marginBottom: 10 }}>
              ⏱ <strong>Zeitschritte:</strong><br />
              {rules.step_minutes} Minuten
            </div>

            <div style={{ marginBottom: 10 }}>
              📅 <strong>Vorausbuchung:</strong><br />
              Maximal {rules.max_days_ahead} Tage im Voraus
            </div>

            {resourceRule && (
              <div style={{ marginBottom: 10 }}>
                ⌛ <strong>Buchungsdauer:</strong><br />
                {resourceRule.min_minutes} –{" "}
                {resourceRule.max_minutes} Minuten
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              ⚠️ <strong>Einschränkung:</strong><br />
              Pro Tag ist nur <strong>eine Buchung pro
              Gemeinschaftsressource</strong> erlaubt.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
