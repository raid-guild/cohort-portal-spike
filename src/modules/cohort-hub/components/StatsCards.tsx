export type StatItem = {
  label: string;
  value: string;
  hint?: string;
};

export function StatsCards({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className="rounded-xl border border-border bg-card p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
          {stat.hint ? <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p> : null}
        </article>
      ))}
    </div>
  );
}
