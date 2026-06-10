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
        className="absolute -inset-3 rounded-full border border-cyan-300/10 bg-cyan-300/[0.03] shadow-glow"
      />
      <div
        className="absolute inset-0 rounded-full shadow-amber"
        style={{
          background: `conic-gradient(#fbbf24 ${clamped * 3.6}deg, rgba(34, 211, 238, 0.22) 0deg, rgba(244, 114, 182, 0.16) 360deg)`,
        }}
      />
      <div className="absolute inset-2 rounded-full border border-white/10 bg-slate-950 shadow-inner shadow-black/50 ring-1 ring-cyan-300/10" />
      <div className="absolute inset-5 rounded-full border border-amber-300/15" />
      <div className="relative text-center">
        <div className={`${textSize} font-black text-white drop-shadow-[0_0_18px_rgba(251,191,36,0.24)]`}>{Math.round(clamped)}%</div>
        <div className="mt-1 text-xs font-bold uppercase tracking-wide text-cyan-200/80">{label}</div>
      </div>
    </div>
  );
}
