interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
  color?: string;
  tag?: string;
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
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 flex flex-col gap-3 transition-all"
      style={{
        background: `linear-gradient(135deg, ${rgba(0.13)} 0%, #13132A 55%)`,
        border: `1px solid ${rgba(0.45)}`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* Subtle glow in corner */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: rgba(0.12), filter: "blur(16px)" }} />

      <div className="flex items-center justify-between relative">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: rgba(0.22), color }}
        >
          {icon}
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: rgba(0.18), color, border: `1px solid ${rgba(0.35)}` }}
        >
          {tag}
        </span>
      </div>

      <div className="relative">
        <p className="text-3xl font-black tracking-tight" style={{ color }}>
          {value}
        </p>
        <p className="text-sm font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        {sub && (
          <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [139, 92, 246];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}
