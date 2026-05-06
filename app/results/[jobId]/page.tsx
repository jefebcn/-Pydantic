"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProgressBar from "@/components/ProgressBar";
import PipelineSteps from "@/components/PipelineSteps";
import SlideCard from "@/components/SlideCard";

interface Job {
  id: string;
  asin: string;
  status: string;
  progress: number;
  current_step: string;
  slide_urls: string[];
  error_message: string | null;
  qc_scores: Record<string, { avg: number; pass: boolean }>;
  duration_ms: number;
}

const STATUS_LABELS: Record<string, string> = {
  queued:      "In coda",
  scraping:    "Scraping Amazon",
  mvd:         "Analisi AI",
  generating:  "Generazione immagini",
  qc:          "Quality Check",
  compositing: "Compositing",
  done:        "Completato",
  error:       "Errore",
};

export default function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router    = useRouter();
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      const res  = await fetch(`/api/status/${jobId}`);
      const data = await res.json();
      setJob(data);
      if (["done", "error"].includes(data.status)) clearInterval(poll);
    }, 2000);
    return () => clearInterval(poll);
  }, [jobId]);

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-3" style={{ color: "var(--text-muted)" }}>
        <SpinnerIcon />
        <span className="text-sm">Caricamento job...</span>
      </div>
    );
  }

  const isDone  = job.status === "done";
  const isError = job.status === "error";
  const avgQC   = job.qc_scores
    ? Object.values(job.qc_scores).reduce((s, q) => s + q.avg, 0) /
      Math.max(Object.values(job.qc_scores).length, 1)
    : null;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-muted)" }}>
        <button onClick={() => router.push("/")} className="hover:text-white transition-colors">
          Dashboard
        </button>
        <span>/</span>
        <span style={{ color: "var(--purple-400)" }}>Job {job.asin}</span>
      </div>

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {job.asin}
            </h1>
            <StatusChip status={job.status} />
          </div>
          {isDone && job.duration_ms && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Completato in{" "}
              <span style={{ color: "var(--purple-400)" }}>
                {(job.duration_ms / 1000).toFixed(1)}s
              </span>
              {avgQC !== null && (
                <>
                  {" "}&middot; Score QC medio{" "}
                  <span style={{ color: avgQC >= 85 ? "#4ade80" : "#facc15" }}>
                    {avgQC.toFixed(0)}/100
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {isDone && job.slide_urls?.length > 0 && (
          <button
            className="btn-primary text-sm shrink-0"
            onClick={() => {
              job.slide_urls.forEach((url, i) => {
                const a = document.createElement("a");
                a.href = url;
                a.download = `${job.asin}_slide_${String(i + 1).padStart(2, "0")}.png`;
                a.click();
              });
            }}
          >
            <span className="flex items-center gap-2">
              <DownloadIcon />
              Scarica tutte (7)
            </span>
          </button>
        )}
      </div>

      {/* Error state */}
      {isError && (
        <div
          className="card p-6 mb-8"
          style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}
        >
          <p className="font-semibold mb-1" style={{ color: "#f87171" }}>
            Errore pipeline
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {job.error_message || "Errore sconosciuto. Controlla le variabili d'ambiente su Vercel."}
          </p>
          <button
            className="mt-4 text-sm underline"
            style={{ color: "var(--purple-400)" }}
            onClick={() => router.push("/")}
          >
            ← Torna alla dashboard
          </button>
        </div>
      )}

      {/* Progress section (while processing) */}
      {!isDone && !isError && (
        <div className="card-hero p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {STATUS_LABELS[job.status] || job.current_step || "Elaborazione..."}
            </p>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {job.current_step}
            </span>
          </div>
          <ProgressBar progress={job.progress} label="" active />
          <div className="mt-6">
            <PipelineSteps status={job.status} />
          </div>
        </div>
      )}

      {/* Done summary */}
      {isDone && (
        <div className="card p-5 mb-8 flex flex-wrap gap-6">
          <PipelineSteps status="done" />
        </div>
      )}

      {/* Slides grid */}
      {job.slide_urls?.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Slide Generate
              <span className="ml-2 text-sm font-normal" style={{ color: "var(--text-muted)" }}>
                {job.slide_urls.length} / 7
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {job.slide_urls.map((url, i) => (
              <SlideCard
                key={i}
                url={url}
                slideNum={i + 1}
                qcScore={job.qc_scores?.[`slide_${i + 1}`]}
              />
            ))}
          </div>
        </>
      )}

      {/* Waiting for slides */}
      {!isDone && !isError && (!job.slide_urls || job.slide_urls.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 gap-4" style={{ color: "var(--text-muted)" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
               style={{ background: "rgba(139,92,246,0.1)" }}>
            <SpinnerIcon size={28} color="var(--purple-400)" />
          </div>
          <p className="text-sm">Le slide appariranno man mano che vengono generate...</p>
        </div>
      )}
    </div>
  );
}

/* Status chip */
function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; dot: string }> = {
    done:    { bg: "rgba(34,197,94,0.1)",   color: "#4ade80", dot: "#22c55e" },
    error:   { bg: "rgba(239,68,68,0.1)",   color: "#f87171", dot: "#ef4444" },
    queued:  { bg: "rgba(107,107,138,0.15)", color: "#9ca3af", dot: "#6b7280" },
  };
  const style = cfg[status] ?? { bg: "rgba(139,92,246,0.1)", color: "var(--purple-400)", dot: "var(--purple-500)" };

  return (
    <span
      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: style.bg, color: style.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: style.dot,
          boxShadow: status !== "done" && status !== "error" ? `0 0 6px ${style.dot}` : "none",
        }}
      />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/* Icons */
function SpinnerIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
