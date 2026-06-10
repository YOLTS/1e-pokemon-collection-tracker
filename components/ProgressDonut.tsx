type ProgressDonutProps = {
  value: number;
  label: string;
  size?: "sm" | "lg";
};

export function ProgressDonut({ value, label, size = "lg" }: ProgressDonutProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const dimensions = size === "lg" ? "size-44 sm:size-64" : "size-24";
  const textSize = size === "lg" ? "text-5xl sm:text-7xl" : "text-xl";
  const progressDegrees = clamped * 3.6;

  return (
    <div className={`relative grid ${dimensions} place-items-center`}>
      <div
        className="absolute -inset-4 rounded-full border border-cyan-300/10 bg-cyan-300/[0.025] shadow-[0_0_54px_rgba(34,211,238,0.2),0_0_28px_rgba(244,114,182,0.1)]"
      />
      <div
        className="absolute -inset-1 rounded-full opacity-45"
        style={{
          background: "repeating-conic-gradient(from -90deg, rgba(103,232,249,0.5) 0deg 1deg, transparent 1deg 10deg)",
          maskImage: "radial-gradient(circle, transparent 66%, black 67%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 66%, black 67%)",
        }}
      />
      <div
        className="absolute inset-0 rounded-full shadow-[0_0_30px_rgba(34,211,238,0.2)]"
        style={{
          background: `conic-gradient(from -90deg, #22d3ee 0deg, #f472b6 ${progressDegrees * 0.58}deg, #fbbf24 ${progressDegrees}deg, rgba(34, 211, 238, 0.16) ${progressDegrees}deg, rgba(244, 114, 182, 0.1) 360deg)`,
        }}
      />
      <div className="absolute inset-2 rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.12),rgba(2,6,23,0.96)_58%)] shadow-inner shadow-black/60 ring-1 ring-cyan-300/15" />
      <div className="absolute inset-5 rounded-full border border-cyan-300/15 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]" />
      <div className="relative text-center">
        <div className={`${textSize} font-black text-white drop-shadow-[0_0_22px_rgba(34,211,238,0.32)]`}>{Math.round(clamped)}%</div>
        <div className="mt-1.5 text-xs font-black uppercase tracking-widest text-cyan-100/80">{label}</div>
      </div>
    </div>
  );
}
