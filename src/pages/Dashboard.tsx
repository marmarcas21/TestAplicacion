import { Activity as Pulse, CalendarCheck, Clock, Flame, Plus, Route, Target, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Ring, StackedBars } from '../components/charts';
import { Empty, Field, Modal, ProgressBar, Stat, useUi } from '../components/ui';
import {
  achievements, addDays, dayKey, fmtNum, formStatus, goalProgress, inRange, metricLabel, metricUnit, startOfWeek, streaks, totals, toUnit,
  trainingLoad, weekdayIdx, weeklyBuckets, fromUnit, DAYS_LONG,
} from '../lib/metrics';
import { can } from '../lib/permissions';
import { SPORTS, sportName, sportOf } from '../lib/sports';
import { currentUser, deleteGoal, saveGoal, togglePlanDone, useDB } from '../lib/store';
import type { Goal, GoalMetric } from '../lib/types';
import { ActivityPost, ActivityRow } from './Activities';
import { canViewActivity } from '../lib/permissions';

const pctDelta = (now: number, prev: number) => (prev > 0 ? (now - prev) / prev : null);

export function DashboardPage() {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const now = useMemo(() => new Date(), [db]);
  const mine = useMemo(() => db.activities.filter((a) => a.userId === me.id).sort((a, b) => b.date.localeCompare(a.date)), [db.activities, me.id]);
  const [goalOpen, setGoalOpen] = useState(false);

  const ws = startOfWeek(now);
  const week = totals(inRange(mine, ws, addDays(ws, 7)));
  // Se compara con la semana pasada hasta este mismo momento, no con la semana entera
  const prev = totals(inRange(mine, addDays(ws, -7), new Date(now.getTime() - 7 * 86400000)));
  const st = streaks(mine, now);
  const buckets = weeklyBuckets(mine, 10, 'time', now);
  const load = trainingLoad(mine, 1, now)[0];
  const form = formStatus(load.form, load.fitness);
  const goals = db.goals.filter((g) => g.userId === me.id);
  const badges = achievements(mine, now);
  const todayIdx = weekdayIdx(now);
  const myPlans = db.plans.filter((p) => p.athleteIds.includes(me.id));
  const todaySessions = myPlans.flatMap((p) => p.sessions.filter((s) => s.day === todayIdx).map((s) => ({ s, p })));
  const feed = db.activities
    .filter((a) => a.userId !== me.id && canViewActivity(me, a, db.users.find((u) => u.id === a.userId)))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const hello = now.getHours() < 13 ? 'Buenos días' : now.getHours() < 21 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{hello}, {me.name}</h1>
          <p className="page-sub">
            {st.current > 0 ? `Llevas ${st.current} ${st.current === 1 ? 'día' : 'días'} seguidos entrenando.` : 'Hoy es buen día para empezar una racha.'}
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => ui.go('registrar')}><Clock /> Cronómetro</button>
          <button className="btn btn-primary" onClick={() => ui.editActivity()}><Plus /> Añadir sesión</button>
        </div>
      </div>

      <div className="card glass">
        <div className="card-head"><h3>Esta semana</h3><span className="card-sub">frente a la semana pasada a estas alturas</span></div>
        <div className="grid g-4">
          <Stat icon={<CalendarCheck />} label="Sesiones" value={String(week.sessions)} delta={pctDelta(week.sessions, prev.sessions)} />
          <Stat icon={<Clock />} label="Tiempo" value={fmtNum(week.timeSec / 3600)} unit="h" delta={pctDelta(week.timeSec, prev.timeSec)} />
          <Stat icon={<Route />} label="Distancia" value={fmtNum(toUnit(week.distanceKm, me.units))} unit={me.units} delta={pctDelta(week.distanceKm, prev.distanceKm)} />
          <Stat icon={<Flame />} label="Racha" value={String(st.current)} unit={st.current === 1 ? 'día' : 'días'} />
        </div>
      </div>

      <div className="grid g-main">
        <div className="stack">
          <div className="card glass">
            <div className="card-head"><h3>Horas por semana</h3><button className="btn btn-sm" onClick={() => ui.go('estadisticas')}>Ver estadísticas</button></div>
            <StackedBars data={buckets} unit="h" />
          </div>
          <div className="card glass">
            <div className="card-head"><h3>Últimas sesiones</h3><button className="btn btn-sm" onClick={() => ui.go('actividades')}>Ver todas</button></div>
            {mine.length ? <div className="stack" style={{ gap: '.15rem' }}>{mine.slice(0, 5).map((a) => <ActivityRow key={a.id} a={a} me={me} />)}</div>
              : <Empty icon="👟" title="Aún no hay sesiones"><button className="btn btn-primary" onClick={() => ui.editActivity()}><Plus /> Registrar la primera</button></Empty>}
          </div>
        </div>

        <div className="stack">
          {todaySessions.length > 0 && (
            <div className="card glass">
              <div className="card-head"><h3>Hoy toca · {DAYS_LONG[todayIdx]}</h3></div>
              <div className="stack" style={{ gap: '.6rem' }}>
                {todaySessions.map(({ s, p }) => {
                  const key = `${me.id}|${s.id}|${dayKey(now)}`;
                  const done = !!db.planDone[key];
                  return (
                    <div key={s.id} className="badge">
                      <div className="badge__icon" style={{ filter: 'none', opacity: 1 }}>{sportOf(s.sport).emoji}</div>
                      <div className="badge__body">
                        <strong>{s.title}</strong>
                        <span className="muted small">{s.durationMin} min{s.distanceKm ? ` · ${fmtNum(toUnit(s.distanceKm, me.units))} ${me.units}` : ''} · {p.name}</span>
                      </div>
                      {done ? <button className="pill pill-good" style={{ border: 'none' }} onClick={() => ui.run(() => togglePlanDone(key))}>Hecha ✓</button>
                        : <button className="btn btn-sm btn-primary" onClick={() => ui.editActivity(undefined, { sport: s.sport, title: s.title, durationSec: s.durationMin * 60, distanceKm: s.distanceKm, planSessionKey: key })}>Registrar</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card glass">
            <div className="card-head"><h3>Objetivos</h3>{can(me, 'goal.own') && <button className="btn btn-sm" onClick={() => setGoalOpen(true)}><Target /> Nuevo</button>}</div>
            {goals.length ? (
              <div className="stack">
                {goals.map((g) => {
                  const p = goalProgress(g, mine, now);
                  const shown = g.metric === 'distance' ? toUnit(p.value, me.units) : p.value;
                  const target = g.metric === 'distance' ? toUnit(g.target, me.units) : g.target;
                  return (
                    <div className="ring-wrap" key={g.id}>
                      <Ring pct={p.pct} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>{metricLabel[g.metric]} · {sportName(g.sport)}</strong>
                        <div className="muted small num">{fmtNum(shown)} de {fmtNum(target)} {metricUnit(g.metric, me.units)} · {g.period === 'week' ? 'esta semana' : 'este mes'}</div>
                        <div className="muted small">{p.pct >= 1 ? '¡Conseguido!' : `Quedan ${p.daysLeft} ${p.daysLeft === 1 ? 'día' : 'días'}`}</div>
                      </div>
                      <button className="icon-btn" aria-label="Borrar objetivo" onClick={() => ui.run(() => deleteGoal(g.id), 'Objetivo borrado')}><Trash2 /></button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="muted small">Marca un objetivo semanal o mensual y aquí verás cuánto te falta.</p>}
          </div>

          <div className="card glass">
            <div className="card-head"><h3>Estado de forma</h3><span className={`pill pill-${form.tone === 'neutral' ? 'accent' : form.tone}`}><Pulse /> {form.label}</span></div>
            <div className="grid g-3 num" style={{ gap: '.5rem' }}>
              <Stat label="Forma" value={fmtNum(load.fitness, 0)} />
              <Stat label="Fatiga" value={fmtNum(load.fatigue, 0)} />
              <Stat label="Frescura" value={(load.form > 0 ? '+' : '') + fmtNum(load.form, 0)} />
            </div>
            <p className="muted small" style={{ marginTop: '.6rem' }}>{form.hint}</p>
          </div>

          <div className="card glass">
            <div className="card-head"><h3>Logros</h3><span className="card-sub">{badges.filter((b) => b.done).length} de {badges.length}</span></div>
            <div className="stack" style={{ gap: '.5rem' }}>
              {[...badges.filter((b) => !b.done).sort((a, b) => b.progress - a.progress).slice(0, 2), ...badges.filter((b) => b.done).slice(-2)].map((b) => (
                <div key={b.id} className={`badge ${b.done ? 'done' : ''}`}>
                  <div className="badge__icon">{b.emoji}</div>
                  <div className="badge__body"><strong>{b.name}</strong><span className="muted small">{b.desc}</span>{!b.done && <ProgressBar pct={b.progress} />}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {feed.length > 0 && (
        <div className="stack">
          <div className="card-head" style={{ margin: 0 }}><h3>Tus amigos</h3><button className="btn btn-sm" onClick={() => ui.go('social')}>Ver todo</button></div>
          <div className="grid g-2">{feed.map((a) => <ActivityPost key={a.id} a={a} me={me} />)}</div>
        </div>
      )}
      {goalOpen && <GoalForm onClose={() => setGoalOpen(false)} />}
    </div>
  );
}

function GoalForm({ onClose }: { onClose: () => void }) {
  const ui = useUi();
  const me = currentUser()!;
  const [g, setG] = useState<Omit<Goal, 'id' | 'userId'>>({ sport: 'all', metric: 'distance', period: 'week', target: 20 });
  return (
    <Modal title="Nuevo objetivo" size="narrow" onClose={onClose}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        const target = g.metric === 'distance' ? fromUnit(g.target, me.units) : g.target;
        if (ui.run(() => saveGoal({ ...g, target }), 'Objetivo creado')) onClose();
      }}>
        <Field label="Deporte">
          <select id="g-sport" className="input" value={g.sport} onChange={(e) => setG({ ...g, sport: e.target.value })}>
            <option value="all">Todos los deportes</option>
            {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Qué medir">
            <select id="g-metric" className="input" value={g.metric} onChange={(e) => setG({ ...g, metric: e.target.value as GoalMetric })}>
              <option value="distance">Distancia</option><option value="time">Tiempo (horas)</option><option value="sessions">Sesiones</option>
            </select>
          </Field>
          <Field label="Periodo">
            <select id="g-period" className="input" value={g.period} onChange={(e) => setG({ ...g, period: e.target.value as Goal['period'] })}>
              <option value="week">Cada semana</option><option value="month">Cada mes</option>
            </select>
          </Field>
        </div>
        <Field label={`Meta (${metricUnit(g.metric, me.units)})`}>
          <input id="g-target" className="input" type="number" min="1" step="any" value={g.target} onChange={(e) => setG({ ...g, target: Number(e.target.value) })} required />
        </Field>
        <div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit">Crear objetivo</button></div>
      </form>
    </Modal>
  );
}
