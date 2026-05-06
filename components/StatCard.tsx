interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
  accent?: boolean;
}

export default function StatCard({ icon, value, label, sub, accent }: StatCardProps) {
  return (
    <div
      className="card p-5 flex flex-col gap-3"
      style={accent ? { borderColor: "rgba(139,92,246,0.35)" } : {}}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(139,92,246,0.15)", color: "var(--purple-400)" }}
        >
          {icon}
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full"
          style={{ background: "rgba(139,92,246,0.1)", color: "var(--purple-400)" }}>
          Live
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
