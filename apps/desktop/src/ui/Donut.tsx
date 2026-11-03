/** Arc extents (stroke-dash units along the circumference) for each value; empty when there is nothing to show. */
export function donutArcs(values: number[], radius: number): { start: number; end: number }[] {
  const v = values.map(x => (x > 0 && Number.isFinite(x) ? x : 0));
  const total = v.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const c = 2 * Math.PI * radius;
  let at = 0;
  return v.map(x => { const start = at; at += (x / total) * c; return { start, end: at }; });
}

const R = 42, SIZE = 120, GAP = 1.5;
const shade = (i: number) => `color-mix(in srgb, var(--accent) ${Math.max(30, 100 - i * 18)}%, var(--surface-raised))`;

export function Donut({ slices, center, caption }: { slices: { label: string; value: number; color?: string }[]; center: string; caption?: string }) {
  const arcs = donutArcs(slices.map(s => s.value), R);
  const c = 2 * Math.PI * R;
  return (
    <div className="ui-donut">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={slices.map(s => `${s.label} ${s.value}`).join(', ') || center}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--line)" strokeWidth={10} />
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map((a, i) => a.end > a.start && (
            <circle key={i} data-slice cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={slices[i].color ?? shade(i)} strokeWidth={10}
              strokeDasharray={`${Math.max(0, a.end - a.start - (arcs.length > 1 ? GAP : 0))} ${c}`} strokeDashoffset={-a.start} />
          ))}
        </g>
      </svg>
      <div className="ui-donut-center">
        <div className="ui-donut-value">{center}</div>
        {caption && <div className="ui-donut-caption">{caption}</div>}
      </div>
    </div>
  );
}
