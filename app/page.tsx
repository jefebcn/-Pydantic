"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [asin, setAsin]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asin.match(/^[A-Z0-9]{10}$/)) {
      setError("ASIN deve essere 10 caratteri alfanumerici (es. B08XYZ12AB)");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asin: asin.toUpperCase() })
    });

    const data = await res.json();
    if (data.job_id) {
      router.push(`/results/${data.job_id}`);
    } else {
      setError(data.error || "Errore sconosciuto");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950">
      <div className="w-full max-w-lg px-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          Amazon Infographic Generator
        </h1>
        <p className="text-neutral-400 mb-8">
          Inserisci un ASIN Amazon. Le 7 slide vengono generate in ~90 secondi.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={asin}
            onChange={e => setAsin(e.target.value.toUpperCase())}
            placeholder="Es. B08XYZ12AB"
            maxLength={10}
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700
                       rounded-lg text-white font-mono text-lg tracking-wider
                       focus:outline-none focus:border-amber-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || asin.length !== 10}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-black font-bold rounded-lg transition-colors"
          >
            {loading ? "Avvio pipeline..." : "Genera Infografiche"}
          </button>
        </form>
      </div>
    </main>
  );
}
