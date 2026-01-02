import { useState } from "react";
import { login } from "../api";

export default function LoginPage({ onLogin }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(e.target.password.value);
      onLogin(res);
    } catch {
      setError("Falsches Passwort");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        padding: "24px 16px"
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 360,
          margin: "0 auto"
        }}
      >
        <h2 style={{ marginBottom: 16 }}>Zugang</h2>

        <form
          onSubmit={submit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          <input
            type="password"
            name="password"
            placeholder="Passwort"
            required
            autoFocus
            style={{
              padding: "12px 10px",
              fontSize: 16, // prevents iOS zoom
              borderRadius: 6,
              border: "1px solid #ccc",
              width: "100%",
              boxSizing: "border-box"
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 0",
              fontSize: 15,
              borderRadius: 8,
              border: "none",
              background: loading ? "#aaa" : "#111",
              color: "white",
              fontWeight: 600,
              width: "100%"
            }}
          >
            {loading ? "Anmelden…" : "Anmelden"}
          </button>
        </form>

        {error && (
          <div
            style={{
              marginTop: 12,
              color: "#c62828",
              fontWeight: 500
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
