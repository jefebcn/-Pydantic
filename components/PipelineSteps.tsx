const STEPS = [
  { key: "scraping",     label: "Scraping",     short: "Amazon" },
  { key: "mvd",          label: "Analisi AI",   short: "Haiku" },
  { key: "generating",   label: "Immagini",     short: "NB2" },
  { key: "qc",           label: "QC",           short: "Vision" },
  { key: "compositing",  label: "Compositing",  short: "Pillow" },
  { key: "done",         label: "Completato",   short: "" },
];

const ORDER = STEPS.map((s) => s.key);

function stepIndex(status: string) {
  const idx = ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

interface PipelineStepsProps {
  status: string;
}

export default function PipelineSteps({ status }: PipelineStepsProps) {
  const current = stepIndex(status);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STEPS.map((step, i) => {
        const done    = i < current;
        const active  = i === current;
        const pending = i > current;

        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              {/* Dot */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${active ? "pulse-purple" : ""}`}
                style={{
                  background: done
                    ? "rgba(139,92,246,0.8)"
                    : active
                    ? "linear-gradient(135deg, #7C3AED, #A855F7)"
                    : "var(--bg-card)",
                  border: pending ? "1px solid var(--border)" : "none",
                  color: done || active ? "white" : "var(--text-muted)",
                  boxShadow: active ? "0 0 12px rgba(139,92,246,0.6)" : "none",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              {/* Label */}
              <span
                className="text-xs font-medium hidden sm:block"
                style={{
                  color: done
                    ? "var(--purple-400)"
                    : active
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div
                className="w-6 h-px mx-1"
                style={{
                  background: i < current
                    ? "var(--purple-500)"
                    : "var(--border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
