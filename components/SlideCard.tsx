interface SlideCardProps {
  url: string;
  slideNum: number;
  qcScore?: { avg: number; pass: boolean };
}

const SLIDE_NAMES = [
  "Hero", "Problema / Soluzione", "Features", "Lifestyle",
  "Specifiche", "Social Proof", "Why Us",
];

export default function SlideCard({ url, slideNum, qcScore }: SlideCardProps) {
  return (
    <div
      className="card overflow-hidden group transition-all duration-200"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
    >
      {/* Image */}
      <div className="relative overflow-hidden aspect-square bg-black">
        <img
          src={url}
          alt={`Slide ${slideNum}`}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />
        {/* Slide number badge */}
        <div
          className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md"
          style={{ background: "rgba(11,11,24,0.8)", color: "var(--purple-400)" }}
        >
          {String(slideNum).padStart(2, "0")}
        </div>
        {/* QC badge */}
        {qcScore && (
          <div
            className="absolute top-2 right-2 text-xs font-mono font-bold px-2 py-1 rounded-md"
            style={{
              background: qcScore.pass
                ? "rgba(34,197,94,0.2)"
                : "rgba(239,68,68,0.2)",
              color: qcScore.pass ? "#4ade80" : "#f87171",
              border: `1px solid ${qcScore.pass ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}
          >
            QC {Math.round(qcScore.avg)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {SLIDE_NAMES[slideNum - 1] || `Slide ${slideNum}`}
          </p>
        </div>
        <a
          href={url}
          download
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: "rgba(139,92,246,0.1)",
            color: "var(--purple-400)",
            border: "1px solid rgba(139,92,246,0.2)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.2)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.1)";
          }}
        >
          <IconDownload size={12} />
          Download
        </a>
      </div>
    </div>
  );
}

function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
