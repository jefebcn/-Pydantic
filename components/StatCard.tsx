interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
  color?: string;  // hex color, defaults to purple
  tag?: string;    // badge text, defaults to "Live"
}

export default function StatCard({
  icon,
  value,
  label,
  sub,
  color = "#8B5CF6",
  tag = "Live",
}: StatCardProps) {
  const [r, g, b] = hexToRgb(color);

  return (
    <div
      className="card p-5 flex flex-col gap-3 transition-all"
      style={{ borderColor: `rgba(${r},${g},${b},0.30)` }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `rgba(${r},${g},${b},0.14)`, color }}
        >
          {icon}
        </div>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full"
          style={{ background: `rgba(${r},${g},${b},0.10)`, color }}
        >
          {tag}
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {value}
        </p>
        <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        {sub && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [139, 92, 246]; // fallback purple
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}
