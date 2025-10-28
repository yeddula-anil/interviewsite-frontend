export function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-200 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
