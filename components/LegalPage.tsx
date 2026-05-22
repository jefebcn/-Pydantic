import Link from "next/link";

interface LegalSection {
  h: string;
  p?: string;
  list?: string[];
}

/**
 * Shared shell for /privacy, /cookies, /terms.
 * Server component — pure render, no client interactivity.
 */
export default function LegalPage({
  kicker, title, updated, sections,
}: {
  kicker: string;
  title: string;
  updated: string;          // ISO date string
  sections: LegalSection[];
}) {
  return (
    <main className="px-5 md:px-8 pt-6 md:pt-10 pb-16 max-w-3xl mx-auto">
      <header className="mb-10">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-3"
          style={{ color: "var(--purple-400)" }}>
          {kicker}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        <p className="mt-2 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Ultimo aggiornamento: {updated}
        </p>
      </header>

      <article className="space-y-7">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              {s.h}
            </h2>
            {s.p && (
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {s.p}
              </p>
            )}
            {s.list && (
              <ul className="mt-2 space-y-1.5">
                {s.list.map((li, j) => (
                  <li key={j} className="text-sm leading-relaxed pl-4 relative"
                    style={{ color: "var(--text-muted)" }}>
                    <span className="absolute left-0" style={{ color: "var(--purple-400)" }}>›</span>
                    {li}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      <div className="mt-12 pt-6 flex items-center justify-between flex-wrap gap-3"
        style={{ borderTop: "1px solid var(--border)" }}>
        <Link href="/" className="text-xs font-semibold"
          style={{ color: "var(--purple-400)" }}>
          ← Torna alla home
        </Link>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/privacy"  className="hover:underline">Privacy</Link>
          <Link href="/cookies"  className="hover:underline">Cookie</Link>
          <Link href="/terms"    className="hover:underline">Termini</Link>
        </div>
      </div>
    </main>
  );
}
