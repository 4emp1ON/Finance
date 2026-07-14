import { useMemo, useState } from 'react';
import { money } from '../format';

interface Slice {
  name: string;
  color: string;
  total: number;
}

interface RawCat {
  category_id: number | null;
  name: string | null;
  color: string | null;
  total: number;
}

const OTHER_COLOR = '#92949c';
const OTHER_NAME = 'Прочее';
// Доли меньше этого процента объединяются в «Прочее»
const MIN_PERCENT = 5;
const PAD = 0.03; // угловой зазор между сегментами (радианы)
const R_OUT = 46;
const R_IN = 30;
const C = 60;

function polar(angle: number, radius: number): [number, number] {
  return [C + radius * Math.cos(angle), C + radius * Math.sin(angle)];
}

function sectorPath(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(a0, R_OUT);
  const [x1, y1] = polar(a1, R_OUT);
  const [x2, y2] = polar(a1, R_IN);
  const [x3, y3] = polar(a0, R_IN);
  return `M ${x0} ${y0} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3} Z`;
}

function groupSlices(cats: RawCat[]): Slice[] {
  const positive = cats.filter((c) => c.total > 0);
  const total = positive.reduce((s, c) => s + c.total, 0);
  if (total === 0) return [];

  const main: Slice[] = [];
  let otherTotal = 0;

  for (const c of positive) {
    const isOther = c.name === OTHER_NAME || c.name == null;
    const percent = (c.total / total) * 100;
    if (isOther || percent < MIN_PERCENT) {
      otherTotal += c.total;
    } else {
      main.push({ name: c.name!, color: c.color || OTHER_COLOR, total: c.total });
    }
  }

  main.sort((a, b) => b.total - a.total);
  if (otherTotal > 0) {
    main.push({ name: OTHER_NAME, color: OTHER_COLOR, total: otherTotal });
  }
  return main;
}

export default function CategoryDonut({ cats }: { cats: RawCat[] }) {
  const slices = useMemo(() => groupSlices(cats), [cats]);
  const [active, setActive] = useState<number | null>(null);

  const total = slices.reduce((s, c) => s + c.total, 0);
  if (slices.length === 0) return null;

  const single = slices.length === 1;
  let cursor = -Math.PI / 2; // старт сверху
  const arcs = slices.map((s, i) => {
    const frac = s.total / total;
    const a0 = cursor;
    const a1 = cursor + frac * Math.PI * 2;
    cursor = a1;
    const pad = single ? 0 : PAD;
    return { slice: s, index: i, path: sectorPath(a0 + pad / 2, a1 - pad / 2) };
  });

  const center =
    active != null
      ? { top: slices[active].name, big: `${Math.round((slices[active].total / total) * 100)}%` }
      : { top: 'Всего', big: money(total) };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg viewBox="0 0 120 120" width="200" height="200" role="img" aria-label="Расходы по категориям">
          {single && (
            <circle cx={C} cy={C} r={(R_OUT + R_IN) / 2} fill="none"
              stroke={slices[0].color} strokeWidth={R_OUT - R_IN} />
          )}
          {!single &&
            arcs.map((a) => (
              <path
                key={a.index}
                d={a.path}
                fill={a.slice.color}
                opacity={active == null || active === a.index ? 1 : 0.35}
                onClick={() => setActive(active === a.index ? null : a.index)}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              />
            ))}
          <text x={C} y={C - 6} textAnchor="middle"
            style={{ fontSize: 7, fill: 'var(--ion-color-medium)' }}>
            {center.top}
          </text>
          <text x={C} y={C + 9} textAnchor="middle"
            style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ion-text-color, #000)' }}>
            {center.big}
          </text>
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {slices.map((s, i) => {
          const pct = Math.round((s.total / total) * 100);
          return (
            <div
              key={s.name}
              onClick={() => setActive(active === i ? null : i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                opacity: active == null || active === i ? 1 : 0.5,
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{s.name}</span>
              <span className="hint" style={{ minWidth: 34, textAlign: 'right' }}>{pct}%</span>
              <span style={{ minWidth: 70, textAlign: 'right', fontWeight: 500 }}>{money(s.total)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
