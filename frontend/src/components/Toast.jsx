import { useEffect } from "react";

export default function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  if (!message) return null;

  return (
    <div style={{
      position: "fixed",
      top: 20,
      right: 20,
      background: "#b00020",
      color: "white",
      padding: "12px 16px",
      borderRadius: 6,
      zIndex: 1000
    }}>
      {message}
    </div>
  );
}
