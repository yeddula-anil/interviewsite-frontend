"use client";

export default function NeonButton({ loading, children, ...props }) {
  return (
    <button className="neon-btn" disabled={loading} {...props}>
      {loading && <span className="loader"></span>}
      {!loading && children}
    </button>
  );
}
