import type { Deal } from "@/lib/types";
import { hunterScore, refIssue, scoreLabel } from "@/lib/format";

/** Il Voto Hunter accanto a un'offerta. Con un prezzo da verificare il voto non si mostra: resta l'avviso. */
export function ScoreBadge({ d }: { d: Deal }) {
  if (refIssue(d)) return null;
  return (
    <span title={`Voto Hunter: ${scoreLabel(d)}`}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
      <span className="text-[#f5a623]" aria-hidden>★</span> {hunterScore(d)}
    </span>
  );
}

export function ScoreRing({ score, size = 92 }: { score: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`Voto Hunter ${score} su 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f5a623" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize={size * 0.32} fontWeight="800">{score}</text>
    </svg>
  );
}
