type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: "slate" | "green" | "rose" | "amber" | "cyan";
};

const toneClasses = {
  slate: "border-white/10 bg-white/[0.06]",
  green: "border-emerald-300/20 bg-emerald-400/10",
  rose: "border-rose-300/20 bg-rose-400/10",
  amber: "border-amber-300/20 bg-amber-400/10",
  cyan: "border-cyan-300/20 bg-cyan-400/10",
};

export function StatCard({ label, value, helper, tone = "slate" }: StatCardProps) {
  return (
    <section className={`rounded-lg border p-5 shadow-soft backdrop-blur ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-400">{helper}</p> : null}
    </section>
  );
}
