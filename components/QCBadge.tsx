interface QCBadgeProps {
  avg: number;
  pass: boolean;
}

export default function QCBadge({ avg, pass }: QCBadgeProps) {
  return (
    <span className={`text-xs font-mono px-2 py-1 rounded
      ${pass ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
      QC {avg.toFixed(0)}
    </span>
  );
}
