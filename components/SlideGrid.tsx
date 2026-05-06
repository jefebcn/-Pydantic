import SlideCard from "./SlideCard";

interface SlideGridProps {
  slideUrls: string[];
  qcScores: Record<string, { avg: number; pass: boolean }>;
}

export default function SlideGrid({ slideUrls, qcScores }: SlideGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {slideUrls.map((url, i) => (
        <SlideCard
          key={i}
          url={url}
          slideNum={i + 1}
          qcScore={qcScores?.[`slide_${i + 1}`]}
        />
      ))}
    </div>
  );
}
