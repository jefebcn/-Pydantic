interface ProgressBarProps {
  progress: number;
  label: string;
}

export default function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm text-neutral-400 mb-1">
        <span>{label}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
