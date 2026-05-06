"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Job {
  id: string; asin: string; status: string;
  progress: number; current_step: string;
  slide_urls: string[]; error_message: string | null;
  qc_scores: Record<string, { avg: number; pass: boolean }>;
  duration_ms: number;
}

export default function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
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

  if (!job) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
      Caricamento...
    </div>
  );

  if (job.status === "error") return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-red-400 text-center">
        <p className="text-xl font-bold mb-2">Errore</p>
        <p>{job.error_message}</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">ASIN: {job.asin}</h1>
          {job.status !== "done" && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-neutral-400 mb-1">
                <span>{job.current_step}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}
          {job.status === "done" && (
            <p className="text-neutral-400 mt-2">
              Completato in {(job.duration_ms / 1000).toFixed(1)}s
            </p>
          )}
        </div>

        {job.slide_urls?.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {job.slide_urls.map((url, i) => {
              const score = job.qc_scores?.[`slide_${i + 1}`];
              return (
                <div key={i} className="bg-neutral-900 rounded-xl overflow-hidden">
                  <img src={url} alt={`Slide ${i + 1}`} className="w-full" />
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-neutral-400 text-sm">Slide {i + 1}</span>
                    {score && (
                      <span className={`text-xs font-mono px-2 py-1 rounded
                        ${score.pass ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                        QC {score.avg.toFixed(0)}
                      </span>
                    )}
                    <a href={url} download className="text-amber-500 text-sm hover:underline">
                      Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
