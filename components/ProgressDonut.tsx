type ProgressDonutProps = {
  value: number;
  label: string;
  size?: "sm" | "lg";
};

export function ProgressDonut({ value, label, size = "lg" }: ProgressDonutProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const dimensions = size === "lg" ? "size-44" : "size-24";
  const textSize = size === "lg" ? "text-4xl" : "text-xl";

  return (
    <div className={`relative grid ${dimensions} place-items-center`}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#34d399 ${clamped * 3.6}deg, rgba(148, 163, 184, 0.18) 0deg)`,
        }}
      />
      <div className="absolute inset-3 rounded-full bg-slate-950 shadow-inner shadow-black/40" />
      <div className="relative text-center">
        <div className={`${textSize} font-black text-white`}>{Math.round(clamped)}%</div>
        <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
      </div>
    </div>
  );
}
