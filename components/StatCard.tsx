type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: "slate" | "green" | "rose" | "amber" | "cyan";
};

const toneClasses = {
  slate: "from-slate-300/10 to-white/[0.03] text-slate-300",
  green: "from-cyan-300/[0.16] to-sky-400/[0.04] text-cyan-200",
  rose: "from-fuchsia-400/[0.16] to-pink-400/[0.04] text-fuchsia-200",
  amber: "from-amber-300/[0.18] to-orange-400/[0.05] text-amber-200",
  cyan: "from-cyan-300/[0.18] to-blue-500/[0.05] text-cyan-100",
};

export function StatCard({ label, value, helper, tone = "slate" }: StatCardProps) {
  return (
    <section className={`neon-panel rounded-lg bg-gradient-to-br p-5 ${toneClasses[tone]}`}>
      <div className="mb-4 h-1 w-16 rounded-full bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 shadow-glow" />
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white drop-shadow-[0_0_18px_rgba(34,211,238,0.24)]">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-400">{helper}</p> : null}
    </section>
  );
}
