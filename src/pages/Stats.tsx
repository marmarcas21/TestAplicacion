import { useMemo, useState } from 'react';
import { HBars, Heatmap, LineChart, StackedBars } from '../components/charts';
import { Empty, ProgressBar, Seg, Stat, useUi } from '../components/ui';
import {
  achievements, addDays, dayKey, fmtClock, fmtDate, fmtNum, formStatus, groupShare, inRange, metricUnit, personalRecords, startOfDay,
  startOfWeek, streaks, strengthRecords, totals, toUnit, trainingLoad, weeklyBuckets,
} from '../lib/metrics';
import { groupOf } from '../lib/sports';
import { useDB, currentUser } from '../lib/store';
import type { GoalMetric, User } from '../lib/types';

const PERIODS: [string, string, number][] = [['4', '4 semanas', 4], ['12', '12 semanas', 12], ['26', '6 meses', 26], ['52', '1 año', 52]];

/** Panel de análisis. Con `athleteId` lo usa un entrenador para ver a su atleta. */
export function StatsView({ subject, viewer }: { subject: User; viewer: User }) {
  const db = useDB();
  const ui = useUi();
  const now = useMemo(() => new Date(), [db]);
  const [period, setPeriod] = useState('12');
  const [metric, setMetric] = useState<GoalMetric>('time');
  const weeks = Number(period);
  const all = useMemo(() => db.activities.filter((a) => a.userId === subject.id), [db.activities, subject.id]);
  const from = addDays(startOfWeek(now), -7 * (weeks - 1));
  const cur = inRange(all, from, addDays(now, 1));
  const prevRange = inRange(all, addDays(from, -7 * weeks), from);
  const t = totals(cur);
  const p = totals(prevRange);
  const d = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
  const u = viewer.units;
  const conv = (v: number) => (metric === 'distance' ? toUnit(v, u) : v);
  const buckets = weeklyBuckets(cur, weeks, metric, now).map((b) => ({
    ...b, total: conv(b.total), byGroup: Object.fromEntries(Object.entries(b.byGroup).map(([k, v]) => [k, conv(v)])),
  }));
  const share = groupShare(cur, metric);
  const st = streaks(all, now);
  const loadDays = Math.min(weeks * 7, 182);
  const load = trainingLoad(all, loadDays, now);
  const lastLoad = load[load.length - 1];
  const form = formStatus(lastLoad.form, lastLoad.fitness);
  const prs = personalRecords(all, u);
  const strength = strengthRecords(all);
  const [exercise, setExercise] = useState('');
  const ex = strength.find((s) => s.exercise === exercise) ?? strength[0];
  const minutes = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of all) m.set(dayKey(a.date), (m.get(dayKey(a.date)) ?? 0) + a.durationSec / 60);
    return m;
  }, [all]);
  const runs = cur.filter((a) => groupOf(a.sport).id === 'run' && a.distanceKm && a.distanceKm >= 3).sort((a, b) => a.date.localeCompare(b.date));
  const badges = achievements(all, now);

  if (!all.length) return <div className="card glass"><Empty icon="📊" title="Sin datos todavía">Cuando haya sesiones registradas, aquí aparecerán las gráficas.</Empty></div>;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Seg value={period} onChange={setPeriod} options={PERIODS.map(([v, l]) => [v, l] as [string, string])} />
        <Seg value={metric} onChange={setMetric} options={[['time', 'Tiempo'], ['distance', 'Distancia'], ['sessions', 'Sesiones']]} />
      </div>

      <div className="card glass">
        <div className="grid g-4">
          <Stat label="Sesiones" value={String(t.sessions)} delta={d(t.sessions, p.sessions)} />
          <Stat label="Tiempo" value={fmtNum(t.timeSec / 3600)} unit="h" delta={d(t.timeSec, p.timeSec)} />
          <Stat label="Distancia" value={fmtNum(toUnit(t.distanceKm, u), 0)} unit={u} delta={d(t.distanceKm, p.distanceKm)} />
          <Stat label="Desnivel" value={fmtNum(t.elevationM, 0)} unit="m" delta={d(t.elevationM, p.elevationM)} />
        </div>
      </div>

      <div className="grid g-main">
        <div className="card glass">
          <div className="card-head"><h3>Volumen semanal</h3><span className="card-sub">{metricUnit(metric, u)} por semana, por tipo de deporte</span></div>
          <StackedBars data={buckets} unit={metricUnit(metric, u)} dec={metric === 'sessions' ? 0 : 1} />
        </div>
        <div className="card glass">
          <div className="card-head"><h3>Reparto por deporte</h3></div>
          <HBars rows={share.sort((a, b) => b.value - a.value).map((s) => ({ label: s.group.name, value: conv(s.value), color: s.group.color }))}
            fmt={(v) => `${fmtNum(v, metric === 'sessions' ? 0 : 1)} ${metricUnit(metric, u)}`} />
          <div className="grid g-2" style={{ marginTop: '1.1rem' }}>
            <Stat label="Racha actual" value={String(st.current)} unit="días" />
            <Stat label="Mejor racha" value={String(st.best)} unit="días" />
          </div>
        </div>
      </div>

      <div className="card glass">
        <div className="card-head">
          <div><h3>Carga de entrenamiento</h3><span className="card-sub">Forma (media de 42 días) frente a fatiga (7 días). Carga = minutos × esfuerzo percibido.</span></div>
          <span className={`pill pill-${form.tone === 'neutral' ? 'accent' : form.tone}`}>{form.label}</span>
        </div>
        <LineChart zeroBased height={220}
          labels={load.map((x) => fmtDate(x.date))}
          series={[
            { name: 'Forma', color: 'var(--s2)', values: load.map((x) => Math.round(x.fitness)), area: true },
            { name: 'Fatiga', color: 'var(--s1)', values: load.map((x) => Math.round(x.fatigue)) },
          ]} />
        <p className="muted small" style={{ marginTop: '.5rem' }}>Frescura hoy: <strong className="num">{(lastLoad.form > 0 ? '+' : '') + fmtNum(lastLoad.form, 0)}</strong>. {form.hint}</p>
      </div>

      <div className="grid g-2">
        <div className="card glass">
          <div className="card-head"><h3>Ritmo al correr</h3><span className="card-sub">cada punto es una carrera de 3 km o más</span></div>
          {runs.length > 1 ? (
            <LineChart height={190} labels={runs.map((a) => fmtDate(a.date))} fmt={(v) => `${fmtClock(v)} /${u}`}
              series={[{ name: 'Ritmo', color: 'var(--s1)', values: runs.map((a) => a.durationSec / toUnit(a.distanceKm!, u)) }]} />
          ) : <p className="muted small">Hacen falta al menos dos carreras en el periodo.</p>}
          <p className="muted small" style={{ marginTop: '.4rem' }}>Más abajo en la gráfica = más rápido.</p>
        </div>
        <div className="card glass">
          <div className="card-head">
            <h3>Fuerza · 1RM estimado</h3>
            {strength.length > 0 && (
              <select id="st-ex" className="input" style={{ width: 'auto' }} value={ex?.exercise} onChange={(e) => setExercise(e.target.value)} aria-label="Ejercicio">
                {strength.map((s) => <option key={s.exercise} value={s.exercise}>{s.exercise}</option>)}
              </select>
            )}
          </div>
          {ex && ex.history.length > 1 ? (
            <LineChart height={190} unit="kg" labels={ex.history.map((h) => fmtDate(h.date))} series={[{ name: ex.exercise, color: 'var(--s4)', values: ex.history.map((h) => h.value) }]} />
          ) : <p className="muted small">Registra series con peso en el gimnasio para ver tu progresión (fórmula de Epley).</p>}
        </div>
      </div>

      <div className="grid g-main">
        <div className="card glass">
          <div className="card-head"><h3>Constancia</h3><span className="card-sub">minutos por día, últimos 6 meses</span></div>
          <Heatmap minutesByDay={minutes} now={startOfDay(now)} />
        </div>
        <div className="card glass">
          <div className="card-head"><h3>Récords personales</h3></div>
          {prs.length ? (
            <div className="stack" style={{ gap: '.1rem' }}>
              {prs.map((r) => (
                <button key={r.label} className="act-row" onClick={() => ui.openActivity(r.activity.id)}>
                  <div className="act-row__body"><div className="act-row__title">{r.label}</div><div className="act-row__meta">{fmtDate(r.activity.date)} · {r.activity.title}</div></div>
                  <strong className="num" style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>{r.value}</strong>
                </button>
              ))}
            </div>
          ) : <p className="muted small">Aún no hay marcas.</p>}
        </div>
      </div>

      <div className="card glass">
        <div className="card-head"><h3>Logros</h3><span className="card-sub">{badges.filter((b) => b.done).length} de {badges.length} conseguidos</span></div>
        <div className="grid g-auto" style={{ gap: '.6rem' }}>
          {badges.map((b) => (
            <div key={b.id} className={`badge ${b.done ? 'done' : ''}`}>
              <div className="badge__icon">{b.emoji}</div>
              <div className="badge__body"><strong>{b.name}</strong><span className="muted small">{b.desc}</span>{!b.done && <ProgressBar pct={b.progress} />}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function StatsPage() {
  const db = useDB();
  const me = currentUser(db)!;
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="page-title">Estadísticas</h1><p className="page-sub">Volumen, carga, ritmos y récords de tu entrenamiento.</p></div></div>
      <StatsView subject={me} viewer={me} />
    </div>
  );
}
