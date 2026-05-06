interface ProgressBarProps {
  progress: number;
  label: string;
  active?: boolean;
}

export default function ProgressBar({ progress, label, active = true }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-2">
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="font-semibold" style={{ color: "var(--purple-400)" }}>
          {progress}%
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${active && progress < 100 ? "progress-shimmer" : ""}`}
          style={{
            width: `${progress}%`,
            background: active && progress < 100
              ? undefined
              : "linear-gradient(90deg, var(--purple-600), var(--purple-400))",
          }}
        />
      </div>
    </div>
  );
}
