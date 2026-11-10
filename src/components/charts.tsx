import { useEffect, useRef, useState, type ReactNode } from 'react';
import { addDays, dayKey, DAYS_SHORT, fmtDate, fmtNum, startOfWeek } from '../lib/metrics';
import { GROUPS } from '../lib/sports';

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || 600);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Techo "redondo" para el eje y sus marcas */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * p;
}

function Tip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return <div className="tip" style={{ left: x, top: y }}>{children}</div>;
}

const PAD = { l: 34, r: 8, t: 14, b: 22 };

/* ---------- Barras apiladas por grupo de deporte ---------- */
export function StackedBars({ data, unit, height = 210, dec = 1 }: {
  data: { label: string; byGroup: Record<string, number>; total: number }[]; unit: string; height?: number; dec?: number;
}) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.total), 0.001));
  const iw = w - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const step = iw / data.length;
  const bw = Math.min(34, step * 0.62);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const used = GROUPS.filter((g) => data.some((d) => d.byGroup[g.id]));
  const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 58)));
  return (
    <div>
      <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
        <svg height={height} role="img" aria-label={`Volumen semanal en ${unit}`}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line className="grid-line" x1={PAD.l} x2={w - PAD.r} y1={y(max * f)} y2={y(max * f)} strokeDasharray={f ? '3 4' : undefined} />
              <text x={PAD.l - 6} y={y(max * f) + 4} textAnchor="end">{fmtNum(max * f, dec)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.l + step * i + step / 2;
            let acc = 0;
            const segs = used.filter((g) => d.byGroup[g.id]);
            return (
              <g key={i} opacity={hover === null || hover === i ? 1 : 0.45}>
                {segs.map((g, k) => {
                  const v = d.byGroup[g.id];
                  const y1 = y(acc + v);
                  const h = Math.max(1, y(acc) - y1 - (k < segs.length - 1 ? 2 : 0)); // 2 px de aire entre tramos
                  acc += v;
                  const top = k === segs.length - 1;
                  return top
                    ? <path key={g.id} fill={g.color} d={`M${cx - bw / 2},${y1 + h} v${-(h - Math.min(4, h))} q0,${-Math.min(4, h)} ${Math.min(4, bw / 2)},${-Math.min(4, h)} h${bw - 2 * Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h)} v${h - Math.min(4, h)} z`} />
                    : <rect key={g.id} fill={g.color} x={cx - bw / 2} y={y1} width={bw} height={h} />;
                })}
                {i % every === 0 && <text x={cx} y={height - 5} textAnchor="middle">{d.label}</text>}
                <rect x={PAD.l + step * i} y={PAD.t} width={step} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <Tip x={Math.min(Math.max(PAD.l + step * hover + step / 2, 80), w - 80)} y={y(data[hover].total)}>
            <b>Semana del {data[hover].label}</b>
            {used.filter((g) => data[hover].byGroup[g.id]).map((g) => (
              <div key={g.id}><span><i className="dot" style={{ background: g.color }} />{g.name}</span><strong className="num">{fmtNum(data[hover].byGroup[g.id], dec)} {unit}</strong></div>
            ))}
            {data[hover].total === 0 ? <div><span>Sin sesiones</span></div> : <div><span>Total</span><strong className="num">{fmtNum(data[hover].total, dec)} {unit}</strong></div>}
          </Tip>
        )}
      </div>
      {used.length > 1 && <div className="legend" style={{ marginTop: '.5rem' }}>{used.map((g) => <span key={g.id}><i className="dot" style={{ background: g.color }} />{g.name}</span>)}</div>}
    </div>
  );
}

/* ---------- Líneas (un solo eje) con retícula y cursor ---------- */
export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
  area?: boolean;
  dashed?: boolean;
}
export function LineChart({ series, labels, unit = '', height = 200, dec = 0, zeroBased = false, fmt }: {
  series: Series[]; labels: string[]; unit?: string; height?: number; dec?: number; zeroBased?: boolean; fmt?: (v: number) => string;
}) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  if (all.length < 2) return <p className="muted small">Aún no hay datos suficientes para dibujar la evolución.</p>;
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (zeroBased) lo = Math.min(0, lo);
  const padv = (hi - lo || 1) * 0.12;
  if (!zeroBased || lo < 0) lo -= padv;
  hi += padv;
  const n = labels.length;
  const iw = w - PAD.l - PAD.r - 6;
  const ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + 4 + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
  const f = fmt ?? ((v: number) => `${fmtNum(v, dec)}${unit ? ' ' + unit : ''}`);
  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) return;
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const every = Math.ceil(n / Math.max(2, Math.floor(iw / 64)));
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const cx = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((cx - PAD.l - 4) / iw) * (n - 1)))));
  };
  return (
    <div>
      <div className="chart" ref={ref} onMouseMove={onMove} onTouchStart={onMove} onTouchMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg height={height} role="img" aria-label={series.map((s) => s.name).join(', ')}>
          {[0, 0.5, 1].map((t) => {
            const v = lo + (hi - lo) * t;
            return (
              <g key={t}>
                <line className="grid-line" x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} strokeDasharray="3 4" />
                <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{fmt ? fmt(v) : fmtNum(v, dec)}</text>
              </g>
            );
          })}
          {lo < 0 && hi > 0 && <line className="grid-line" x1={PAD.l} x2={w - PAD.r} y1={y(0)} y2={y(0)} />}
          {labels.map((l, i) => i % every === 0 && <text key={i} x={x(i)} y={height - 5} textAnchor={i === 0 ? 'start' : 'middle'}>{l}</text>)}
          {series.map((s) => {
            const d = path(s.values);
            const last = s.values.reduce<number>((acc, v, i) => (v != null ? i : acc), -1);
            const first = s.values.findIndex((v) => v != null);
            return (
              <g key={s.name}>
                {s.area && first >= 0 && <path d={`${d}L${x(last)},${y(Math.max(lo, 0))}L${x(first)},${y(Math.max(lo, 0))}Z`} fill={s.color} opacity=".12" />}
                <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
                {last >= 0 && <circle cx={x(last)} cy={y(s.values[last]!)} r="4" fill={s.color} stroke="var(--surface-solid)" strokeWidth="2" />}
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--text-muted)" strokeWidth="1" opacity=".5" />
              {series.map((s) => s.values[hover] != null && <circle key={s.name} cx={x(hover)} cy={y(s.values[hover]!)} r="4.5" fill={s.color} stroke="var(--surface-solid)" strokeWidth="2" />)}
            </g>
          )}
        </svg>
        {hover !== null && (
          <Tip x={Math.min(Math.max(x(hover), 80), w - 80)} y={PAD.t + 6}>
            <b>{labels[hover]}</b>
            {series.map((s) => s.values[hover] != null && (
              <div key={s.name}><span><i className="dot" style={{ background: s.color }} />{s.name}</span><strong className="num">{f(s.values[hover]!)}</strong></div>
            ))}
          </Tip>
        )}
      </div>
      {series.length > 1 && <div className="legend" style={{ marginTop: '.5rem' }}>{series.map((s) => <span key={s.name}><i className="dot" style={{ background: s.color }} />{s.name}</span>)}</div>}
    </div>
  );
}

/* ---------- Anillo de progreso ---------- */
export function Ring({ pct, size = 64, label }: { pct: number; size?: number; label?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const id = `rg${Math.round(size)}`;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(pct * 100)} %`}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent-2)" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct >= 1 ? 'var(--good)' : `url(#${id})`} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <span className="ring__label num">{label ?? `${Math.round(pct * 100)}%`}</span>
    </div>
  );
}

/* ---------- Calendario de constancia (minutos por día) ---------- */
export function Heatmap({ minutesByDay, weeks = 26, now = new Date() }: { minutesByDay: Map<string, number>; weeks?: number; now?: Date }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const cell = 13;
  const gap = 3;
  const first = addDays(startOfWeek(now), -7 * (weeks - 1));
  const level = (m: number) => (m <= 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 100 ? 3 : 4);
  const width = 22 + weeks * (cell + gap);
  const months: { x: number; label: string }[] = [];
  let lastMonth = -1;
  for (let wk = 0; wk < weeks; wk++) {
    const d = addDays(first, wk * 7);
    if (d.getMonth() !== lastMonth && d.getDate() <= 7) {
      months.push({ x: 22 + wk * (cell + gap), label: fmtDate(d).split(' ')[1] });
      lastMonth = d.getMonth();
    }
  }
  return (
    <div>
      <div className="heat chart" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={16 + 7 * (cell + gap)} style={{ width, minWidth: width }} role="img" aria-label="Minutos de entrenamiento por día">
          {months.map((m) => <text key={m.x} x={m.x} y={10}>{m.label}</text>)}
          {[0, 2, 4, 6].map((d) => <text key={d} x={0} y={16 + d * (cell + gap) + 10}>{DAYS_SHORT[d]}</text>)}
          {Array.from({ length: weeks * 7 }, (_, i) => {
            const d = addDays(first, i);
            if (d.getTime() > now.getTime()) return null;
            const m = minutesByDay.get(dayKey(d)) ?? 0;
            const x = 22 + Math.floor(i / 7) * (cell + gap);
            const y = 16 + (i % 7) * (cell + gap);
            return <rect key={i} className={`heat-cell h${level(m)}`} x={x} y={y} width={cell} height={cell} rx="3"
              onMouseEnter={() => setHover({ x: x + cell / 2, y, text: `${fmtDate(d)}: ${m ? Math.round(m) + ' min' : 'descanso'}` })} />;
          })}
        </svg>
        {hover && <Tip x={hover.x} y={hover.y}><b style={{ margin: 0 }}>{hover.text}</b></Tip>}
      </div>
      <div className="legend" style={{ marginTop: '.4rem', gap: '.3rem', alignItems: 'center' }}>
        Menos
        <svg width={5 * 16} height={13} aria-hidden="true">{[0, 1, 2, 3, 4].map((l) => <rect key={l} className={`h${l}`} x={l * 16} y={0} width={13} height={13} rx="3" />)}</svg>
        Más
      </div>
    </div>
  );
}

/* ---------- Barras horizontales con etiqueta directa ---------- */
export function HBars({ rows, fmt }: { rows: { label: string; value: number; color: string }[]; fmt: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 0.001);
  return (
    <div className="stack" style={{ gap: '.55rem' }}>
      {rows.map((r) => (
        <div className="hbar-row" key={r.label}>
          <span>{r.label}</span>
          <div className="hbar-track"><i style={{ width: `${(r.value / max) * 100}%`, background: r.color }} /></div>
          <span className="num">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
