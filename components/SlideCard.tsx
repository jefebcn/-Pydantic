interface SlideCardProps {
  url: string;
  slideNum: number;
  qcScore?: { avg: number; pass: boolean };
}

export default function SlideCard({ url, slideNum, qcScore }: SlideCardProps) {
  return (
    <div className="bg-neutral-900 rounded-xl overflow-hidden">
      <img src={url} alt={`Slide ${slideNum}`} className="w-full" />
      <div className="p-3 flex justify-between items-center">
        <span className="text-neutral-400 text-sm">Slide {slideNum}</span>
        {qcScore && (
          <span className={`text-xs font-mono px-2 py-1 rounded
            ${qcScore.pass ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
            QC {qcScore.avg.toFixed(0)}
          </span>
        )}
        <a href={url} download className="text-amber-500 text-sm hover:underline">
          Download
        </a>
      </div>
    </div>
  );
}
